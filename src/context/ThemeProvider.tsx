import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { colorScheme } from 'nativewind';
import type { ThemeMode } from '@/types';
import { getThemePreference, setThemePreference } from '@/utils/storage';

type ThemeContextValue = {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  resolved: 'light' | 'dark';
  isDark: boolean;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>('dark');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    getThemePreference().then((saved) => {
      if (saved) {
        setModeState(saved);
      }
      setLoaded(true);
    });
  }, []);

  const resolved: 'light' | 'dark' = 'dark';

  useEffect(() => {
    if (loaded) {
      colorScheme.set(resolved);
    }
  }, [resolved, loaded]);

  const setMode = (next: ThemeMode) => {
    setModeState(next);
    void setThemePreference(next);
  };

  const value = useMemo(
    () => ({ mode, setMode, resolved, isDark: resolved === 'dark' }),
    [mode, resolved],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return ctx;
}
