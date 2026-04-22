import { useEffect } from 'react';
import { Box, Snackbar, Alert } from '@mui/material';
import AppThemeProvider from './components/ThemeProvider';
import Sidebar from './components/Layout/Sidebar';
import TopBar from './components/Layout/TopBar';
import Dashboard from './pages/Dashboard';
import Explorer from './pages/Explorer';
import Preferences from './pages/Preferences';
import IssueDetail from './pages/IssueDetail';
import Settings from './pages/Settings';
import {
  getAllSettings,
  getPreference,
  getTechTags,
} from './services/database';
import { initOctokit, validateToken } from './services/github';
import { useAppStore } from './store';
import type { ThemeMode } from './types';

function PageRouter() {
  const currentPage = useAppStore((state) => state.currentPage);

  switch (currentPage) {
    case 'dashboard':
      return <Dashboard />;
    case 'explorer':
      return <Explorer />;
    case 'preferences':
      return <Preferences />;
    case 'issue-detail':
      return <IssueDetail />;
    case 'settings':
      return <Settings />;
    default:
      return <Dashboard />;
  }
}

function useAppBootstrap() {
  const setSettings = useAppStore((state) => state.setSettings);
  const setThemeMode = useAppStore((state) => state.setThemeMode);
  const setUser = useAppStore((state) => state.setUser);
  const setLanguages = useAppStore((state) => state.setLanguages);
  const setFrameworks = useAppStore((state) => state.setFrameworks);
  const setTools = useAppStore((state) => state.setTools);
  const setIssueLabels = useAppStore((state) => state.setIssueLabels);
  const setMinStars = useAppStore((state) => state.setMinStars);
  const setMaxStars = useAppStore((state) => state.setMaxStars);
  const setWorkDirectory = useAppStore((state) => state.setWorkDirectory);
  const setIsHydrated = useAppStore((state) => state.setIsHydrated);

  useEffect(() => {
    let isActive = true;

    const bootstrap = async () => {
      setIsHydrated(false);

      const [
        settingsResult,
        tagsResult,
        minStarsResult,
        maxStarsResult,
        labelsResult,
        workDirectoryResult,
      ] = await Promise.allSettled([
        getAllSettings(),
        getTechTags(),
        getPreference('minStars'),
        getPreference('maxStars'),
        getPreference('issueLabels'),
        getPreference('workDirectory'),
      ]);

      if (!isActive) {
        return;
      }

      if (settingsResult.status === 'fulfilled') {
        const allSettings = settingsResult.value;
        const themeMode: ThemeMode =
          allSettings.themeMode === 'light' || allSettings.themeMode === 'dark'
            ? allSettings.themeMode
            : 'system';

        setSettings({
          githubToken: allSettings.githubToken ?? '',
          openaiApiKey: allSettings.openaiApiKey ?? '',
          openaiModel: allSettings.openaiModel ?? 'gpt-4o',
          openaiBaseUrl: allSettings.openaiBaseUrl ?? 'https://api.openai.com/v1',
          themeMode,
          gitPath: allSettings.gitPath ?? '',
        });

        if (themeMode === 'light' || themeMode === 'dark' || themeMode === 'system') {
          setThemeMode(themeMode);
        }

        const githubToken = allSettings.githubToken?.trim();
        if (githubToken) {
          initOctokit(githubToken);
          const user = await validateToken(githubToken);
          if (isActive) {
            setUser(user);
          }
        } else {
          setUser(null);
        }
      } else {
        setUser(null);
      }

      if (tagsResult.status === 'fulfilled') {
        const tags = tagsResult.value;
        setLanguages(tags.filter((tag) => tag.category === 'language'));
        setFrameworks(tags.filter((tag) => tag.category === 'framework'));
        setTools(tags.filter((tag) => tag.category === 'tool'));
      }

      if (minStarsResult.status === 'fulfilled' && minStarsResult.value) {
        setMinStars(Number(minStarsResult.value));
      }

      if (maxStarsResult.status === 'fulfilled' && maxStarsResult.value) {
        setMaxStars(Number(maxStarsResult.value));
      }

      if (labelsResult.status === 'fulfilled' && labelsResult.value) {
        try {
          const parsed = JSON.parse(labelsResult.value);
          if (Array.isArray(parsed)) {
            setIssueLabels(parsed.filter((value): value is string => typeof value === 'string'));
          }
        } catch {
          // Keep defaults if saved data is malformed.
        }
      }

      if (workDirectoryResult.status === 'fulfilled' && workDirectoryResult.value) {
        setWorkDirectory(workDirectoryResult.value);
      }

      if (isActive) {
        setIsHydrated(true);
      }
    };

    void bootstrap();

    return () => {
      isActive = false;
    };
  }, [
    setFrameworks,
    setIssueLabels,
    setIsHydrated,
    setLanguages,
    setMaxStars,
    setMinStars,
    setSettings,
    setThemeMode,
    setTools,
    setUser,
    setWorkDirectory,
  ]);
}

function AppContent() {
  useAppBootstrap();

  const notification = useAppStore((state) => state.notification);
  const clearNotification = useAppStore((state) => state.clearNotification);

  return (
    <Box sx={{ display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden' }}>
      <Sidebar />
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          minWidth: 0,
        }}
      >
        <TopBar />
        <Box sx={{ flex: 1, overflow: 'hidden' }}>
          <PageRouter />
        </Box>
      </Box>

      <Snackbar
        open={!!notification}
        autoHideDuration={4000}
        onClose={clearNotification}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        {notification ? (
          <Alert
            onClose={clearNotification}
            severity={notification.severity}
            variant="filled"
            sx={{ width: '100%', borderRadius: 2 }}
          >
            {notification.message}
          </Alert>
        ) : undefined}
      </Snackbar>
    </Box>
  );
}

export default function App() {
  return (
    <AppThemeProvider>
      <AppContent />
    </AppThemeProvider>
  );
}
