export type DifficultyPreference = "easy" | "medium" | "mixed";
export type RepoSizePreference = "small" | "medium" | "mixed";
export type IssueType = "bug" | "docs" | "feature" | "tests" | "refactor";
export type ScanStatus = "idle" | "running" | "completed" | "error";
export type AppView =
  | "settings"
  | "dashboard"
  | "recommendations"
  | "issue"
  | "draft";
export type SortMode = "score" | "difficulty" | "updated";

export interface UserProfile {
  displayName: string;
  languages: string[];
  frameworks: string[];
  interestDomains: string[];
  difficultyPreference: DifficultyPreference;
  weeklyHours: number;
  preferredIssueTypes: IssueType[];
  excludeKeywords: string[];
  excludeLicenses: string[];
  repoSizePreference: RepoSizePreference;
}

export interface RateLimitSnapshot {
  limit: number | null;
  remaining: number | null;
  reset: number | null;
  used: number | null;
  resource: string | null;
}

export interface QuerySnapshot {
  repositoryQuery: string;
  requestedLanguages: string[];
  requestedFrameworks: string[];
  requestedDomains: string[];
}

export interface ScanRun {
  id?: number;
  createdAt: string;
  status: ScanStatus;
  querySnapshot: QuerySnapshot;
  rateLimit: RateLimitSnapshot;
  repoCount: number;
  issueCount: number;
  errorMessage?: string | null;
}

export interface RepoCandidate {
  id?: number;
  scanRunId?: number;
  repoId: number;
  ownerLogin: string;
  name: string;
  fullName: string;
  htmlUrl: string;
  description: string;
  primaryLanguage: string | null;
  topics: string[];
  licenseSpdx: string | null;
  stars: number;
  forks: number;
  openIssues: number;
  archived: boolean;
  pushedAt: string | null;
  healthScore: number;
  profileScore: number;
  totalScore: number;
  matchReasons: string[];
  readmeExcerpt?: string | null;
  contributingExcerpt?: string | null;
}

export interface ScoreBreakdown {
  labelBonus: number;
  difficultyScore: number;
  timeFitScore: number;
  maintainerScore: number;
  riskPenalty: number;
  total: number;
  reasons: string[];
  riskFlags: string[];
}

export interface IssueCandidate {
  id?: number;
  scanRunId?: number;
  repoCandidateId?: number;
  issueId: number;
  number: number;
  title: string;
  bodyExcerpt: string;
  htmlUrl: string;
  labels: string[];
  comments: number;
  createdAt: string;
  updatedAt: string;
  author: string;
  assignees: string[];
  scoreBreakdown: ScoreBreakdown;
  recommendationSummary: string;
  repo: RepoCandidate;
}

export interface DraftPrArtifact {
  id?: number;
  issueCandidateId?: number;
  createdAt: string;
  branchName: string;
  title: string;
  summary: string;
  problemStatement: string;
  implementationPlan: string[];
  validationChecklist: string[];
  commitPlan: string[];
  prBody: string;
  assistantPrompt: string;
  providerUsed: string;
  warnings?: string[];
}

export interface GitHubTokenStatus {
  hasToken: boolean;
  maskedToken: string | null;
  token: string | null;
  hydratedFromVault: boolean;
}

export interface LlmConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  organization?: string | null;
  project?: string | null;
}

export interface LlmConfigStatus {
  configured: boolean;
  model: string | null;
  baseUrl: string | null;
}

export interface SystemProbe {
  gitVersion: string | null;
  cargoAvailable: boolean;
  rustcAvailable: boolean;
  webview2Available: boolean;
  tauriPackagesPresent: boolean;
  notes: string[];
}

export interface ScanWorkspace {
  run: ScanRun | null;
  issues: IssueCandidate[];
}

export const defaultProfile: UserProfile = {
  displayName: "",
  languages: ["TypeScript", "Rust"],
  frameworks: ["React", "Tauri"],
  interestDomains: ["developer-tooling", "productivity"],
  difficultyPreference: "mixed",
  weeklyHours: 6,
  preferredIssueTypes: ["bug", "docs", "tests"],
  excludeKeywords: ["security", "rewrite", "breaking"],
  excludeLicenses: ["AGPL-3.0"],
  repoSizePreference: "mixed"
};

