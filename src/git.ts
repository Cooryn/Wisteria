import { Buffer } from "node:buffer";
import { runPluginCommandWithTimeout } from "openclaw/plugin-sdk/run-command";

import { WisteriaError } from "./errors.js";
import { assertSafeWorkDir, redactSecrets } from "./safety.js";
import type { GitCommandResult, GitRunOptions } from "./types.js";

const DEFAULT_TIMEOUT_MS = 60_000;

function buildGitHubAuthArgs(token?: string): { args: string[]; secrets: string[] } {
  if (!token?.trim()) {
    return { args: [], secrets: [] };
  }

  const trimmed = token.trim();
  const basic = Buffer.from(`x-access-token:${trimmed}`, "utf8").toString("base64");
  return {
    args: [
      "-c",
      `http.https://github.com/.extraheader=AUTHORIZATION: basic ${basic}`,
    ],
    secrets: [trimmed, basic],
  };
}

export async function runGit(
  args: string[],
  options: GitRunOptions,
): Promise<GitCommandResult> {
  assertSafeWorkDir(options.cwd, options.allowRoot);

  try {
    const result = await runPluginCommandWithTimeout({
      argv: ["git", ...args],
      cwd: options.cwd,
      timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    });

    return {
      ok: result.code === 0,
      stdout: redactSecrets(result.stdout, options.secrets),
      stderr: redactSecrets(result.stderr, options.secrets),
      exitCode: result.code,
    };
  } catch (error) {
    throw new WisteriaError(
      error instanceof Error ? error.message : "Failed to run git command.",
      "GIT_SPAWN_FAILED",
    );
  }
}

export async function isGitAvailable(): Promise<boolean> {
  try {
    const result = await runGit(["--version"], {
      cwd: process.cwd(),
      allowRoot: process.cwd(),
      timeoutMs: 10_000,
    });
    return result.ok;
  } catch {
    return false;
  }
}

export async function cloneRepository(params: {
  repoUrl: string;
  targetDir: string;
  allowRoot: string;
  token?: string;
}): Promise<GitCommandResult> {
  const auth = buildGitHubAuthArgs(params.token);
  return runGit([...auth.args, "clone", params.repoUrl, params.targetDir], {
    cwd: params.allowRoot,
    allowRoot: params.allowRoot,
    secrets: auth.secrets,
  });
}

export async function fetchRemote(params: {
  cwd: string;
  allowRoot: string;
  remote: string;
  token?: string;
}): Promise<GitCommandResult> {
  const auth = buildGitHubAuthArgs(params.token);
  return runGit([...auth.args, "fetch", params.remote], {
    cwd: params.cwd,
    allowRoot: params.allowRoot,
    secrets: auth.secrets,
  });
}

export async function checkoutBranch(params: {
  cwd: string;
  allowRoot: string;
  branchName: string;
}): Promise<GitCommandResult> {
  return runGit(["checkout", params.branchName], {
    cwd: params.cwd,
    allowRoot: params.allowRoot,
  });
}

export async function checkoutBranchFrom(params: {
  cwd: string;
  allowRoot: string;
  branchName: string;
  startPoint: string;
}): Promise<GitCommandResult> {
  return runGit(["checkout", "-b", params.branchName, params.startPoint], {
    cwd: params.cwd,
    allowRoot: params.allowRoot,
  });
}

export async function addRemote(params: {
  cwd: string;
  allowRoot: string;
  name: string;
  url: string;
}): Promise<GitCommandResult> {
  return runGit(["remote", "add", params.name, params.url], {
    cwd: params.cwd,
    allowRoot: params.allowRoot,
  });
}

export async function setRemoteUrl(params: {
  cwd: string;
  allowRoot: string;
  name: string;
  url: string;
}): Promise<GitCommandResult> {
  return runGit(["remote", "set-url", params.name, params.url], {
    cwd: params.cwd,
    allowRoot: params.allowRoot,
  });
}

export async function listRemotes(params: {
  cwd: string;
  allowRoot: string;
}): Promise<string[]> {
  const result = await runGit(["remote"], {
    cwd: params.cwd,
    allowRoot: params.allowRoot,
  });

  if (!result.ok) {
    return [];
  }

  return result.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export async function getRemoteUrl(params: {
  cwd: string;
  allowRoot: string;
  name: string;
}): Promise<string | null> {
  const result = await runGit(["remote", "get-url", params.name], {
    cwd: params.cwd,
    allowRoot: params.allowRoot,
  });

  return result.ok ? result.stdout.trim() || null : null;
}

export async function getCurrentBranch(params: {
  cwd: string;
  allowRoot: string;
}): Promise<string | null> {
  const result = await runGit(["rev-parse", "--abbrev-ref", "HEAD"], {
    cwd: params.cwd,
    allowRoot: params.allowRoot,
  });

  return result.ok ? result.stdout.trim() || null : null;
}

export async function getStatusPorcelain(params: {
  cwd: string;
  allowRoot: string;
}): Promise<GitCommandResult> {
  return runGit(["status", "--porcelain"], {
    cwd: params.cwd,
    allowRoot: params.allowRoot,
  });
}

export async function isWorkingTreeClean(params: {
  cwd: string;
  allowRoot: string;
}): Promise<boolean> {
  const result = await getStatusPorcelain(params);
  return result.ok && result.stdout.trim().length === 0;
}

export async function countCommitsAhead(params: {
  cwd: string;
  allowRoot: string;
  baseRef: string;
  headRef: string;
}): Promise<number> {
  const result = await runGit(
    ["rev-list", "--count", `${params.baseRef}..${params.headRef}`],
    {
      cwd: params.cwd,
      allowRoot: params.allowRoot,
    },
  );

  if (!result.ok) {
    return 0;
  }

  const parsed = Number.parseInt(result.stdout.trim(), 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function countCommitsAheadOfUpstream(params: {
  cwd: string;
  allowRoot: string;
}): Promise<number> {
  const result = await runGit(["rev-list", "--count", "@{upstream}..HEAD"], {
    cwd: params.cwd,
    allowRoot: params.allowRoot,
  });

  if (!result.ok) {
    return 0;
  }

  const parsed = Number.parseInt(result.stdout.trim(), 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function pushBranch(params: {
  cwd: string;
  allowRoot: string;
  remote: string;
  branchName: string;
  token?: string;
}): Promise<GitCommandResult> {
  const auth = buildGitHubAuthArgs(params.token);
  return runGit(
    [...auth.args, "push", "--set-upstream", params.remote, params.branchName],
    {
      cwd: params.cwd,
      allowRoot: params.allowRoot,
      secrets: auth.secrets,
    },
  );
}

export async function isGitRepository(params: {
  cwd: string;
  allowRoot: string;
}): Promise<boolean> {
  const result = await runGit(["rev-parse", "--is-inside-work-tree"], {
    cwd: params.cwd,
    allowRoot: params.allowRoot,
  });

  return result.ok && result.stdout.trim() === "true";
}
