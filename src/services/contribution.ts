import { useAppStore } from '../store';
import type {
  ContributionProgressStep,
  CreateDraftPRFromSessionResult,
  Issue,
  IssueAnalysis,
  StartContributionResult,
} from '../types';
import {
  addPRHistory,
  getContributionSessionByIssueGitHubId,
  getSavedIssueByGitHubId,
  updateContributionSessionDraftPR,
  upsertContributionSession,
} from './database';
import {
  addRemote,
  checkout,
  checkoutBranchFrom,
  clone,
  countCommitsAhead,
  fetch,
  getCurrentBranch,
  getRemoteUrl,
  isGitAvailable,
  isWorkingTreeClean,
  listRemotes,
  pushWithUpstream,
  status,
} from './git';
import {
  createDraftPR,
  ensureForkExists,
  findOpenPullRequestByHead,
  getAuthenticatedUser,
  getRepoDefaultBranch,
} from './github';
import { inspectLocalPath } from './system';

type ProgressReporter = (step: ContributionProgressStep) => void;
type RepoPathState = 'missing' | 'git' | 'non_git';

class ContributionError extends Error {}

function reportStep(reporter: ProgressReporter | undefined, step: ContributionProgressStep) {
  reporter?.(step);
}

function splitRepoFullName(repoFullName: string): { owner: string; repo: string } {
  const parts = repoFullName.split('/');
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new ContributionError('当前 Issue 缺少有效的仓库信息。');
  }

  return {
    owner: parts[0],
    repo: parts[1],
  };
}

function toSlug(value: string): string {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);

  return normalized || 'update';
}

function buildBranchName(issue: Issue): string {
  return `issue-${issue.number}-${toSlug(issue.title)}`;
}

function buildLocalRepoPath(workDirectory: string, owner: string, repo: string): string {
  const base = workDirectory.trim().replace(/[\\/]+$/, '');
  const separator = base.includes('\\') ? '\\' : '/';
  return `${base}${separator}${owner}__${repo}`;
}

function buildGitHubRemoteUrl(repoFullName: string): string {
  return `https://github.com/${repoFullName}.git`;
}

function extractGitHubRepoFullName(remoteUrl: string | null): string | null {
  if (!remoteUrl) {
    return null;
  }

  const match = remoteUrl
    .trim()
    .match(/github\.com[:/](?<owner>[^/]+)\/(?<repo>[^/]+?)(?:\.git)?$/i);

  const owner = match?.groups?.owner;
  const repo = match?.groups?.repo;
  if (!owner || !repo) {
    return null;
  }

  return `${owner}/${repo}`;
}

function isMissingPathError(stderr: string): boolean {
  const message = stderr.toLowerCase();
  return (
    message.includes('cannot find the path') ||
    message.includes('no such file or directory') ||
    message.includes('system cannot find the file') ||
    message.includes('the directory name is invalid') ||
    message.includes('os error 267')
  );
}

function isNotGitRepositoryError(stderr: string): boolean {
  return stderr.toLowerCase().includes('not a git repository');
}

async function inspectRepoPath(repoDir: string): Promise<RepoPathState> {
  const pathInfo = await inspectLocalPath(repoDir);
  if (!pathInfo.exists) {
    return 'missing';
  }

  if (!pathInfo.isDir) {
    return 'non_git';
  }

  const result = await status(repoDir);
  if (result.success) {
    return 'git';
  }

  if (isMissingPathError(result.stderr)) {
    return 'missing';
  }

  if (isNotGitRepositoryError(result.stderr)) {
    return 'non_git';
  }

  throw new ContributionError(result.stderr || '无法识别本地仓库路径状态。');
}

async function ensureAuthenticatedUser() {
  const currentUser = useAppStore.getState().user;
  if (currentUser) {
    return currentUser;
  }

  const user = await getAuthenticatedUser();
  useAppStore.getState().setUser(user);
  return user;
}

