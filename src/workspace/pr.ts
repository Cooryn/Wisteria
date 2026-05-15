import path from "node:path";

import { ensureGitHubToken } from "../core/config.js";
import {
  createDraftPullRequest,
  createGitHubClient,
  ensureForkExists,
  extractGitHubRepoFullName,
  getRepoDetails,
  splitRepoFullName,
} from "../github/client.js";
import {
  addRemote,
  countCommitsAhead,
  fetchRemote,
  getCurrentBranch,
  getRemoteUrl,
  isGitAvailable,
  isGitRepository,
  isWorkingTreeClean,
  pushBranch,
  setRemoteUrl,
} from "./git.js";
import { WisteriaError } from "../core/errors.js";
import { assertGitCommandsAllowed, assertSafeWorkDir, sanitizePrBody } from "../core/safety.js";
import type {
  CreateDraftPrParams,
  CreateDraftPrResult,
  WisteriaConfig,
} from "../core/types.js";

function resolveAllowedRoot(config: WisteriaConfig, workspacePath: string): string {
  return config.defaultWorkDir ? path.resolve(config.defaultWorkDir) : path.resolve(workspacePath);
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

function githubRemoteUrl(repoFullName: string): string {
  return `https://github.com/${repoFullName}.git`;
}

export async function createDraftPrFromWorkspace(
  params: CreateDraftPrParams,
  config: WisteriaConfig,
): Promise<CreateDraftPrResult> {
  assertGitCommandsAllowed(config);

  const token = ensureGitHubToken(config);
  if (!token) {
    throw new WisteriaError("GitHub token is required.", "GITHUB_TOKEN_REQUIRED");
  }

  if (!(await isGitAvailable())) {
    throw new WisteriaError("Git is not available on this system.", "GIT_NOT_AVAILABLE");
  }

  const workspacePath = path.resolve(params.workspacePath);
  const allowRoot = resolveAllowedRoot(config, workspacePath);
  assertSafeWorkDir(workspacePath, allowRoot);

  if (!(await isGitRepository({ cwd: workspacePath, allowRoot }))) {
    throw new WisteriaError("Workspace is not a Git repository.", "WORKSPACE_NOT_GIT_REPO");
  }

  const currentBranch = await getCurrentBranch({ cwd: workspacePath, allowRoot });
  if (currentBranch !== params.branchName) {
    throw new WisteriaError(
      `Workspace is on branch ${currentBranch ?? "unknown"}, expected ${params.branchName}.`,
      "BRANCH_MISMATCH",
    );
  }

  if (!(await isWorkingTreeClean({ cwd: workspacePath, allowRoot }))) {
    throw new WisteriaError(
      "Workspace has uncommitted changes. Commit or stash them before creating a Draft PR.",
      "DIRTY_WORKSPACE",
    );
  }

  const client = createGitHubClient(token);
  const repoDetails = await getRepoDetails(client, params.repoFullName);
  const forkInfo = await ensureForkExists(client, params.repoFullName);

  const originUrl = await getRemoteUrl({ cwd: workspacePath, allowRoot, name: "origin" });
  const upstreamUrl = await getRemoteUrl({ cwd: workspacePath, allowRoot, name: "upstream" });
  const knownRepos = new Set(
    [originUrl, upstreamUrl]
      .map((remoteUrl) => extractGitHubRepoFullName(remoteUrl))
      .filter((value): value is string => Boolean(value))
      .map((value) => value.toLowerCase()),
  );

  if (!knownRepos.has(params.repoFullName.toLowerCase())) {
    throw new WisteriaError(
      "Workspace remotes do not match the requested repository.",
      "WORKSPACE_REPO_MISMATCH",
    );
  }

  await ensureRemote({
    workspacePath,
    allowRoot,
    name: "upstream",
    url: githubRemoteUrl(params.repoFullName),
  });
  const forkRemoteName =
    extractGitHubRepoFullName(originUrl)?.toLowerCase() ===
    forkInfo.forkFullName.toLowerCase()
      ? "origin"
      : "fork";
  if (forkRemoteName === "fork") {
    await ensureRemote({
      workspacePath,
      allowRoot,
      name: "fork",
      url: githubRemoteUrl(forkInfo.forkFullName),
    });
  }

  const fetchResult = await fetchRemote({
    cwd: workspacePath,
    allowRoot,
    remote: "upstream",
    token,
  });
  if (!fetchResult.ok) {
    throw new WisteriaError(fetchResult.stderr || "Failed to fetch upstream.", "GIT_FETCH_FAILED");
  }

  const baseBranch = params.baseBranch ?? repoDetails.default_branch;
  const aheadCount = await countCommitsAhead({
    cwd: workspacePath,
    allowRoot,
    baseRef: `upstream/${baseBranch}`,
    headRef: params.branchName,
  });
  if (aheadCount < 1) {
    throw new WisteriaError(
      "At least one local commit is required before creating a Draft PR.",
      "NO_LOCAL_COMMITS",
    );
  }

  const pushResult = await pushBranch({
    cwd: workspacePath,
    allowRoot,
    remote: forkRemoteName,
    branchName: params.branchName,
    token,
  });
  if (!pushResult.ok) {
    throw new WisteriaError(pushResult.stderr || "Failed to push branch.", "GIT_PUSH_FAILED");
  }

  const headRef = `${splitRepoFullName(forkInfo.forkFullName).owner}:${params.branchName}`;
  return createDraftPullRequest(client, {
    repoFullName: params.repoFullName,
    head: headRef,
    base: baseBranch,
    title: params.title,
    body: sanitizePrBody(params.body),
  });
}
