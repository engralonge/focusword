export const palette = {
  brand: '#C9A227',
  brandLight: '#E8D48B',
  brandDark: '#9A7B1A',
  backgroundDark: '#0F1419',
  backgroundLight: '#F8F6F0',
  surfaceDark: '#1A2332',
  surfaceLight: '#FFFFFF',
  muted: '#6B7280',
  danger: '#EF4444',
  success: '#22C55E',
} as const;

export function getTabBarColors(isDark: boolean) {
  return {
    active: palette.brand,
    inactive: palette.muted,
    background: isDark ? palette.surfaceDark : palette.surfaceLight,
    border: isDark ? '#2D3748' : '#E5E7EB',
  };
}