async function ensurePreflight(issue: Issue) {
  if (!issue.repo_full_name) {
    throw new ContributionError('当前 Issue 缺少仓库信息，无法开始贡献。');
  }

  const settings = useAppStore.getState().settings;
  if (!settings.githubToken.trim()) {
    throw new ContributionError('请先在设置中配置并验证 GitHub Token。');
  }

  if (!(await isGitAvailable(settings.gitPath))) {
    throw new ContributionError('当前 Git 不可用，请先在设置中配置正确的 Git 可执行文件。');
  }

  const workDirectory = useAppStore.getState().workDirectory.trim();
  if (!workDirectory) {
    throw new ContributionError('请先在偏好设置中配置工作目录。');
  }

  const workDirectoryInfo = await inspectLocalPath(workDirectory);
  if (!workDirectoryInfo.exists) {
    throw new ContributionError('当前工作目录不存在，请先在偏好设置中重新选择一个有效目录。');
  }

  if (!workDirectoryInfo.isDir) {
    throw new ContributionError('当前工作目录不是文件夹，请先在偏好设置中重新选择一个有效目录。');
  }

  return {
    workDirectory,
    githubToken: settings.githubToken.trim(),
  };
}

async function ensureRemoteMatches(
  repoDir: string,
  remoteName: string,
  expectedRepoFullName: string,
  allowCreate: boolean
) {
  const existingUrl = await getRemoteUrl(repoDir, remoteName);
  if (!existingUrl) {
    if (!allowCreate) {
      throw new ContributionError(`本地仓库缺少 ${remoteName} remote。`);
    }

    const addResult = await addRemote(repoDir, remoteName, buildGitHubRemoteUrl(expectedRepoFullName));
    if (!addResult.success) {
      throw new ContributionError(addResult.stderr || `无法创建 ${remoteName} remote。`);
    }
    return;
  }

  const existingRepo = extractGitHubRepoFullName(existingUrl);
  if (existingRepo && existingRepo.toLowerCase() === expectedRepoFullName.toLowerCase()) {
    return;
  }

  throw new ContributionError(
    `本地仓库的 ${remoteName} remote 指向了其他仓库，请手动处理后再继续。`
  );
}

async function prepareExistingRepository(params: {
  repoDir: string;
  repoFullName: string;
  forkFullName: string;
}) {
  const repoState = await inspectRepoPath(params.repoDir);
  if (repoState === 'missing') {
    return false;
  }

  if (repoState === 'non_git') {
    throw new ContributionError('工作目录中已存在同名目录，但它不是 Git 仓库，请手动处理。');
  }

  const clean = await isWorkingTreeClean(params.repoDir);
  if (!clean) {
    throw new ContributionError('本地仓库存在未提交修改，请先提交、stash 或清理后再继续。');
  }

  const currentBranch = await getCurrentBranch(params.repoDir);
  if (!currentBranch || currentBranch === 'HEAD') {
    throw new ContributionError('本地仓库当前处于异常 HEAD 状态，请手动处理后再继续。');
  }

  const remoteNames = await listRemotes(params.repoDir);
  if (remoteNames.length === 0) {
    throw new ContributionError('本地仓库没有任何 remote，无法安全复用。');
  }

  const remoteUrls = await Promise.all(
    remoteNames.map(async (name) => ({
      name,
      url: await getRemoteUrl(params.repoDir, name),
    }))
  );

  const hasMatchingOrigin = remoteUrls.some(
    ({ url }) =>
      extractGitHubRepoFullName(url)?.toLowerCase() === params.repoFullName.toLowerCase()
  );

  if (!hasMatchingOrigin) {
    throw new ContributionError('当前目录中的仓库与这个 Issue 不匹配，已阻止继续复用。');
  }

  await ensureRemoteMatches(params.repoDir, 'upstream', params.repoFullName, true);
  await ensureRemoteMatches(params.repoDir, 'fork', params.forkFullName, true);
  return true;
}

function buildDraftPRBody(params: {
  issue: Issue;
  repoFullName: string;
  branchName: string;
  analysis?: IssueAnalysis | null;
}): string {
  const sections = [
    '## Summary',
    `- Source issue: ${params.issue.html_url}`,
    `- Repository: ${params.repoFullName}`,
    `- Branch: \`${params.branchName}\``,
    '',
    `Closes #${params.issue.number}`,
  ];

  if (params.analysis?.suggestedApproach) {
    sections.push('', '## Suggested approach', params.analysis.suggestedApproach);
  }

  return sections.join('\n');
}

