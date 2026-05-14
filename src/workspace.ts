import fs from "node:fs/promises";
import path from "node:path";

import { ensureGitHubToken } from "./config.js";
import {
  createGitHubClient,
  ensureForkExists,
  extractGitHubRepoFullName,
  getRepoDetails,
  splitRepoFullName,
} from "./github.js";
import {
  addRemote,
  checkoutBranch,
  checkoutBranchFrom,
  cloneRepository,
  countCommitsAheadOfUpstream,
  fetchRemote,
  getCurrentBranch,
  getRemoteUrl,
  getStatusPorcelain,
  isGitAvailable,
  isGitRepository,
  isWorkingTreeClean,
  listRemotes,
  setRemoteUrl,
} from "./git.js";
import { WisteriaError } from "./errors.js";
import { assertGitCommandsAllowed, assertSafeWorkDir } from "./safety.js";
import type {
  PrepareContributionParams,
  PrepareContributionResult,
  WorkspaceCheckResult,
  WisteriaConfig,
} from "./types.js";

function buildRepoPath(workDir: string, repoFullName: string): string {
  const { owner, repo } = splitRepoFullName(repoFullName);
  return path.join(path.resolve(workDir), `${owner}__${repo}`);
}

function githubRemoteUrl(repoFullName: string): string {
  return `https://github.com/${repoFullName}.git`;
}

async function ensureDirExists(targetPath: string): Promise<void> {
  await fs.mkdir(targetPath, { recursive: true });
}

async function ensureRemote(params: {
  workspacePath: string;
  allowRoot: string;
  name: string;
  url: string;
}): Promise<void> {
  const existing = await getRemoteUrl({
    cwd: params.workspacePath,
    allowRoot: params.allowRoot,
    name: params.name,
  });

  if (!existing) {
    const created = await addRemote({
      cwd: params.workspacePath,
      allowRoot: params.allowRoot,
      name: params.name,
      url: params.url,
    });
    if (!created.ok) {
      throw new WisteriaError(created.stderr || `Failed to add remote ${params.name}.`, "GIT_REMOTE_ADD_FAILED");
    }
    return;
  }

  if (existing !== params.url) {
    const updated = await setRemoteUrl({
      cwd: params.workspacePath,
      allowRoot: params.allowRoot,
      name: params.name,
      url: params.url,
    });
    if (!updated.ok) {
      throw new WisteriaError(updated.stderr || `Failed to update remote ${params.name}.`, "GIT_REMOTE_SET_FAILED");
    }
  }
}

async function collectRemoteMap(
  workspacePath: string,
  allowRoot: string,
): Promise<Record<string, string>> {
  const remoteNames = await listRemotes({ cwd: workspacePath, allowRoot });
  const remotes: Record<string, string> = {};

  for (const name of remoteNames) {
    const url = await getRemoteUrl({ cwd: workspacePath, allowRoot, name });
    if (url) {
      remotes[name] = url;
    }
  }

  return remotes;
}

function resolveAllowedRoot(config: WisteriaConfig, candidatePath: string): string {
  return config.defaultWorkDir ? path.resolve(config.defaultWorkDir) : path.resolve(candidatePath);
}

