import { invoke } from '@tauri-apps/api/core';
import { getSetting } from './database';
import { useAppStore } from '../store';

export interface GitResult {
  success: boolean;
  stdout: string;
  stderr: string;
}

interface RunGitCommandInput {
  args: string[];
  cwd?: string | null;
  gitPath?: string | null;
}

async function resolveGitPath(overridePath?: string): Promise<string | undefined> {
  const directPath = overridePath?.trim();
  if (directPath) {
    return directPath;
  }

  const storePath = useAppStore.getState().settings.gitPath.trim();
  if (storePath) {
    return storePath;
  }

  const savedPath = (await getSetting('gitPath'))?.trim();
  if (savedPath) {
    useAppStore.getState().setSettings({ gitPath: savedPath });
    return savedPath;
  }

  return undefined;
}

async function resolveGitHubToken(overrideToken?: string): Promise<string | undefined> {
  const directToken = overrideToken?.trim();
  if (directToken) {
    return directToken;
  }

  const storeToken = useAppStore.getState().settings.githubToken.trim();
  if (storeToken) {
    return storeToken;
  }

  const savedToken = (await getSetting('githubToken'))?.trim();
  if (savedToken) {
    useAppStore.getState().setSettings({ githubToken: savedToken });
    return savedToken;
  }

  return undefined;
}

async function buildGitHubAuthArgs(overrideToken?: string): Promise<string[]> {
  const token = await resolveGitHubToken(overrideToken);
  if (!token) {
    return [];
  }

  const encoded = btoa(`x-access-token:${token}`);
  return ['-c', `http.https://github.com/.extraheader=AUTHORIZATION: basic ${encoded}`];
}

async function runGit(
  args: string[],
  cwd?: string,
  overridePath?: string,
  prefixArgs: string[] = []
): Promise<GitResult> {
  try {
    const gitPath = await resolveGitPath(overridePath);
    return await invoke<GitResult>('run_git_command', {
      input: {
        args: [...prefixArgs, ...args],
        cwd: cwd ?? null,
        gitPath: gitPath ?? null,
      } satisfies RunGitCommandInput,
    });
  } catch (err) {
    return {
      success: false,
      stdout: '',
      stderr: String(err),
    };
  }
}

async function runGitWithGitHubAuth(
  args: string[],
  cwd?: string,
  overridePath?: string,
  overrideToken?: string
): Promise<GitResult> {
  const authArgs = await buildGitHubAuthArgs(overrideToken);
  return runGit(args, cwd, overridePath, authArgs);
}

export async function isGitAvailable(gitPath?: string): Promise<boolean> {
  const result = await runGit(['--version'], undefined, gitPath);
  return result.success;
}

export async function clone(url: string, targetDir: string, githubToken?: string): Promise<GitResult> {
  return runGitWithGitHubAuth(['clone', url, targetDir], undefined, undefined, githubToken);
}

export async function checkoutNewBranch(repoDir: string, branchName: string): Promise<GitResult> {
  return runGit(['checkout', '-b', branchName], repoDir);
}

export async function checkout(repoDir: string, branchName: string): Promise<GitResult> {
  return runGit(['checkout', branchName], repoDir);
}

export async function checkoutBranchFrom(
  repoDir: string,
  branchName: string,
  startPoint: string
): Promise<GitResult> {
  return runGit(['checkout', '-B', branchName, startPoint], repoDir);
}

export async function addAll(repoDir: string): Promise<GitResult> {
  return runGit(['add', '-A'], repoDir);
}

export async function commit(repoDir: string, message: string): Promise<GitResult> {
  return runGit(['commit', '-m', message], repoDir);
}

export async function push(repoDir: string, remote: string, branch: string): Promise<GitResult> {
  return runGit(['push', remote, branch], repoDir);
}

export async function pushWithUpstream(
  repoDir: string,
  remote: string,
  branch: string,
  githubToken?: string
): Promise<GitResult> {
  return runGitWithGitHubAuth(['push', '-u', remote, branch], repoDir, undefined, githubToken);
}

export async function addRemote(repoDir: string, name: string, url: string): Promise<GitResult> {
  return runGit(['remote', 'add', name, url], repoDir);
}

export async function fetch(repoDir: string, remote?: string, githubToken?: string): Promise<GitResult> {
  return runGitWithGitHubAuth(
    remote ? ['fetch', remote, '--prune'] : ['fetch', '--all', '--prune'],
    repoDir,
    undefined,
    githubToken
  );
}

export async function listRemotes(repoDir: string): Promise<string[]> {
  const result = await runGit(['remote'], repoDir);
  if (!result.success || !result.stdout.trim()) {
    return [];
  }

  return result.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export async function getRemoteUrl(repoDir: string, name: string): Promise<string | null> {
  const result = await runGit(['remote', 'get-url', name], repoDir);
  if (!result.success) {
    return null;
  }

  const value = result.stdout.trim();
  return value || null;
}

export async function setRemoteUrl(repoDir: string, name: string, url: string): Promise<GitResult> {
  const existing = await getRemoteUrl(repoDir, name);
  if (existing) {
    return runGit(['remote', 'set-url', name, url], repoDir);
  }

  return addRemote(repoDir, name, url);
}

export async function getCurrentBranch(repoDir: string): Promise<string> {
  const result = await runGit(['rev-parse', '--abbrev-ref', 'HEAD'], repoDir);
  return result.stdout.trim();
}

export async function isGitRepository(repoDir: string): Promise<boolean> {
  const result = await runGit(['rev-parse', '--is-inside-work-tree'], repoDir);
  return result.success && result.stdout.trim() === 'true';
}

export async function status(repoDir: string): Promise<GitResult> {
  return runGit(['status', '--porcelain'], repoDir);
}

export async function isWorkingTreeClean(repoDir: string): Promise<boolean> {
  const result = await status(repoDir);
  return result.success && result.stdout.trim() === '';
}

export async function countCommitsAhead(
  repoDir: string,
  baseRef: string,
  headRef: string
): Promise<number> {
  const result = await runGit(['rev-list', '--count', `${baseRef}..${headRef}`], repoDir);
  if (!result.success) {
    return 0;
  }

  const count = Number.parseInt(result.stdout.trim(), 10);
  return Number.isNaN(count) ? 0 : count;
}

export async function getGitVersion(gitPath?: string): Promise<string> {
  const result = await runGit(['--version'], undefined, gitPath);
  return result.stdout;
}