export async function startContribution(
  issue: Issue,
  onProgress?: ProgressReporter
): Promise<StartContributionResult> {
  reportStep(onProgress, {
    key: 'preflight',
    label: '校验本地环境',
    status: 'running',
  });

  const { workDirectory, githubToken } = await ensurePreflight(issue);
  const { owner, repo } = splitRepoFullName(issue.repo_full_name ?? '');
  const localRepoPath = buildLocalRepoPath(workDirectory, owner, repo);
  const branchName = buildBranchName(issue);

  reportStep(onProgress, {
    key: 'preflight',
    label: '校验本地环境',
    detail: 'Git、GitHub Token 与工作目录已通过检查。',
    status: 'success',
  });

  reportStep(onProgress, {
    key: 'fork',
    label: '准备 GitHub Fork',
    status: 'running',
  });

  const fork = await ensureForkExists(owner, repo);

  reportStep(onProgress, {
    key: 'fork',
    label: '准备 GitHub Fork',
    detail: `已确认 Fork：${fork.full_name}`,
    status: 'success',
  });

  reportStep(onProgress, {
    key: 'repository',
    label: '准备本地仓库',
    status: 'running',
  });

  const reusedExisting = await prepareExistingRepository({
    repoDir: localRepoPath,
    repoFullName: issue.repo_full_name ?? '',
    forkFullName: fork.full_name,
  });

  let pushRemoteName = 'origin';

  if (!reusedExisting) {
    const cloneResult = await clone(buildGitHubRemoteUrl(fork.full_name), localRepoPath, githubToken);
    if (!cloneResult.success) {
      throw new ContributionError(cloneResult.stderr || '克隆 Fork 仓库失败。');
    }

    const upstreamResult = await addRemote(
      localRepoPath,
      'upstream',
      buildGitHubRemoteUrl(issue.repo_full_name ?? '')
    );
    if (!upstreamResult.success) {
      throw new ContributionError(upstreamResult.stderr || '添加 upstream remote 失败。');
    }
  } else {
    pushRemoteName = 'fork';
  }

  reportStep(onProgress, {
    key: 'repository',
    label: '准备本地仓库',
    detail: reusedExisting ? '已安全复用现有仓库。' : '已完成 Fork 仓库克隆。',
    status: 'success',
  });

  reportStep(onProgress, {
    key: 'branch',
    label: '创建贡献分支',
    status: 'running',
  });

  const baseBranch = await getRepoDefaultBranch(owner, repo);
  const fetchResult = await fetch(localRepoPath, 'upstream', githubToken);
  if (!fetchResult.success) {
    throw new ContributionError(fetchResult.stderr || '获取 upstream 最新代码失败。');
  }

  const checkoutResult = await checkoutBranchFrom(
    localRepoPath,
    branchName,
    `upstream/${baseBranch}`
  );
  if (!checkoutResult.success) {
    throw new ContributionError(checkoutResult.stderr || '创建贡献分支失败。');
  }

  await upsertContributionSession({
    issue_github_id: issue.id,
    repo_full_name: issue.repo_full_name ?? '',
    local_repo_path: localRepoPath,
    fork_full_name: fork.full_name,
    push_remote_name: pushRemoteName,
    base_branch: baseBranch,
    branch_name: branchName,
    pr_url: null,
    status: 'ready',
  });

  const session = await getContributionSessionByIssueGitHubId(issue.id);
  if (!session) {
    throw new ContributionError('贡献会话保存失败，请重试。');
  }

  reportStep(onProgress, {
    key: 'branch',
    label: '创建贡献分支',
    detail: `已在 ${localRepoPath} 准备分支 ${branchName}`,
    status: 'success',
  });

  return {
    session,
    localRepoPath,
    branchName,
  };
}

