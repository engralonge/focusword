import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ThemeMode } from '@/types';

const THEME_KEY = '@focusword/theme';

export async function getThemePreference(): Promise<ThemeMode | null> {
  const value = await AsyncStorage.getItem(THEME_KEY);
  if (value === 'system' || value === 'light' || value === 'dark') {
    return value;
  }
  return null;
}

export async function setThemePreference(mode: ThemeMode): Promise<void> {
  await AsyncStorage.setItem(THEME_KEY, mode);
}