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
  title: string;
  body: string | null;
  labels: string; // JSON string
  state: string;
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

// ---- Preferences ----
export interface UserPreferences {
  languages: TechTag[];
  frameworks: TechTag[];
  tools: TechTag[];
  minStars: number;
  maxStars: number;
  issueLabels: string[]; // e.g. ['good first issue', 'help wanted']
  workDirectory: string; // user-defined clone directory
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
  workDirectory: string;
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

// ---- Draft PR ----
export interface DraftPRRequest {
  issue: Issue;
  repoFullName: string;
  branchName: string;
  title: string;
  body: string;
}

export interface DraftPRResult {
  success: boolean;
  pr_url?: string;
  error?: string;
}