export async function prepareContributionWorkspace(
  params: PrepareContributionParams,
  config: WisteriaConfig,
): Promise<PrepareContributionResult> {
  assertGitCommandsAllowed(config);

  const token = ensureGitHubToken(config);
  if (!token) {
    throw new WisteriaError("GitHub token is required.", "GITHUB_TOKEN_REQUIRED");
  }

  if (!(await isGitAvailable())) {
    throw new WisteriaError("Git is not available on this system.", "GIT_NOT_AVAILABLE");
  }

  const workDir = path.resolve(params.workDir);
  const allowedRoot = resolveAllowedRoot(config, workDir);
  assertSafeWorkDir(workDir, allowedRoot);
  await ensureDirExists(workDir);

  const client = createGitHubClient(token);
  const repoDetails = await getRepoDetails(client, params.repoFullName);
  const forkInfo = params.forkIfNeeded === false
    ? {
        forkFullName: params.repoFullName,
        ownerLogin: splitRepoFullName(params.repoFullName).owner,
      }
    : await ensureForkExists(client, params.repoFullName);

  const workspacePath = buildRepoPath(workDir, params.repoFullName);
  const workspaceExists = await fs
    .stat(workspacePath)
    .then(() => true)
    .catch(() => false);
  let reusedExistingClone = false;
  let reusedExistingBranch = false;
  const warnings: string[] = [];

  if (!workspaceExists) {
    const cloneResult = await cloneRepository({
      repoUrl: githubRemoteUrl(forkInfo.forkFullName),
      targetDir: workspacePath,
      allowRoot: workDir,
      token,
    });

    if (!cloneResult.ok) {
      throw new WisteriaError(cloneResult.stderr || "Failed to clone repository.", "GIT_CLONE_FAILED");
    }
  } else {
    if (!(await isGitRepository({ cwd: workspacePath, allowRoot: workDir }))) {
      throw new WisteriaError(
        `Existing path is not a Git repository: ${workspacePath}`,
        "WORKSPACE_NOT_GIT_REPO",
      );
    }

    reusedExistingClone = true;
    if (!(await isWorkingTreeClean({ cwd: workspacePath, allowRoot: workDir }))) {
      throw new WisteriaError(
        "Workspace has uncommitted changes. Clean the tree before reusing it.",
        "DIRTY_WORKSPACE",
      );
    }
  }

  await ensureRemote({
    workspacePath,
    allowRoot: workDir,
    name: "origin",
    url: githubRemoteUrl(forkInfo.forkFullName),
  });
  await ensureRemote({
    workspacePath,
    allowRoot: workDir,
    name: "upstream",
    url: githubRemoteUrl(params.repoFullName),
  });

  const fetchResult = await fetchRemote({
    cwd: workspacePath,
    allowRoot: workDir,
    remote: "upstream",
    token,
  });
  if (!fetchResult.ok) {
    throw new WisteriaError(fetchResult.stderr || "Failed to fetch upstream.", "GIT_FETCH_FAILED");
  }

  const checkoutNewBranch = await checkoutBranchFrom({
    cwd: workspacePath,
    allowRoot: workDir,
    branchName: params.branchName,
    startPoint: `upstream/${repoDetails.default_branch}`,
  });

  if (!checkoutNewBranch.ok) {
    const checkoutExisting = await checkoutBranch({
      cwd: workspacePath,
      allowRoot: workDir,
      branchName: params.branchName,
    });
    if (!checkoutExisting.ok) {
      throw new WisteriaError(
        checkoutNewBranch.stderr || checkoutExisting.stderr || "Failed to create contribution branch.",
        "GIT_CHECKOUT_FAILED",
      );
    }
    reusedExistingBranch = true;
    warnings.push("Reused an existing local branch with the requested name.");
  }

  const remotes = await collectRemoteMap(workspacePath, workDir);

  const result: PrepareContributionResult = {
    workspacePath,
    repoFullName: params.repoFullName,
    forkFullName: forkInfo.forkFullName,
    baseBranch: repoDetails.default_branch,
    branchName: params.branchName,
    remotes,
    reusedExistingClone,
    reusedExistingBranch,
    warnings,
    nextSteps: [
      `Open ${workspacePath}`,
      "Implement the issue changes locally",
      "Commit your work before requesting a Draft PR",
    ],
  };

  if (params.issueNumber !== undefined) {
    result.issueNumber = params.issueNumber;
  }

  return result;
}

export async function checkWorkspaceStatus(
  workspacePathInput: string,
  config: WisteriaConfig,
): Promise<WorkspaceCheckResult> {
  assertGitCommandsAllowed(config);

  const workspacePath = path.resolve(workspacePathInput);
  const allowRoot = resolveAllowedRoot(config, workspacePath);
  assertSafeWorkDir(workspacePath, allowRoot);

  if (!(await isGitRepository({ cwd: workspacePath, allowRoot }))) {
    return {
      isGitRepo: false,
      currentBranch: null,
      isClean: false,
      hasCommitsAhead: false,
      remotes: {},
      changedFiles: [],
      warnings: ["Workspace is not a Git repository."],
    };
  }

  const [branch, remotes, porcelain] = await Promise.all([
    getCurrentBranch({ cwd: workspacePath, allowRoot }),
    collectRemoteMap(workspacePath, allowRoot),
    getStatusPorcelain({ cwd: workspacePath, allowRoot }),
  ]);

  const changedFiles = porcelain.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.slice(3).trim())
    .filter(Boolean);

  const warnings: string[] = [];
  if (!branch || branch === "HEAD") {
    warnings.push("Workspace is in a detached HEAD state.");
  }

  let hasCommitsAhead = false;
  const upstreamRemote = remotes.upstream ? extractGitHubRepoFullName(remotes.upstream) : null;
  if (!upstreamRemote) {
    warnings.push("Upstream remote is missing.");
  } else {
    const ahead = await countCommitsAheadOfUpstream({
      cwd: workspacePath,
      allowRoot,
    });
    hasCommitsAhead = ahead > 0;
  }

  return {
    isGitRepo: true,
    currentBranch: branch,
    isClean: porcelain.stdout.trim().length === 0,
    hasCommitsAhead,
    remotes,
    changedFiles,
    warnings,
  };
}
