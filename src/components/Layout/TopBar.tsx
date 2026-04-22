import {
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Tooltip,
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
  const currentPage = useAppStore((s) => s.currentPage);
  const themeMode = useAppStore((s) => s.themeMode);
  const setThemeMode = useAppStore((s) => s.setThemeMode);
  const user = useAppStore((s) => s.user);

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
        {/* Page Title */}
        <Typography
          variant="h5"
          color="text.primary"
          fontWeight={700}
          sx={{ flex: 1 }}
        >
          {PAGE_TITLES[currentPage] ?? ''}
        </Typography>

        {/* Theme Toggle — single cycling button */}
        <Tooltip title={THEME_LABELS[themeMode]}>
          <IconButton
            onClick={handleCycleTheme}
            size="small"
            sx={{
              mr: 2,
              border: (theme) => `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
              borderRadius: 2,
              px: 1.2,
              py: 0.6,
              color: 'primary.main',
              backgroundColor: (theme) => alpha(theme.palette.primary.main, 0.08),
              transition: 'all 0.25s ease',
              '&:hover': {
                backgroundColor: (theme) => alpha(theme.palette.primary.main, 0.18),
                transform: 'rotate(30deg)',
              },
            }}
          >
            <ThemeIcon mode={themeMode} />
          </IconButton>
        </Tooltip>

        {/* GitHub link */}
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
