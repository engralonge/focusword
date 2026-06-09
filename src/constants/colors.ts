export const palette = {
  brand: '#D4B87A',
  brandLight: '#EBD9B0',
  brandMuted: '#A89258',
  brandDark: '#7D693D',
  backgroundDark: '#050608',
  backgroundLight: '#050608',
  surfaceDark: '#0A0C10',
  surfaceLight: '#0A0C10',
  surfaceElevated: '#101318',
  border: '#2A2A32',
  borderSubtle: '#1B1D22',
  foreground: '#F5F0E6',
  scripture: '#F2E6C8',
  muted: '#9A9BAA',
  accent: '#C97A7A',
  danger: '#D46D6D',
  success: '#67B88A',
} as const;

export function getTabBarColors(isDark: boolean) {
  return {
    active: palette.brandLight,
    inactive: palette.muted,
    background: palette.backgroundDark,
    border: palette.borderSubtle,
  };
}
