import React, { useState } from 'react';
import { View, LayoutChangeEvent, StyleSheet } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import { theme } from '@/constants/theme';

interface UsageChartProps {
  /** Daily totals, oldest → newest. One entry per day in the window. */
  data: number[];
  height?: number;
}

/** A calm, single-color SVG bar chart: one bar per day, flat baseline on empty days. */
export function UsageChart({ data, height = 64 }: UsageChartProps) {
  const [width, setWidth] = useState(0);

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  const max = Math.max(1, ...data);
  const n = data.length;
  const gap = 2;
  const barWidth = n > 0 && width > 0 ? Math.max(1, (width - gap * (n - 1)) / n) : 0;
  const baseline = 2; // flat stub for empty days

  return (
    <View style={[styles.container, { height }]} onLayout={onLayout}>
      {width > 0 ? (
        <Svg width={width} height={height}>
          {data.map((value, i) => {
            const x = i * (barWidth + gap);
            const h = value > 0 ? Math.max(baseline, (value / max) * height) : baseline;
            const y = height - h;
            return (
              <Rect
                key={i}
                x={x}
                y={y}
                width={barWidth}
                height={h}
                rx={1}
                fill={value > 0 ? theme.colors.accent : theme.colors.surfaceAlt}
              />
            );
          })}
        </Svg>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    justifyContent: 'flex-end',
  },
});
