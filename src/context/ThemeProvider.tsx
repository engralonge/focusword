import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useColorScheme as useSystemColorScheme } from 'react-native';
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
  const system = useSystemColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('system');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    getThemePreference().then((saved) => {
      if (saved) {
        setModeState(saved);
      }
      setLoaded(true);
    });
  }, []);

  const resolved: 'light' | 'dark' =
    mode === 'system' ? (system === 'dark' ? 'dark' : 'light') : mode;

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