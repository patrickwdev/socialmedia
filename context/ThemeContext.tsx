import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { View, ActivityIndicator, StyleSheet, type ViewStyle } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import { applyThemeMode, Colors, type ThemeMode } from '@/constants/Colors';

const THEME_STORAGE_KEY = '@champion_highlights_theme_mode';

type ThemeContextValue = {
  theme: ThemeMode;
  setTheme: (mode: ThemeMode) => Promise<void>;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>('light');
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        const initial: ThemeMode = stored === 'dark' ? 'dark' : 'light';
        applyThemeMode(initial);
        if (!cancelled) {
          setThemeState(initial);
        }
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setTheme = useCallback(async (mode: ThemeMode) => {
    applyThemeMode(mode);
    setThemeState(mode);
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, mode);
    } catch {
      // ignore persistence errors
    }
  }, []);

  const value = useMemo(() => ({ theme, setTheme }), [theme, setTheme]);

  if (!hydrated) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background }}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function ThemeStatusBar() {
  const { theme } = useTheme();
  return <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return ctx;
}

/** Merged after static styles so `backgroundColor` tracks light/dark (StyleSheet values are fixed at import time). */
export function useThemeBackgroundStyle(): ViewStyle {
  const { theme } = useTheme();
  return useMemo(() => ({ backgroundColor: Colors.background }), [theme]);
}

/**
 * Recreates a StyleSheet when `theme` changes so `Colors.*` references stay in sync.
 * (Module-level `StyleSheet.create({ color: Colors.text })` captures light palette forever.)
 */
/** Return type is loose: `StyleSheet.create` widens style literals vs `ViewStyle` / `TextStyle`. */
export function useThemedStylesheet(factory: () => Record<string, unknown>): any {
  const { theme } = useTheme();
  return useMemo(() => StyleSheet.create(factory() as never), [theme]);
}
