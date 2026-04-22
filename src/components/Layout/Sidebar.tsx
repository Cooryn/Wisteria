import {
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Avatar,
  Box,
  Typography,
  IconButton,
  Divider,
  Tooltip,
  alpha,
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  Explore as ExploreIcon,
  Tune as TuneIcon,
  Settings as SettingsIcon,
  ChevronLeft as CollapseIcon,
  ChevronRight as ExpandIcon,
  LocalFlorist as LogoIcon,
} from '@mui/icons-material';
import { useAppStore } from '../../store';

const SIDEBAR_WIDTH = 240;
const SIDEBAR_COLLAPSED_WIDTH = 68;

const NAV_ITEMS = [
  { id: 'dashboard', label: '仪表盘', icon: <DashboardIcon /> },
  { id: 'explorer', label: '探索', icon: <ExploreIcon /> },
  { id: 'preferences', label: '偏好设置', icon: <TuneIcon /> },
  { id: 'settings', label: '设置', icon: <SettingsIcon /> },
];

export default function Sidebar() {
  const currentPage = useAppStore((s) => s.currentPage);
  const setCurrentPage = useAppStore((s) => s.setCurrentPage);
  const collapsed = useAppStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useAppStore((s) => s.toggleSidebar);
  const user = useAppStore((s) => s.user);

  const width = collapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH;

  return (
    <Drawer
      variant="permanent"
      sx={{
        width,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width,
          transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        },
      }}
    >
      {/* Logo Area */}
      <Box
        sx={{
          p: collapsed ? 1 : 2,
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          minHeight: 64,
          justifyContent: collapsed ? 'center' : 'flex-start',
        }}
      >
        <LogoIcon
          sx={{
            fontSize: 32,
            color: 'primary.main',
            filter: (theme) =>
              `drop-shadow(0 0 8px ${alpha(theme.palette.primary.main, 0.5)})`,
          }}
        />
        {!collapsed && (
          <Typography
            variant="h6"
            sx={{
              fontWeight: 700,
              background: 'linear-gradient(135deg, #B388FF 0%, #00E5FF 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              whiteSpace: 'nowrap',
            }}
          >
            Wisteria
          </Typography>
        )}
      </Box>

      <Divider sx={{ opacity: 0.5 }} />

      {/* Navigation */}
      <List sx={{ flex: 1, px: 1, py: 1.5 }}>
        {NAV_ITEMS.map((item) => {
          const isActive = currentPage === item.id;
          return (
            <Tooltip
              key={item.id}
              title={collapsed ? item.label : ''}
              placement="right"
              arrow
            >
              <ListItemButton
                onClick={() => setCurrentPage(item.id)}
                sx={{
                  borderRadius: 2,
                  mb: 0.5,
                  minHeight: 44,
                  justifyContent: collapsed ? 'center' : 'flex-start',
                  px: collapsed ? 1.5 : 2,
                  transition: 'all 0.2s ease',
                  ...(isActive && {
                    background: (theme) =>
                      `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.15)} 0%, ${alpha(theme.palette.secondary.main, 0.08)} 100%)`,
                    '& .MuiListItemIcon-root': {
                      color: 'primary.main',
                    },
                    '& .MuiListItemText-primary': {
                      fontWeight: 600,
                      color: 'primary.main',
                    },
                  }),
                  '&:hover': {
                    background: (theme) =>
                      alpha(theme.palette.primary.main, 0.08),
                  },
                }}
              >
                <ListItemIcon
                  sx={{
                    minWidth: collapsed ? 0 : 40,
                    justifyContent: 'center',
                    color: 'text.secondary',
                    transition: 'color 0.2s ease',
                  }}
                >
                  {item.icon}
                </ListItemIcon>
                {!collapsed && (
                  <ListItemText
                    primary={item.label}
                    primaryTypographyProps={{
                      fontSize: '0.9rem',
                      fontWeight: 500,
                    }}
                  />
                )}
              </ListItemButton>
            </Tooltip>
          );
        })}
      </List>

      <Divider sx={{ opacity: 0.5 }} />

      {/* User + Collapse */}
      <Box sx={{ p: 1.5 }}>
        {user && (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              mb: 1,
              justifyContent: collapsed ? 'center' : 'flex-start',
            }}
          >
            <Avatar
              src={user.avatar_url}
              alt={user.login}
              sx={{
                width: 32,
                height: 32,
                border: (theme) =>
                  `2px solid ${alpha(theme.palette.primary.main, 0.3)}`,
              }}
            />
            {!collapsed && (
              <Box sx={{ overflow: 'hidden' }}>
                <Typography
                  variant="body2"
                  fontWeight={600}
                  noWrap
                >
                  {user.name ?? user.login}
                </Typography>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  noWrap
                >
                  @{user.login}
                </Typography>
              </Box>
            )}
          </Box>
        )}

        <IconButton
          onClick={toggleSidebar}
          size="small"
          sx={{
            display: 'flex',
            mx: 'auto',
            color: 'text.secondary',
            '&:hover': { color: 'primary.main' },
          }}
        >
          {collapsed ? <ExpandIcon /> : <CollapseIcon />}
        </IconButton>
      </Box>
    </Drawer>
  );
}
