import { create } from 'zustand';
import type {
  ThemeMode,
  TechTag,
  Repo,
  Issue,
  GitHubUser,
  ScoreResult,
  PRHistoryEntry,
  AppSettings,
} from '../types';

// ---- App Store ----
interface AppState {
  // Theme
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;

  // GitHub User
  user: GitHubUser | null;
  setUser: (user: GitHubUser | null) => void;

  // Navigation
  currentPage: string;
  setCurrentPage: (page: string) => void;

  // Sidebar
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;

  // Preferences
  languages: TechTag[];
  frameworks: TechTag[];
  tools: TechTag[];
  issueLabels: string[];
  minStars: number;
  maxStars: number;
  workDirectory: string;
  setLanguages: (tags: TechTag[]) => void;
  setFrameworks: (tags: TechTag[]) => void;
  setTools: (tags: TechTag[]) => void;
  setIssueLabels: (labels: string[]) => void;
  setMinStars: (val: number) => void;
  setMaxStars: (val: number) => void;
  setWorkDirectory: (dir: string) => void;

  // Search results
  searchRepos: Repo[];
  searchIssues: Issue[];
  repoScores: Map<number, ScoreResult>;
  isSearching: boolean;
  setSearchRepos: (repos: Repo[]) => void;
  setSearchIssues: (issues: Issue[]) => void;
  setRepoScores: (scores: Map<number, ScoreResult>) => void;
  setIsSearching: (val: boolean) => void;

  // Selected repo for issue browsing
  selectedRepo: Repo | null;
  setSelectedRepo: (repo: Repo | null) => void;

  // Selected issue for detail view
  selectedIssue: Issue | null;
  setSelectedIssue: (issue: Issue | null) => void;

  // PR History
  prHistory: PRHistoryEntry[];
  setPrHistory: (prs: PRHistoryEntry[]) => void;

  // Settings
  settings: AppSettings;
  setSettings: (settings: Partial<AppSettings>) => void;

  // Loading states
  isLoading: boolean;
  setIsLoading: (val: boolean) => void;
  loadingMessage: string;
  setLoadingMessage: (msg: string) => void;

  // Snackbar notifications
  notification: { message: string; severity: 'success' | 'error' | 'warning' | 'info' } | null;
  showNotification: (message: string, severity?: 'success' | 'error' | 'warning' | 'info') => void;
  clearNotification: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  // Theme
  themeMode: 'system',
  setThemeMode: (mode) => set({ themeMode: mode }),

  // GitHub User
  user: null,
  setUser: (user) => set({ user }),

  // Navigation
  currentPage: 'dashboard',
  setCurrentPage: (page) => set({ currentPage: page }),

  // Sidebar
  sidebarCollapsed: false,
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),

  // Preferences
  languages: [],
  frameworks: [],
  tools: [],
  issueLabels: ['good first issue', 'help wanted'],
  minStars: 100,
  maxStars: 50000,
  workDirectory: '',
  setLanguages: (tags) => set({ languages: tags }),
  setFrameworks: (tags) => set({ frameworks: tags }),
  setTools: (tags) => set({ tools: tags }),
  setIssueLabels: (labels) => set({ issueLabels: labels }),
  setMinStars: (val) => set({ minStars: val }),
  setMaxStars: (val) => set({ maxStars: val }),
  setWorkDirectory: (dir) => set({ workDirectory: dir }),

  // Search results
  searchRepos: [],
  searchIssues: [],
  repoScores: new Map(),
  isSearching: false,
  setSearchRepos: (repos) => set({ searchRepos: repos }),
  setSearchIssues: (issues) => set({ searchIssues: issues }),
  setRepoScores: (scores) => set({ repoScores: scores }),
  setIsSearching: (val) => set({ isSearching: val }),

  // Selected
  selectedRepo: null,
  setSelectedRepo: (repo) => set({ selectedRepo: repo }),
  selectedIssue: null,
  setSelectedIssue: (issue) => set({ selectedIssue: issue }),

  // PR History
  prHistory: [],
  setPrHistory: (prs) => set({ prHistory: prs }),

  // Settings
  settings: {
    githubToken: '',
    openaiApiKey: '',
    openaiModel: 'gpt-4o',
    openaiBaseUrl: 'https://api.openai.com/v1',
    themeMode: 'system',
    workDirectory: '',
  },
  setSettings: (partial) =>
    set((s) => ({ settings: { ...s.settings, ...partial } })),

  // Loading
  isLoading: false,
  setIsLoading: (val) => set({ isLoading: val }),
  loadingMessage: '',
  setLoadingMessage: (msg) => set({ loadingMessage: msg }),

  // Notifications
  notification: null,
  showNotification: (message, severity = 'info') =>
    set({ notification: { message, severity } }),
  clearNotification: () => set({ notification: null }),
}));
