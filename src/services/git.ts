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

async function runGit(args: string[], cwd?: string, overridePath?: string): Promise<GitResult> {
  try {
    const gitPath = await resolveGitPath(overridePath);
    return await invoke<GitResult>('run_git_command', {
      input: {
        args,
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

export async function isGitAvailable(gitPath?: string): Promise<boolean> {
  const result = await runGit(['--version'], undefined, gitPath);
  return result.success;
}

export async function clone(url: string, targetDir: string): Promise<GitResult> {
  return runGit(['clone', url, targetDir]);
}

export async function checkoutNewBranch(repoDir: string, branchName: string): Promise<GitResult> {
  return runGit(['checkout', '-b', branchName], repoDir);
}

export async function checkout(repoDir: string, branchName: string): Promise<GitResult> {
  return runGit(['checkout', branchName], repoDir);
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

export async function addRemote(repoDir: string, name: string, url: string): Promise<GitResult> {
  return runGit(['remote', 'add', name, url], repoDir);
}

export async function getCurrentBranch(repoDir: string): Promise<string> {
  const result = await runGit(['rev-parse', '--abbrev-ref', 'HEAD'], repoDir);
  return result.stdout;
}

export async function status(repoDir: string): Promise<GitResult> {
  return runGit(['status', '--porcelain'], repoDir);
}

export async function getGitVersion(gitPath?: string): Promise<string> {
  const result = await runGit(['--version'], undefined, gitPath);
  return result.stdout;
}
