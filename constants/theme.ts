export const theme = {
  colors: {
    background: '#F7F6F3',
    surface: '#FFFFFF',
    surfaceAlt: '#F0EFEC',
    border: '#E8E6E0',
    text: {
      primary: '#1C1B18',
      secondary: '#72706B',
      tertiary: '#A09E99',
      inverse: '#FFFFFF',
    },
    // One accent: calm indigo
    accent: '#4F46E5',
    accentLight: '#ECEFFE',
    // Semantic urgency colors (used sparingly)
    status: {
      good: '#16A34A',
      warning: '#D97706',
      danger: '#DC2626',
      goodLight: '#F0FDF4',
      warningLight: '#FFFBEB',
      dangerLight: '#FEF2F2',
    },
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    base: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },
  fontSize: {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 20,
    xl: 24,
    xxl: 32,
  },
  lineHeight: {
    xs: 16,
    sm: 20,
    md: 24,
    lg: 28,
    xl: 32,
    xxl: 40,
  },
  radius: {
    sm: 8,
    md: 12,
    lg: 16,
    full: 9999,
  },
  shadow: {
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
      shadowOpacity: 0.10,
      shadowRadius: 12,
      elevation: 5,
    },
  },
} as const;

export type Theme = typeof theme;
