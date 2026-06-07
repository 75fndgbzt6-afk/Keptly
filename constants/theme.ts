// Design tokens. Layout tokens (spacing/fontSize/lineHeight/radius/shadow) are
// mode-independent. Colors come in two palettes — light and dark — with identical
// structure, selected at runtime by the ThemeProvider. Never hard-code a color;
// read it from the active theme via useTheme()/useThemedStyles().

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const fontSize = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
} as const;

export const lineHeight = {
  xs: 16,
  sm: 20,
  md: 24,
  lg: 28,
  xl: 32,
  xxl: 40,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  full: 9999,
} as const;

export const shadow = {
  sm: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
} as const;

// --- Color palettes (identical shape) ---

export interface Palette {
  background: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  text: { primary: string; secondary: string; tertiary: string; inverse: string };
  accent: string;
  accentLight: string;
  status: {
    good: string;
    warning: string;
    danger: string;
    goodLight: string;
    warningLight: string;
    dangerLight: string;
  };
}

const lightColors: Palette = {
  background: '#F7F6F3',
  surface: '#FFFFFF',
  surfaceAlt: '#F0EFEC',
  border: '#E8E6E0',
  text: {
    primary: '#1C1B18',
    secondary: '#5E5C57',
    tertiary: '#8A8883',
    inverse: '#FFFFFF',
  },
  accent: '#4F46E5',
  accentLight: '#ECEFFE',
  status: {
    good: '#15803D',
    warning: '#B45309',
    danger: '#DC2626',
    goodLight: '#F0FDF4',
    warningLight: '#FFFBEB',
    dangerLight: '#FEF2F2',
  },
};

const darkColors: Palette = {
  background: '#1A1917',
  surface: '#232220',
  surfaceAlt: '#2E2C29',
  border: '#3C3A36',
  text: {
    primary: '#F4F3F0',
    secondary: '#B0AEA8',
    tertiary: '#807E78',
    inverse: '#1A1917',
  },
  accent: '#818CF8',
  accentLight: '#262747',
  status: {
    good: '#4ADE80',
    warning: '#FBBF24',
    danger: '#F87171',
    goodLight: '#16271B',
    warningLight: '#2A2410',
    dangerLight: '#2C1717',
  },
};

export type ThemeMode = 'light' | 'dark' | 'system';

export interface Theme {
  mode: 'light' | 'dark';
  colors: Palette;
  spacing: typeof spacing;
  fontSize: typeof fontSize;
  lineHeight: typeof lineHeight;
  radius: typeof radius;
  shadow: typeof shadow;
}

export const lightTheme: Theme = {
  mode: 'light',
  colors: lightColors,
  spacing,
  fontSize,
  lineHeight,
  radius,
  shadow,
};

export const darkTheme: Theme = {
  mode: 'dark',
  colors: darkColors,
  spacing,
  fontSize,
  lineHeight,
  radius,
  shadow,
};
