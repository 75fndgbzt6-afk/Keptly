import React from 'react';
import { Text, TextStyle } from 'react-native';
import { fontSize, lineHeight } from '@/constants/theme';
import { useTheme } from '@/components/theme';

type TextSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl';
type TextWeight = 'regular' | 'medium' | 'semibold' | 'bold';

const FONT_FAMILY: Record<TextWeight, string> = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
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
  color,
  align = 'left',
  numberOfLines,
  style,
}: AppTextProps) {
  const theme = useTheme();
  return (
    <Text
      numberOfLines={numberOfLines}
      style={[
        {
          fontFamily: FONT_FAMILY[weight],
          fontSize: fontSize[size],
          lineHeight: lineHeight[size],
          color: color ?? theme.colors.text.primary,
          textAlign: align,
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}
