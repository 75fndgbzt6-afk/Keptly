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
  /** Gap between segments, in px along the arc. */
  gap?: number;
  /** Centered content (e.g. total). */
  children?: React.ReactNode;
}

/** A clean, segmented donut. Slices start at the top, clockwise, with small gaps. */
export function Donut({ data, size = 90, thickness = 14, gap = 3, children }: DonutProps) {
  const theme = useTheme();
  const total = data.reduce((s, d) => s + Math.max(0, d.value), 0);
  const cx = size / 2;
  const cy = size / 2;
  const r = (size - thickness) / 2;
  const circ = 2 * Math.PI * r;
  const slices = data.filter((d) => d.value > 0);
  const useGap = slices.length > 1;

  let offset = 0;
  const segments = total > 0
    ? slices.map((d, i) => {
        const frac = d.value / total;
        const full = frac * circ;
        const len = Math.max(0.5, full - (useGap ? gap : 0));
        const seg = (
          <Circle
            key={i}
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={d.color}
            strokeWidth={thickness}
            strokeLinecap="butt"
            strokeDasharray={`${len} ${circ - len}`}
            strokeDashoffset={-offset}
          />
        );
        offset += full;
        return seg;
      })
    : [];

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Circle cx={cx} cy={cy} r={r} fill="none" stroke={theme.colors.surfaceAlt} strokeWidth={thickness} />
        <G rotation={-90} origin={`${cx}, ${cy}`}>
          {segments}
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
