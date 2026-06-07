import React, { useState } from 'react';
import { View, LayoutChangeEvent, StyleSheet } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop, Line } from 'react-native-svg';
import { useTheme } from '@/components/theme';

interface AreaChartProps {
  /** Values oldest → newest. */
  data: number[];
  color: string;
  height?: number;
}

/** Build a smooth (Catmull-Rom → Bézier) path through the points. */
function smoothLine(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return '';
  let d = `M${pts[0].x},${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i += 1) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
  }
  return d;
}

/** Clean single-accent area chart: smooth curve, soft gradient, no dots. */
export function AreaChart({ data, color, height = 120 }: AreaChartProps) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  const padY = 12;
  const n = data.length;
  const max = Math.max(1, ...data);
  const min = Math.min(...data);
  const span = Math.max(1, max - min);
  const gradId = 'areaFill';

  const pts =
    width > 0 && n > 1
      ? data.map((v, i) => ({
          x: (i / (n - 1)) * width,
          y: padY + (1 - (v - min) / span) * (height - padY * 2),
        }))
      : [];

  const line = smoothLine(pts);
  const area = pts.length
    ? `${line} L${pts[pts.length - 1].x},${height} L${pts[0].x},${height} Z`
    : '';

  return (
    <View style={[styles.container, { height }]} onLayout={onLayout}>
      {pts.length > 0 ? (
        <Svg width={width} height={height}>
          <Defs>
            <LinearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={color} stopOpacity={0.22} />
              <Stop offset="1" stopColor={color} stopOpacity={0} />
            </LinearGradient>
          </Defs>
          <Line x1={0} y1={height - 0.5} x2={width} y2={height - 0.5} stroke={theme.colors.border} strokeWidth={1} />
          <Path d={area} fill={`url(#${gradId})`} />
          <Path d={line} fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%', justifyContent: 'center' },
});
