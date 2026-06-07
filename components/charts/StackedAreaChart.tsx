import React, { useState } from 'react';
import { View, LayoutChangeEvent, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';

export interface StackSeries {
  color: string;
  /** Values oldest → newest; all series share the same length. */
  values: number[];
}

interface StackedAreaChartProps {
  series: StackSeries[];
  height?: number;
}

/** Stacked area chart (spend by category over time). Flat fills, no animation. */
export function StackedAreaChart({ series, height = 140 }: StackedAreaChartProps) {
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  const n = series[0]?.values.length ?? 0;
  // Per-point stacked totals to find the overall max for scaling.
  const totals = Array.from({ length: n }, (_, i) =>
    series.reduce((s, ser) => s + (ser.values[i] ?? 0), 0),
  );
  const max = Math.max(1, ...totals);

  const x = (i: number) => (n > 1 ? (i / (n - 1)) * width : 0);
  const y = (v: number) => height - (v / max) * height;

  // Build each band between its lower and upper cumulative line.
  const lower = new Array(n).fill(0);
  const bands = series.map((ser) => {
    const upper = lower.map((lo, i) => lo + (ser.values[i] ?? 0));
    const top = upper.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(v)}`).join(' ');
    const bottom = lower
      .map((v, i) => `L${x(n - 1 - i)},${y(lower[n - 1 - i])}`)
      .join(' ');
    const path = `${top} ${bottom} Z`;
    for (let i = 0; i < n; i += 1) lower[i] = upper[i];
    return { path, color: ser.color };
  });

  return (
    <View style={[styles.container, { height }]} onLayout={onLayout}>
      {width > 0 && n > 1 ? (
        <Svg width={width} height={height}>
          {bands.map((b, i) => (
            <Path key={i} d={b.path} fill={b.color} fillOpacity={0.85} />
          ))}
        </Svg>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%' },
});
