import { useEffect, useState } from 'react';
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
const SIDEBAR_TRANSITION_MS = 280;
const TEXT_REVEAL_DELAY_MS = 110;
const SIDEBAR_EASING = 'cubic-bezier(0.2, 0.8, 0.2, 1)';

const NAV_ITEMS = [
  { id: 'dashboard', label: '仪表盘', icon: <DashboardIcon /> },
  { id: 'explorer', label: '探索项目', icon: <ExploreIcon /> },
  { id: 'preferences', label: '偏好设置', icon: <TuneIcon /> },
  { id: 'settings', label: '应用设置', icon: <SettingsIcon /> },
];

export default function Sidebar() {
  const currentPage = useAppStore((state) => state.currentPage);
  const setCurrentPage = useAppStore((state) => state.setCurrentPage);
  const collapsed = useAppStore((state) => state.sidebarCollapsed);
  const toggleSidebar = useAppStore((state) => state.toggleSidebar);
  const user = useAppStore((state) => state.user);

  const [showExpandedText, setShowExpandedText] = useState(!collapsed);

  useEffect(() => {
    let timer: number | undefined;

    if (collapsed) {
      setShowExpandedText(false);
    } else {
      timer = window.setTimeout(() => {
        setShowExpandedText(true);
      }, TEXT_REVEAL_DELAY_MS);
    }

    return () => {
      if (timer !== undefined) {
        window.clearTimeout(timer);
      }
    };
  }, [collapsed]);

  const width = collapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH;

  const textSlotSx = (expandedWidth: number, marginLeft = 1.5) => ({
    minWidth: 0,
    maxWidth: showExpandedText ? expandedWidth : 0,
    ml: showExpandedText ? marginLeft : 0,
    overflow: 'hidden',
    opacity: showExpandedText ? 1 : 0,
    transform: showExpandedText ? 'translateX(0)' : 'translateX(-8px)',
    transition: [
      `max-width 220ms ${SIDEBAR_EASING}`,
      `margin-left 220ms ${SIDEBAR_EASING}`,
      'opacity 140ms ease',
      `transform 220ms ${SIDEBAR_EASING}`,
    ].join(', '),
    pointerEvents: showExpandedText ? 'auto' : 'none',
    whiteSpace: 'nowrap',
    flexShrink: 1,
  });

  return (
    <Drawer
      variant="permanent"
      sx={{
        width,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width,
          transition: `width ${SIDEBAR_TRANSITION_MS}ms ${SIDEBAR_EASING}`,
          overflowX: 'hidden',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          willChange: 'width',
        },
      }}
    >
      <Box
        sx={{
          px: 2,
          py: 1.75,
          display: 'flex',
          alignItems: 'center',
          minHeight: 64,
          overflow: 'hidden',
        }}
      >
        <LogoIcon
          sx={{
            flexShrink: 0,
            fontSize: 32,
            color: 'primary.main',
            filter: (theme) =>
              `drop-shadow(0 0 8px ${alpha(theme.palette.primary.main, 0.5)})`,
          }}
        />
        <Box sx={textSlotSx(140)}>
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
        </Box>
      </Box>

      <Divider sx={{ opacity: 0.5 }} />

      <List sx={{ flex: 1, px: 1, py: 1.5 }}>
        {NAV_ITEMS.map((item) => {
          const isActive = currentPage === item.id;

          return (
            <Tooltip
              key={item.id}
              title={collapsed ? item.label : ''}
              placement="right"
              arrow
              disableHoverListener={!collapsed}
            >
              <ListItemButton
                onClick={() => setCurrentPage(item.id)}
                sx={{
                  borderRadius: 2,
                  mb: 0.5,
                  minHeight: 44,
                  px: collapsed ? 0 : 1.75,
                  overflow: 'hidden',
                  transition: [
                    'background-color 0.18s ease',
                    `padding ${SIDEBAR_TRANSITION_MS}ms ${SIDEBAR_EASING}`,
                  ].join(', '),
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
                    background: (theme) => alpha(theme.palette.primary.main, 0.08),
                  },
                }}
              >
                <ListItemIcon
                  sx={{
                    minWidth: 40,
                    flexShrink: 0,
                    justifyContent: 'center',
                    mx: collapsed ? 'auto' : 0,
                    color: 'text.secondary',
                    transition: [
                      'color 0.18s ease',
                      `margin ${SIDEBAR_TRANSITION_MS}ms ${SIDEBAR_EASING}`,
                    ].join(', '),
                  }}
                >
                  {item.icon}
                </ListItemIcon>

                <Box sx={textSlotSx(140, 0)}>
                  <ListItemText
                    primary={item.label}
                    sx={{
                      m: 0,
                      minWidth: 0,
                    }}
                    primaryTypographyProps={{
                      fontSize: '0.9rem',
                      fontWeight: 500,
                      noWrap: true,
                    }}
                  />
                </Box>
              </ListItemButton>
            </Tooltip>
          );
        })}
      </List>

      <Divider sx={{ opacity: 0.5 }} />

      <Box sx={{ p: 1.5 }}>
        {user && (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              mb: 1,
              overflow: 'hidden',
            }}
          >
            <Avatar
              src={user.avatar_url}
              alt={user.login}
              sx={{
                width: 32,
                height: 32,
                flexShrink: 0,
                border: (theme) =>
                  `2px solid ${alpha(theme.palette.primary.main, 0.3)}`,
              }}
            />

            <Box sx={textSlotSx(132)}>
              <Typography variant="body2" fontWeight={600} noWrap>
                {user.name ?? user.login}
              </Typography>
              <Typography variant="caption" color="text.secondary" noWrap>
                @{user.login}
              </Typography>
            </Box>
          </Box>
        )}

        <IconButton
          onClick={toggleSidebar}
          size="small"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          sx={{
            display: 'flex',
            mx: 'auto',
            color: 'text.secondary',
            transition: 'color 0.2s ease, transform 0.22s ease',
            '&:hover': {
              color: 'primary.main',
            },
          }}
        >
          {collapsed ? <ExpandIcon /> : <CollapseIcon />}
        </IconButton>
      </Box>
    </Drawer>
  );
}
