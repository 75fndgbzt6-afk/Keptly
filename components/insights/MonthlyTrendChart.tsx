import React, { useState } from 'react';
import { View, LayoutChangeEvent, StyleSheet } from 'react-native';
import Svg, { Polyline, Circle } from 'react-native-svg';
import { Theme } from '@/constants/theme';
import { useTheme, useThemedStyles } from '@/components/theme';

interface MonthlyTrendChartProps {
  /** Monthly totals, oldest → newest. */
  data: number[];
  height?: number;
}

/** A calm single-accent line chart of monthly totals. */
export function MonthlyTrendChart({ data, height = 96 }: MonthlyTrendChartProps) {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  const padX = 6;
  const padY = 10;
  const n = data.length;
  const max = Math.max(1, ...data);
  const min = Math.min(...data);
  const span = Math.max(1, max - min);

  const points =
    width > 0 && n > 1
      ? data.map((v, i) => {
          const x = padX + (i / (n - 1)) * (width - padX * 2);
          const y = padY + (1 - (v - min) / span) * (height - padY * 2);
          return { x, y };
        })
      : [];

  const polyline = points.map((p) => `${p.x},${p.y}`).join(' ');

  return (
    <View style={[styles.container, { height }]} onLayout={onLayout}>
      {points.length > 0 ? (
        <Svg width={width} height={height}>
          <Polyline
            points={polyline}
            fill="none"
            stroke={theme.colors.accent}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {points.map((p, i) => (
            <Circle key={i} cx={p.x} cy={p.y} r={2.5} fill={theme.colors.accent} />
          ))}
        </Svg>
      ) : null}
    </View>
  );
}

const makeStyles = (theme: Theme) => StyleSheet.create({
  container: {
    width: '100%',
    justifyContent: 'center',
  },
});
