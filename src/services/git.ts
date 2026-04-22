import { Command } from '@tauri-apps/plugin-shell';

export interface GitResult {
  success: boolean;
  stdout: string;
  stderr: string;
}

async function runGit(args: string[], cwd?: string): Promise<GitResult> {
  try {
    const cmd = cwd
      ? Command.create('git', ['-C', cwd, ...args])
      : Command.create('git', args);

    const output = await cmd.execute();
    return {
      success: output.code === 0,
      stdout: output.stdout.trim(),
      stderr: output.stderr.trim(),
    };
  } catch (err) {
    return {
      success: false,
      stdout: '',
      stderr: String(err),
    };
  }
}

// ---- Check if git is installed ----
export async function isGitAvailable(): Promise<boolean> {
  const result = await runGit(['--version']);
  return result.success;
}

// ---- Clone a repository ----
export async function clone(url: string, targetDir: string): Promise<GitResult> {
  return runGit(['clone', url, targetDir]);
}

// ---- Create and checkout a new branch ----
export async function checkoutNewBranch(repoDir: string, branchName: string): Promise<GitResult> {
  return runGit(['checkout', '-b', branchName], repoDir);
}

// ---- Checkout existing branch ----
export async function checkout(repoDir: string, branchName: string): Promise<GitResult> {
  return runGit(['checkout', branchName], repoDir);
}

// ---- Stage files ----
export async function addAll(repoDir: string): Promise<GitResult> {
  return runGit(['add', '-A'], repoDir);
}

// ---- Commit ----
export async function commit(repoDir: string, message: string): Promise<GitResult> {
  return runGit(['commit', '-m', message], repoDir);
}

// ---- Push ----
export async function push(repoDir: string, remote: string, branch: string): Promise<GitResult> {
  return runGit(['push', remote, branch], repoDir);
}

// ---- Set remote ----
export async function addRemote(repoDir: string, name: string, url: string): Promise<GitResult> {
  return runGit(['remote', 'add', name, url], repoDir);
}

// ---- Get current branch ----
export async function getCurrentBranch(repoDir: string): Promise<string> {
  const result = await runGit(['rev-parse', '--abbrev-ref', 'HEAD'], repoDir);
  return result.stdout;
}

// ---- Get status ----
export async function status(repoDir: string): Promise<GitResult> {
  return runGit(['status', '--porcelain'], repoDir);
}

// ---- Get git version ----
export async function getGitVersion(): Promise<string> {
  const result = await runGit(['--version']);
  return result.stdout;
}
