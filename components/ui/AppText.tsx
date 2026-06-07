import React from 'react';
import { Text, TextStyle } from 'react-native';
import { theme } from '@/constants/theme';

type TextSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl';
type TextWeight = 'regular' | 'medium' | 'semibold' | 'bold';

const FONT_FAMILY: Record<TextWeight, string> = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
};

const FONT_SIZE: Record<TextSize, number> = {
  xs: theme.fontSize.xs,
  sm: theme.fontSize.sm,
  md: theme.fontSize.md,
  lg: theme.fontSize.lg,
  xl: theme.fontSize.xl,
  xxl: theme.fontSize.xxl,
};

const LINE_HEIGHT: Record<TextSize, number> = {
  xs: theme.lineHeight.xs,
  sm: theme.lineHeight.sm,
  md: theme.lineHeight.md,
  lg: theme.lineHeight.lg,
  xl: theme.lineHeight.xl,
  xxl: theme.lineHeight.xxl,
};

interface AppTextProps {
  children: React.ReactNode;
  size?: TextSize;
  weight?: TextWeight;
  color?: string;
  align?: 'left' | 'center' | 'right';
  numberOfLines?: number;
  style?: TextStyle;
}

export function AppText({
  children,
  size = 'md',
  weight = 'regular',
  color = theme.colors.text.primary,
  align = 'left',
  numberOfLines,
  style,
}: AppTextProps) {
  return (
    <Text
      numberOfLines={numberOfLines}
      style={[
        {
          fontFamily: FONT_FAMILY[weight],
          fontSize: FONT_SIZE[size],
          lineHeight: LINE_HEIGHT[size],
          color,
          textAlign: align,
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}