export async function createDraftPRFromSession(
  issue: Issue,
  analysis?: IssueAnalysis | null,
  onProgress?: ProgressReporter
): Promise<CreateDraftPRFromSessionResult> {
  reportStep(onProgress, {
    key: 'preflight',
    label: '校验贡献会话',
    status: 'running',
  });

  const { githubToken } = await ensurePreflight(issue);
  const session = await getContributionSessionByIssueGitHubId(issue.id);
  if (!session) {
    throw new ContributionError('当前 Issue 还没有贡献会话，请先点击“开始贡献”。');
  }

  const repoState = await inspectRepoPath(session.local_repo_path);
  if (repoState === 'missing') {
    throw new ContributionError('本地仓库目录不存在，请重新开始贡献流程。');
  }
  if (repoState === 'non_git') {
    throw new ContributionError('贡献目录已不是有效 Git 仓库，请重新开始贡献流程。');
  }

  reportStep(onProgress, {
    key: 'preflight',
    label: '校验贡献会话',
    detail: '贡献会话与本地仓库路径有效。',
    status: 'success',
  });

  reportStep(onProgress, {
    key: 'sync',
    label: '同步分支状态',
    status: 'running',
  });

  const checkoutResult = await checkout(session.local_repo_path, session.branch_name);
  if (!checkoutResult.success) {
    throw new ContributionError(checkoutResult.stderr || '切换到贡献分支失败。');
  }

  const clean = await isWorkingTreeClean(session.local_repo_path);
  if (!clean) {
    throw new ContributionError('本地仓库还有未提交修改，请先提交或 stash 后再起草 Draft PR。');
  }

  const fetchResult = await fetch(session.local_repo_path, 'upstream', githubToken);
  if (!fetchResult.success) {
    throw new ContributionError(fetchResult.stderr || '同步 upstream 失败。');
  }

  const aheadCount = await countCommitsAhead(
    session.local_repo_path,
    `upstream/${session.base_branch}`,
    session.branch_name
  );
  if (aheadCount < 1) {
    throw new ContributionError('请先完成至少一次本地提交，再起草 Draft PR。');
  }

  reportStep(onProgress, {
    key: 'sync',
    label: '同步分支状态',
    detail: `当前分支已领先 ${aheadCount} 个提交。`,
    status: 'success',
  });

  reportStep(onProgress, {
    key: 'push',
    label: '推送贡献分支',
    status: 'running',
  });

  const pushResult = await pushWithUpstream(
    session.local_repo_path,
    session.push_remote_name,
    session.branch_name,
    githubToken
  );
  if (!pushResult.success) {
    throw new ContributionError(pushResult.stderr || '推送贡献分支失败。');
  }

  reportStep(onProgress, {
    key: 'push',
    label: '推送贡献分支',
    detail: `已推送到 ${session.push_remote_name}/${session.branch_name}`,
    status: 'success',
  });

  reportStep(onProgress, {
    key: 'pr',
    label: '起草 Draft PR',
    status: 'running',
  });

  const currentUser = await ensureAuthenticatedUser();
  const { owner, repo } = splitRepoFullName(session.repo_full_name);
  const headRef = `${currentUser.login}:${session.branch_name}`;

  const existingPR = await findOpenPullRequestByHead({
    owner,
    repo,
    head: headRef,
  });

  const prUrl = existingPR
    ? existingPR.html_url
    : (
        await createDraftPR({
          owner,
          repo,
          title: `Draft: #${issue.number} ${issue.title}`,
          body: buildDraftPRBody({
            issue,
            repoFullName: session.repo_full_name,
            branchName: session.branch_name,
            analysis,
          }),
          head: headRef,
          base: session.base_branch,
        })
      ).html_url;

  await updateContributionSessionDraftPR(issue.id, prUrl);

  const savedIssue = await getSavedIssueByGitHubId(issue.id);
  await addPRHistory({
    issue_id: savedIssue?.id ?? null,
    repo_full_name: session.repo_full_name,
    pr_url: prUrl,
    branch_name: session.branch_name,
    status: 'draft',
  });

  const updatedSession = await getContributionSessionByIssueGitHubId(issue.id);
  if (!updatedSession) {
    throw new ContributionError('Draft PR 已创建，但本地会话状态更新失败。');
  }

  reportStep(onProgress, {
    key: 'pr',
    label: '起草 Draft PR',
    detail: existingPR ? '已复用现有的开放 PR。' : '已成功创建新的 Draft PR。',
    status: 'success',
  });

  return {
    session: updatedSession,
    prUrl,
    reusedExisting: !!existingPR,
  };
}

export function getContributionErrorMessage(error: unknown): string {
  if (error instanceof ContributionError) {
    return error.message;
  }

  return String(error);
}
