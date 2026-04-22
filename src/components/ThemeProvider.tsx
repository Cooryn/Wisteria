import { useMemo, useEffect, useState } from 'react';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { lightTheme, darkTheme } from '../theme';
import type { ThemeMode } from '../types';
import { useAppStore } from '../store';

interface ThemeProviderWrapperProps {
  children: React.ReactNode;
}

function useSystemTheme(): 'light' | 'dark' {
  const [systemTheme, setSystemTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'dark';
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => {
      setSystemTheme(e.matches ? 'dark' : 'light');
    };

    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  return systemTheme;
}

export function resolveTheme(mode: ThemeMode, systemTheme: 'light' | 'dark'): 'light' | 'dark' {
  if (mode === 'system') return systemTheme;
  return mode;
}

export default function AppThemeProvider({ children }: ThemeProviderWrapperProps) {
  const themeMode = useAppStore((s) => s.themeMode);
  const systemTheme = useSystemTheme();

  const theme = useMemo(() => {
    const resolved = resolveTheme(themeMode, systemTheme);
    return resolved === 'dark' ? darkTheme : lightTheme;
  }, [themeMode, systemTheme]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  );
}
