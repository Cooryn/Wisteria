export interface WisteriaConfig {
  githubToken: string;
  defaultWorkDir?: string;
  defaultLanguages?: string[];
  defaultTopics?: string[];
  defaultLabels?: string[];
  minStars?: number;
  maxStars?: number;
  allowGitCommands?: boolean;
  dailyDigest?: {
    enabled?: boolean;
    timezone?: string;
    hour?: number;
    limit?: number;
    minScore?: number;
  };
}

export interface WisteriaPreferencesResult {
  source: "plugin-config";
  hasGitHubToken: boolean;
  allowGitCommands: boolean;
  defaultWorkDir: string | null;
  defaultLanguages: string[];
  defaultTopics: string[];
  defaultLabels: string[];
  minStars: number | null;
  maxStars: number | null;
  dailyDigest: {
    enabled: boolean;
    timezone: string;
    hour: number;
    limit: number;
    minScore: number;
  };
}

export interface RepoScoreBreakdown {
  languageMatch: number;
  topicMatch: number;
  activity: number;
  community: number;
  issueFriendliness: number;
  freshness: number;
}

export interface IssueScoreBreakdown {
  labelMatch: number;
  clarity: number;
  discussionLoad: number;
  freshness: number;
  beginnerFriendliness: number;
}

export interface ToolResult<T> {
  ok: true;
  data: T;
}

export interface ToolError {
  ok: false;
  error: {
    code: string;
    message: string;
  };
}

export interface RepoSearchParams {
  languages?: string[];
  topics?: string[];
  minStars?: number;
  maxStars?: number;
  includeArchived?: boolean;
  limit?: number;
}

export interface IssueSearchParams {
  repoFullName: string;
  labels?: string[];
  state?: "open" | "closed" | "all";
  limit?: number;
}

export interface RepoCandidate {
  fullName: string;
  name: string;
  owner: string;
  description: string | null;
  url: string;
  language: string | null;
  topics: string[];
  stars: number;
  forks: number;
  openIssues: number;
  pushedAt: string | null;
  createdAt?: string | null;
  archived?: boolean;
  disabled?: boolean;
  fallbackLevel?: 0 | 1 | 2 | 3;
}

export interface IssueCandidate {
  repoFullName: string;
  number: number;
  title: string;
  body: string | null;
  url: string;
  labels: string[];
  comments: number;
  createdAt: string;
  updatedAt: string;
  state: "open" | "closed";
  author?: string | null;
  isPullRequest?: boolean;
}

export interface RepoScoreResult {
  score: number;
  breakdown: RepoScoreBreakdown;
  reasons: string[];
}

export interface IssueScoreResult {
  score: number;
  breakdown: IssueScoreBreakdown;
  reasons: string[];
}

export interface RepoRecommendation extends RepoCandidate {
  score: number;
  scoreBreakdown: RepoScoreBreakdown;
  reasons: string[];
}

export interface IssueRecommendation extends IssueCandidate {
  score: number;
  scoreBreakdown: IssueScoreBreakdown;
  reasons: string[];
}

export interface RepoSearchRound {
  fallbackLevel: 0 | 1 | 2 | 3;
  language?: string;
  query: string;
}

export interface IssueContextComment {
  author: string | null;
  body: string | null;
  createdAt: string;
  updatedAt: string;
  url: string;
}

export interface IssueContextResult {
  repo: {
    fullName: string;
    url: string;
    defaultBranch: string;
    language: string | null;
    topics: string[];
  };
  issue: {
    number: number;
    title: string;
    body: string | null;
    url: string;
    labels: string[];
    comments: number;
    createdAt: string;
    updatedAt: string;
    author: string | null;
  };
  comments: IssueContextComment[];
  repositoryReadme: {
    path: string;
    excerpt: string | null;
  } | null;
  analysisPrompt: {
    guidance: string;
    outputSchema: {
      difficulty: "easy | medium | hard";
      estimatedTime: string;
      summary: string;
      suggestedApproach: string[];
      likelyFiles: string[];
      risks: string[];
      questionsForMaintainer: string[];
    };
  };
}

export interface DailyDigestParams {
  languages?: string[];
  topics?: string[];
  labels?: string[];
  limit?: number;
  maxIssuesPerRepo?: number;
  minScore?: number;
}

export interface DailyDigestEntry {
  repoFullName: string;
  repoUrl: string;
  issueNumber: number;
  issueTitle: string;
  issueUrl: string;
  score: number;
  difficulty: "easy" | "medium" | "hard";
  estimatedTime: string;
  reasons: string[];
  suggestedNextAction: string;
}

export interface DailyDigestResult {
  date: string;
  generatedAt: string;
  timezone: string;
  recommendations: DailyDigestEntry[];
}

export interface PrepareContributionParams {
  repoFullName: string;
  issueNumber?: number;
  workDir: string;
  branchName: string;
  forkIfNeeded?: boolean;
}

export interface PrepareContributionResult {
  workspacePath: string;
  repoFullName: string;
  forkFullName: string;
  baseBranch: string;
  branchName: string;
  issueNumber?: number;
  remotes: Record<string, string>;
  reusedExistingClone: boolean;
  reusedExistingBranch: boolean;
  warnings: string[];
  nextSteps: string[];
}

export interface WorkspaceCheckResult {
  isGitRepo: boolean;
  currentBranch: string | null;
  isClean: boolean;
  hasCommitsAhead: boolean;
  remotes: Record<string, string>;
  changedFiles: string[];
  warnings: string[];
}

export interface CreateDraftPrParams {
  workspacePath: string;
  repoFullName: string;
  branchName: string;
  title: string;
  body: string;
  baseBranch?: string;
}

export interface CreateDraftPrResult {
  prUrl: string;
  prNumber: number;
  repoFullName: string;
  branchName: string;
  baseBranch: string;
  headRef: string;
  reusedExistingPullRequest: boolean;
}

export interface GitCommandResult {
  ok: boolean;
  stdout: string;
  stderr: string;
  exitCode: number | null;
}

export interface GitRunOptions {
  cwd: string;
  allowRoot: string;
  timeoutMs?: number;
  secrets?: string[];
}

export interface RecommendedAgent {
  id: string;
  name: string;
  description: string;
  profile: "minimal" | "coding";
  alsoAllow: string[];
  deny: string[];
  readOnly: boolean;
  canWriteFiles: boolean;
  canExecuteCommands: boolean;
  canCreateDraftPr: boolean;
}
