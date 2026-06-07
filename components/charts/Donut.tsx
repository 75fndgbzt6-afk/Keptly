import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import { useTheme } from '@/components/theme';

export interface DonutSlice {
  value: number;
  color: string;
}

interface DonutProps {
  data: DonutSlice[];
  size?: number;
  thickness?: number;
  /** Centered content (e.g. total). */
  children?: React.ReactNode;
}

/** A calm donut chart. Slices are drawn from the top, clockwise. */
export function Donut({ data, size = 90, thickness = 14, children }: DonutProps) {
  const theme = useTheme();
  const total = data.reduce((s, d) => s + Math.max(0, d.value), 0);
  const cx = size / 2;
  const cy = size / 2;
  const r = (size - thickness) / 2;
  const circ = 2 * Math.PI * r;

  let offset = 0;
  const slices = total > 0
    ? data
        .filter((d) => d.value > 0)
        .map((d, i) => {
          const len = (d.value / total) * circ;
          const seg = (
            <Circle
              key={i}
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke={d.color}
              strokeWidth={thickness}
              strokeDasharray={`${len} ${circ - len}`}
              strokeDashoffset={-offset}
            />
          );
          offset += len;
          return seg;
        })
    : [];

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Circle cx={cx} cy={cy} r={r} fill="none" stroke={theme.colors.surfaceAlt} strokeWidth={thickness} />
        <G rotation={-90} origin={`${cx}, ${cy}`}>
          {slices}
        </G>
      </Svg>
      {children ? <View style={[styles.center, { width: size, height: size }]}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
