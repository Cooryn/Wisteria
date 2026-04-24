import { invoke } from '@tauri-apps/api/core';
import type {
  ContributionSession,
  PRHistoryEntry,
  SavedIssue,
  SavedRepo,
  TechTag,
} from '../types';

// ---- App Settings ----

export async function setSetting(key: string, value: string): Promise<void> {
  return invoke<void>('db_set_setting', { key, value });
}

export async function getAllSettings(): Promise<Record<string, string>> {
  return invoke<Record<string, string>>('db_get_all_settings');
}

// ---- Tech Tags ----

export async function getTechTags(): Promise<TechTag[]> {
  return invoke<TechTag[]>('db_get_tech_tags');
}

export async function saveTechTag(tag: TechTag): Promise<void> {
  return invoke<void>('db_save_tech_tag', {
    name: tag.name,
    category: tag.category,
    weight: tag.weight,
  });
}

export async function clearTechTags(): Promise<void> {
  return invoke<void>('db_clear_tech_tags');
}

// ---- Saved Repos ----

export async function getSavedRepos(): Promise<SavedRepo[]> {
  return invoke<SavedRepo[]>('db_get_saved_repos');
}

// ---- Saved Issues ----

export async function getSavedIssues(): Promise<SavedIssue[]> {
  return invoke<SavedIssue[]>('db_get_saved_issues');
}

export async function getSavedIssueByGitHubId(githubId: number): Promise<SavedIssue | null> {
  return invoke<SavedIssue | null>('db_get_saved_issue_by_github_id', { githubId });
}

export async function saveIssue(issue: SavedIssue): Promise<void> {
  return invoke<void>('db_save_issue', {
    issue: {
      githubId: issue.github_id,
      repoFullName: issue.repo_full_name,
      issueNumber: issue.issue_number,
      title: issue.title,
      body: issue.body,
      labels: issue.labels,
      state: issue.state,
      htmlUrl: issue.html_url,
      comments: issue.comments,
      userLogin: issue.user_login,
      userAvatarUrl: issue.user_avatar_url,
      createdAt: issue.created_at,
      updatedAt: issue.updated_at,
      score: issue.score,
      analysis: issue.analysis,
    },
  });
}

// ---- PR History ----

export async function getPRHistory(): Promise<PRHistoryEntry[]> {
  return invoke<PRHistoryEntry[]>('db_get_pr_history');
}

export async function addPRHistory(entry: Omit<PRHistoryEntry, 'id' | 'created_at'>): Promise<void> {
  return invoke<void>('db_add_pr_history', {
    issueId: entry.issue_id,
    repoFullName: entry.repo_full_name,
    prUrl: entry.pr_url,
    branchName: entry.branch_name,
    status: entry.status,
  });
}

// ---- Contribution Sessions ----

export async function getContributionSessionByIssueGitHubId(
  issueGitHubId: number
): Promise<ContributionSession | null> {
  return invoke<ContributionSession | null>('db_get_contribution_session', { issueGithubId: issueGitHubId });
}

export async function upsertContributionSession(
  session: Omit<ContributionSession, 'id' | 'created_at' | 'updated_at'>
): Promise<void> {
  return invoke<void>('db_upsert_contribution_session', {
    session: {
      issueGithubId: session.issue_github_id,
      repoFullName: session.repo_full_name,
      localRepoPath: session.local_repo_path,
      forkFullName: session.fork_full_name,
      pushRemoteName: session.push_remote_name,
      baseBranch: session.base_branch,
      branchName: session.branch_name,
      prUrl: session.pr_url,
      status: session.status,
    },
  });
}

export async function updateContributionSessionDraftPR(
  issueGitHubId: number,
  prUrl: string
): Promise<void> {
  return invoke<void>('db_update_contribution_session_pr', { issueGithubId: issueGitHubId, prUrl });
}

// ---- Preferences (simple key-value) ----

export async function getPreference(key: string): Promise<string | null> {
  return invoke<string | null>('db_get_preference', { key });
}

export async function setPreference(key: string, value: string): Promise<void> {
  return invoke<void>('db_set_preference', { key, value });
}
