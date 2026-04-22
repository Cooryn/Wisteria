import { createTheme, alpha, type ThemeOptions } from '@mui/material/styles';

// Wisteria brand colors — inspired by wisteria flowers
const BRAND = {
  primary: '#7C4DFF',       // Deep purple
  primaryLight: '#B388FF',
  primaryDark: '#5C35CC',
  secondary: '#00E5FF',     // Cyan accent
  secondaryLight: '#6EFFFF',
  secondaryDark: '#00B8D4',
  success: '#66BB6A',
  warning: '#FFA726',
  error: '#EF5350',
};

const sharedTypography = {
  fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  h1: { fontWeight: 700, fontSize: '2.25rem', letterSpacing: '-0.02em' },
  h2: { fontWeight: 700, fontSize: '1.75rem', letterSpacing: '-0.01em' },
  h3: { fontWeight: 600, fontSize: '1.5rem' },
  h4: { fontWeight: 600, fontSize: '1.25rem' },
  h5: { fontWeight: 600, fontSize: '1.1rem' },
  h6: { fontWeight: 600, fontSize: '1rem' },
  subtitle1: { fontWeight: 500, fontSize: '0.95rem' },
  subtitle2: { fontWeight: 500, fontSize: '0.85rem' },
  body1: { fontSize: '0.9rem', lineHeight: 1.6 },
  body2: { fontSize: '0.8rem', lineHeight: 1.5 },
  button: { fontWeight: 600, textTransform: 'none' as const },
};

const sharedShape = {
  borderRadius: 12,
};

const sharedComponents: ThemeOptions['components'] = {
  MuiButton: {
    styleOverrides: {
      root: ({ ownerState }) => ({
        borderRadius: 10,
        padding: '8px 20px',
        transition: 'all 0.2s ease-in-out',
        ...(ownerState.variant === 'contained' && ownerState.color === 'primary' && {
          background: `linear-gradient(135deg, ${BRAND.primary} 0%, ${BRAND.primaryLight} 100%)`,
          boxShadow: `0 4px 14px ${alpha(BRAND.primary, 0.4)}`,
          '&:hover': {
            background: `linear-gradient(135deg, ${BRAND.primaryDark} 0%, ${BRAND.primary} 100%)`,
            boxShadow: `0 6px 20px ${alpha(BRAND.primary, 0.5)}`,
            transform: 'translateY(-1px)',
          },
        }),
      }),
    },
  },
  MuiCard: {
    styleOverrides: {
      root: {
        borderRadius: 16,
        transition: 'all 0.3s ease',
      },
    },
  },
  MuiChip: {
    styleOverrides: {
      root: {
        borderRadius: 8,
        fontWeight: 500,
      },
    },
  },
  MuiTextField: {
    styleOverrides: {
      root: {
        '& .MuiOutlinedInput-root': {
          borderRadius: 10,
        },
      },
    },
  },
  MuiPaper: {
    styleOverrides: {
      root: {
        borderRadius: 16,
      },
    },
  },
  MuiDialog: {
    styleOverrides: {
      paper: {
        borderRadius: 20,
      },
    },
  },
  MuiTooltip: {
    styleOverrides: {
      tooltip: {
        borderRadius: 8,
        fontSize: '0.8rem',
      },
    },
  },
};

// ---- Light Theme ----
export const lightTheme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: BRAND.primary,
      light: BRAND.primaryLight,
      dark: BRAND.primaryDark,
    },
    secondary: {
      main: BRAND.secondary,
      light: BRAND.secondaryLight,
      dark: BRAND.secondaryDark,
    },
    success: { main: BRAND.success },
    warning: { main: BRAND.warning },
    error: { main: BRAND.error },
    background: {
      default: '#F5F3FF',
      paper: '#FFFFFF',
    },
    text: {
      primary: '#1A1A2E',
      secondary: '#5A5A7A',
    },
    divider: alpha('#7C4DFF', 0.12),
  },
  typography: sharedTypography,
  shape: sharedShape,
  components: {
    ...sharedComponents,
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 16,
          transition: 'all 0.3s ease',
          border: `1px solid ${alpha(BRAND.primary, 0.08)}`,
          boxShadow: `0 2px 12px ${alpha('#000', 0.06)}`,
          '&:hover': {
            boxShadow: `0 8px 30px ${alpha(BRAND.primary, 0.12)}`,
            transform: 'translateY(-2px)',
          },
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          background: 'linear-gradient(180deg, #F8F6FF 0%, #F0EDFF 100%)',
          borderRight: `1px solid ${alpha(BRAND.primary, 0.1)}`,
        },
      },
    },
  },
});

// ---- Dark Theme ----
export const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: BRAND.primaryLight,
      light: '#D1C4FF',
      dark: BRAND.primary,
    },
    secondary: {
      main: BRAND.secondary,
      light: BRAND.secondaryLight,
      dark: BRAND.secondaryDark,
    },
    success: { main: BRAND.success },
    warning: { main: BRAND.warning },
    error: { main: BRAND.error },
    background: {
      default: '#0D0B1A',
      paper: '#161228',
    },
    text: {
      primary: '#E8E6F0',
      secondary: '#9B97B0',
    },
    divider: alpha('#B388FF', 0.15),
  },
  typography: sharedTypography,
  shape: sharedShape,
  components: {
    ...sharedComponents,
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 16,
          transition: 'all 0.3s ease',
          border: `1px solid ${alpha(BRAND.primaryLight, 0.1)}`,
          background: `linear-gradient(135deg, ${alpha('#1E1A30', 0.95)} 0%, ${alpha('#161228', 0.98)} 100%)`,
          backdropFilter: 'blur(20px)',
          boxShadow: `0 4px 20px ${alpha('#000', 0.3)}`,
          '&:hover': {
            border: `1px solid ${alpha(BRAND.primaryLight, 0.2)}`,
            boxShadow: `0 8px 30px ${alpha(BRAND.primary, 0.2)}`,
            transform: 'translateY(-2px)',
          },
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          background: 'linear-gradient(180deg, #130F22 0%, #0D0B1A 100%)',
          borderRight: `1px solid ${alpha(BRAND.primaryLight, 0.1)}`,
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 16,
          backgroundImage: 'none',
        },
      },
    },
  },
});
