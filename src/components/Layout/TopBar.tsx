import {
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Tooltip,
  Box,
  alpha,
} from '@mui/material';
import {
  LightMode as LightIcon,
  DarkMode as DarkIcon,
  BrightnessAuto as AutoIcon,
  GitHub as GitHubIcon,
} from '@mui/icons-material';
import { useAppStore } from '../../store';
import type { ThemeMode } from '../../types';

const PAGE_TITLES: Record<string, string> = {
  dashboard: '仪表盘',
  explorer: '探索项目',
  preferences: '偏好设置',
  settings: '应用设置',
  'issue-detail': 'Issue 详情',
};

const THEME_CYCLE: ThemeMode[] = ['light', 'system', 'dark'];
const THEME_LABELS: Record<ThemeMode, string> = {
  light: '浅色主题',
  system: '跟随系统',
  dark: '深色主题',
};

function ThemeIcon({ mode }: { mode: ThemeMode }) {
  switch (mode) {
    case 'light':
      return <LightIcon fontSize="small" />;
    case 'dark':
      return <DarkIcon fontSize="small" />;
    case 'system':
      return <AutoIcon fontSize="small" />;
  }
}

export default function TopBar() {
  const currentPage = useAppStore((state) => state.currentPage);
  const themeMode = useAppStore((state) => state.themeMode);
  const setThemeMode = useAppStore((state) => state.setThemeMode);
  const user = useAppStore((state) => state.user);

  const handleCycleTheme = () => {
    const currentIndex = THEME_CYCLE.indexOf(themeMode);
    const nextIndex = (currentIndex + 1) % THEME_CYCLE.length;
    setThemeMode(THEME_CYCLE[nextIndex]);
  };

  return (
    <AppBar
      position="static"
      elevation={0}
      sx={{
        background: 'transparent',
        borderBottom: (theme) => `1px solid ${theme.palette.divider}`,
      }}
    >
      <Toolbar sx={{ px: 3 }}>
        <Typography variant="h5" color="text.primary" fontWeight={700} sx={{ flex: 1 }}>
          {PAGE_TITLES[currentPage] ?? ''}
        </Typography>

        <Tooltip title={THEME_LABELS[themeMode]}>
          <IconButton
            onClick={handleCycleTheme}
            size="small"
            sx={{
              mr: 2,
              width: 38,
              height: 38,
              borderRadius: '50%',
              border: (theme) => `1px solid ${alpha(theme.palette.primary.main, 0.22)}`,
              color: 'primary.main',
              backgroundColor: (theme) => alpha(theme.palette.primary.main, 0.08),
              transition: 'background-color 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease',
              '&:hover': {
                backgroundColor: (theme) => alpha(theme.palette.primary.main, 0.18),
                borderColor: (theme) => alpha(theme.palette.primary.main, 0.35),
                boxShadow: (theme) => `0 0 0 4px ${alpha(theme.palette.primary.main, 0.08)}`,
              },
              '&:hover .theme-icon': {
                transform: 'rotate(12deg) scale(1.05)',
              },
            }}
          >
            <Box
              className="theme-icon"
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                lineHeight: 0,
                transition: 'transform 0.2s ease',
              }}
            >
              <ThemeIcon mode={themeMode} />
            </Box>
          </IconButton>
        </Tooltip>

        {user && (
          <Tooltip title={`@${user.login}`}>
            <IconButton
              size="small"
              onClick={() => window.open(user.html_url, '_blank')}
              sx={{ color: 'text.secondary' }}
            >
              <GitHubIcon />
            </IconButton>
          </Tooltip>
        )}
      </Toolbar>
    </AppBar>
  );
}
