import React, { createContext, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { Theme, lightTheme, darkTheme } from '@/constants/theme';
import { useThemeStore } from '@/stores/themeStore';

const ThemeContext = createContext<Theme>(lightTheme);

/** The active theme (already resolved for light/dark/system). */
export function useTheme(): Theme {
  return useContext(ThemeContext);
}

/**
 * Build a StyleSheet from the active theme. `factory` must be a stable
 * module-level function so the memo only recomputes when the theme changes.
 */
export function useThemedStyles<T>(factory: (theme: Theme) => T): T {
  const theme = useTheme();
  return useMemo(() => factory(theme), [theme, factory]);
}

/**
 * Resolves the user's appearance preference against the OS color scheme and
 * provides the active Theme to the tree. "system" follows the OS live.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const mode = useThemeStore((s) => s.mode);
  const systemScheme = useColorScheme();

  const theme = useMemo<Theme>(() => {
    const resolved = mode === 'system' ? systemScheme ?? 'light' : mode;
    return resolved === 'dark' ? darkTheme : lightTheme;
  }, [mode, systemScheme]);

  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}
