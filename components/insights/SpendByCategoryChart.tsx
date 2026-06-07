import React, { useState } from 'react';
import { View, TouchableOpacity, LayoutChangeEvent, StyleSheet } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import { AppText } from '@/components/ui';
import { theme } from '@/constants/theme';
import { Category } from '@/types';
import { CategorySpend } from '@/services/dashboard';
import { formatCurrency } from '@/lib/currency';

interface SpendByCategoryChartProps {
  data: CategorySpend[];
  onSelect?: (category: Category) => void;
}

const BAR_HEIGHT = 10;

/** Calm single-accent horizontal bars, one row per category, tap to drill in. */
export function SpendByCategoryChart({ data, onSelect }: SpendByCategoryChartProps) {
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);
  const max = Math.max(1, ...data.map((d) => d.monthlyAmount));

  return (
    <View style={styles.container}>
      {data.map((row) => {
        const barW = width > 0 ? Math.max(2, (row.monthlyAmount / max) * width) : 0;
        return (
          <TouchableOpacity
            key={row.category}
            activeOpacity={onSelect ? 0.7 : 1}
            disabled={!onSelect}
            onPress={() => onSelect?.(row.category)}
            style={styles.row}
            accessibilityRole={onSelect ? 'button' : undefined}
            accessibilityLabel={`${row.category}, ${formatCurrency(row.monthlyAmount)} per month`}
          >
            <View style={styles.labelRow}>
              <AppText size="sm" numberOfLines={1} style={styles.label}>
                {row.category}
              </AppText>
              <AppText size="sm" weight="medium" color={theme.colors.text.secondary}>
                {formatCurrency(row.monthlyAmount)}
              </AppText>
            </View>
            <View style={styles.track} onLayout={onLayout}>
              {width > 0 ? (
                <Svg width={width} height={BAR_HEIGHT}>
                  <Rect x={0} y={0} width={width} height={BAR_HEIGHT} rx={BAR_HEIGHT / 2} fill={theme.colors.surfaceAlt} />
                  <Rect x={0} y={0} width={barW} height={BAR_HEIGHT} rx={BAR_HEIGHT / 2} fill={theme.colors.accent} />
                </Svg>
              ) : null}
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: theme.spacing.md,
  },
  row: {
    gap: theme.spacing.xs,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.sm,
  },
  label: {
    flex: 1,
  },
  track: {
    width: '100%',
    height: BAR_HEIGHT,
  },
});
