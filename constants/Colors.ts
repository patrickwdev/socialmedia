export type ThemeMode = 'light' | 'dark';

const lightTheme = {
  background: '#FFFFFF',
  card: '#F8FAFC',
  primary: '#2563EB',
  secondary: '#64748B',
  text: '#0F172A',
  textSecondary: '#64748B',
  accent: '#2563EB',
  danger: '#EF4444',
  success: '#10B981',
  border: '#E2E8F0',
  tabBar: '#FFFFFF',
} as const;

const darkTheme = {
  background: '#000000',
  card: '#141414',
  primary: '#60A5FA',
  secondary: '#94A3B8',
  text: '#F8FAFC',
  textSecondary: '#94A3B8',
  accent: '#93C5FD',
  danger: '#EF4444',
  success: '#10B981',
  border: '#262626',
  tabBar: '#000000',
} as const;

export type AppColors = typeof lightTheme;

/** Mutable palette — updated by `applyThemeMode` so existing `import { Colors }` usage stays valid. */
export const Colors: AppColors = { ...lightTheme };

/** Gradient for primary actions (white label text). */
export const primaryButtonGradient: [string, string] = ['#3B82F6', '#2563EB'];

export function applyThemeMode(mode: ThemeMode): void {
  const next = mode === 'dark' ? darkTheme : lightTheme;
  (Object.keys(next) as (keyof AppColors)[]).forEach((key) => {
    (Colors as Record<string, string>)[key] = next[key];
  });
}
