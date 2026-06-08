import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
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
  /** When set, this slice pops out and all others dim. */
  selectedIndex?: number | null;
  /** Called when the user taps a slice; passes null to deselect. */
  onSelect?: (index: number | null) => void;
  /** Centered content (e.g. total label). */
  children?: React.ReactNode;
}

/** Build a donut-ring arc path between two angles (radians, clockwise from top). */
function ringArc(
  cx: number,
  cy: number,
  outerR: number,
  innerR: number,
  startAngle: number,
  endAngle: number,
): string {
  const cos = Math.cos;
  const sin = Math.sin;
  // Clamp to avoid degenerate full-circle arcs
  const sweep = Math.min(endAngle - startAngle, Math.PI * 2 - 0.001);
  const end = startAngle + sweep;
  const large = sweep > Math.PI ? 1 : 0;
  const ox1 = cx + outerR * cos(startAngle);
  const oy1 = cy + outerR * sin(startAngle);
  const ox2 = cx + outerR * cos(end);
  const oy2 = cy + outerR * sin(end);
  const ix1 = cx + innerR * cos(end);
  const iy1 = cy + innerR * sin(end);
  const ix2 = cx + innerR * cos(startAngle);
  const iy2 = cy + innerR * sin(startAngle);
  return (
    `M${ox1},${oy1} A${outerR},${outerR},0,${large},1,${ox2},${oy2}` +
    ` L${ix1},${iy1} A${innerR},${innerR},0,${large},0,${ix2},${iy2} Z`
  );
}

/** A clean, segmented donut. Tapping a slice pops it out and dims the rest. */
export function Donut({
  data,
  size = 90,
  thickness = 14,
  gap = 3,
  selectedIndex = null,
  onSelect,
  children,
}: DonutProps) {
  const theme = useTheme();
  const popOut = 8;
  const cx = size / 2;
  const cy = size / 2;
  // Leave room for the selected slice to shift outward without clipping.
  const outerR = (size / 2) - popOut - 2;
  const innerR = outerR - thickness;
  const midR = (outerR + innerR) / 2;

  const total = data.reduce((s, d) => s + Math.max(0, d.value), 0);
  const slices = data.filter((d) => d.value > 0);
  const hasSelection = selectedIndex != null;
  const gapAngle = slices.length > 1 ? gap / outerR : 0;

  const START = -Math.PI / 2; // top
  let cursor = START;

  const segments = total > 0
    ? slices.map((d, i) => {
        const frac = d.value / total;
        const sliceAngle = frac * (2 * Math.PI - gapAngle * slices.length);
        const startAngle = cursor + gapAngle / 2;
        const endAngle = startAngle + sliceAngle;
        cursor = endAngle + gapAngle / 2;

        const midAngle = (startAngle + endAngle) / 2;
        const selected = selectedIndex === i;
        const tx = selected ? Math.cos(midAngle) * popOut : 0;
        const ty = selected ? Math.sin(midAngle) * popOut : 0;

        return (
          <Path
            key={i}
            d={ringArc(cx + tx, cy + ty, outerR, innerR, startAngle, endAngle)}
            fill={d.color}
            opacity={hasSelection && !selected ? 0.18 : 1}
            onPress={onSelect ? () => onSelect(selected ? null : i) : undefined}
          />
        );
      })
    : [];

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        {/* Track ring */}
        <Circle
          cx={cx}
          cy={cy}
          r={midR}
          fill="none"
          stroke={theme.colors.surfaceAlt}
          strokeWidth={thickness}
        />
        {segments}
      </Svg>
      {children ? (
        <View style={[styles.center, { width: size, height: size }]}>{children}</View>
      ) : null}
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
