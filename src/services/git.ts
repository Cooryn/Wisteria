import { invoke } from '@tauri-apps/api/core';

export interface GitResult {
  success: boolean;
  stdout: string;
  stderr: string;
}

export async function isGitAvailable(gitPath?: string): Promise<boolean> {
  return invoke<boolean>('git_is_available', { gitPath: gitPath ?? null });
}

export async function getGitVersion(gitPath?: string): Promise<string> {
  return invoke<string>('git_get_version', { gitPath: gitPath ?? null });
}

export async function clone(url: string, targetDir: string, githubToken?: string): Promise<GitResult> {
  return invoke<GitResult>('git_clone', { url, targetDir, githubToken: githubToken ?? null });
}

export async function checkoutNewBranch(repoDir: string, branchName: string): Promise<GitResult> {
  return invoke<GitResult>('git_checkout_new_branch', { repoDir, branchName });
}

export async function checkout(repoDir: string, branchName: string): Promise<GitResult> {
  return invoke<GitResult>('git_checkout', { repoDir, branchName });
}

export async function checkoutBranchFrom(
  repoDir: string,
  branchName: string,
  startPoint: string
): Promise<GitResult> {
  return invoke<GitResult>('git_checkout_branch_from', { repoDir, branchName, startPoint });
}

export async function addAll(repoDir: string): Promise<GitResult> {
  return invoke<GitResult>('git_add_all', { repoDir });
}

export async function commit(repoDir: string, message: string): Promise<GitResult> {
  return invoke<GitResult>('git_commit', { repoDir, message });
}

export async function push(repoDir: string, remote: string, branch: string): Promise<GitResult> {
  return invoke<GitResult>('git_push', { repoDir, remote, branch });
}

export async function pushWithUpstream(
  repoDir: string,
  remote: string,
  branch: string,
  githubToken?: string
): Promise<GitResult> {
  return invoke<GitResult>('git_push_with_upstream', {
    repoDir,
    remote,
    branch,
    githubToken: githubToken ?? null,
  });
}

export async function addRemote(repoDir: string, name: string, url: string): Promise<GitResult> {
  return invoke<GitResult>('git_add_remote', { repoDir, name, url });
}

export async function fetch(repoDir: string, remote?: string, githubToken?: string): Promise<GitResult> {
  return invoke<GitResult>('git_fetch', {
    repoDir,
    remote: remote ?? null,
    githubToken: githubToken ?? null,
  });
}

export async function listRemotes(repoDir: string): Promise<string[]> {
  return invoke<string[]>('git_list_remotes', { repoDir });
}

export async function getRemoteUrl(repoDir: string, name: string): Promise<string | null> {
  return invoke<string | null>('git_get_remote_url', { repoDir, name });
}

export async function setRemoteUrl(repoDir: string, name: string, url: string): Promise<GitResult> {
  return invoke<GitResult>('git_set_remote_url', { repoDir, name, url });
}

export async function getCurrentBranch(repoDir: string): Promise<string> {
  return invoke<string>('git_get_current_branch', { repoDir });
}

export async function isGitRepository(repoDir: string): Promise<boolean> {
  return invoke<boolean>('git_is_repository', { repoDir });
}

export async function status(repoDir: string): Promise<GitResult> {
  return invoke<GitResult>('git_status', { repoDir });
}

export async function isWorkingTreeClean(repoDir: string): Promise<boolean> {
  return invoke<boolean>('git_is_working_tree_clean', { repoDir });
}

export async function countCommitsAhead(
  repoDir: string,
  baseRef: string,
  headRef: string
): Promise<number> {
  return invoke<number>('git_count_commits_ahead', { repoDir, baseRef, headRef });
}
