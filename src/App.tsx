import { Box, Snackbar, Alert } from '@mui/material';
import AppThemeProvider from './components/ThemeProvider';
import Sidebar from './components/Layout/Sidebar';
import TopBar from './components/Layout/TopBar';
import Dashboard from './pages/Dashboard';
import Explorer from './pages/Explorer';
import Preferences from './pages/Preferences';
import IssueDetail from './pages/IssueDetail';
import Settings from './pages/Settings';
import { useAppStore } from './store';

function PageRouter() {
  const currentPage = useAppStore((s) => s.currentPage);

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

function AppContent() {
  const notification = useAppStore((s) => s.notification);
  const clearNotification = useAppStore((s) => s.clearNotification);

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

      {/* Global Snackbar */}
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
