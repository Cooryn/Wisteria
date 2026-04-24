// ==========================================
// Wisteria — TypeScript Type Definitions
// ==========================================

// ---- Theme ----
export type ThemeMode = 'light' | 'dark' | 'system';

// ---- Tech Tags ----
export type TagCategory = 'language' | 'framework' | 'tool';

export interface TechTag {
  id?: number;
  name: string;
  category: TagCategory;
  weight: number; // 0.0 - 1.0
}

// ---- GitHub Repo ----
export interface Repo {
  id: number;
  full_name: string;
  name: string;
  owner: {
    login: string;
    avatar_url: string;
  };
  description: string | null;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  topics: string[];
  html_url: string;
  updated_at: string;
  created_at: string;
  license: { spdx_id: string; name: string } | null;
}

// ---- GitHub Issue ----
export interface Issue {
  id: number;
  number: number;
  title: string;
  body: string | null;
  state: string;
  labels: IssueLabel[];
  html_url: string;
  created_at: string;
  updated_at: string;
  comments: number;
  user: {
    login: string;
    avatar_url: string;
  };
  repo_full_name?: string;
}

export interface IssueLabel {
  id: number;
  name: string;
  color: string;
  description: string | null;
}

// ---- Saved entities (from DB) ----
export interface SavedRepo {
  id: number;
  github_id: number;
  full_name: string;
  description: string | null;
  language: string | null;
  stars: number;
  topics: string; // JSON string
  score: number | null;
  saved_at: string;
}

export interface SavedIssue {
  id: number;
  github_id: number;
  repo_full_name: string;
  issue_number: number | null;
  title: string;
  body: string | null;
  labels: string; // JSON string
  state: string;
  html_url: string | null;
  comments: number | null;
  user_login: string | null;
  user_avatar_url: string | null;
  created_at: string | null;
  updated_at: string | null;
  score: number | null;
  analysis: string | null;
  saved_at: string;
}

// ---- PR History ----
export interface PRHistoryEntry {
  id: number;
  issue_id: number | null;
  repo_full_name: string;
  pr_url: string | null;
  branch_name: string | null;
  status: 'draft' | 'open' | 'merged' | 'closed';
  created_at: string;
}

export type ContributionSessionStatus = 'ready' | 'draft_created';

export interface ContributionSession {
  id: number;
  issue_github_id: number;
  repo_full_name: string;
  local_repo_path: string;
  fork_full_name: string;
  push_remote_name: string;
  base_branch: string;
  branch_name: string;
  pr_url: string | null;
  status: ContributionSessionStatus;
  created_at: string;
  updated_at: string;
}

// ---- Scoring ----
export interface ScoreBreakdown {
  languageMatch: number;
  techStackMatch: number;
  activeness: number;
  community: number;
  issueFriendliness: number;
  freshness: number;
}

export interface ScoreResult {
  total: number; // 0 - 100
  breakdown: ScoreBreakdown;
  matchedTags: string[];
  recommendation: string;
}

// ---- Issue Analysis (LLM) ----
export interface IssueAnalysis {
  difficulty: 'easy' | 'medium' | 'hard';
  estimatedTime: string;
  suggestedApproach: string;
  relatedFiles: string[];
  tags: string[];
}

// ---- App Settings ----
export interface AppSettings {
  githubToken: string;
  openaiApiKey: string;
  openaiModel: string;
  openaiBaseUrl: string;
  themeMode: ThemeMode;
  gitPath: string;
}

// ---- GitHub User ----
export interface GitHubUser {
  login: string;
  avatar_url: string;
  name: string | null;
  bio: string | null;
  public_repos: number;
  followers: number;
  html_url: string;
}

export interface ContributionProgressStep {
  key: string;
  label: string;
  detail?: string;
  status: 'pending' | 'running' | 'success' | 'error';
}

export interface StartContributionResult {
  session: ContributionSession;
  localRepoPath: string;
  branchName: string;
}

export interface CreateDraftPRFromSessionResult {
  session: ContributionSession;
  prUrl: string;
  reusedExisting: boolean;
}
