import React, { useState } from 'react';
import { View, LayoutChangeEvent, StyleSheet } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop, Circle } from 'react-native-svg';
import { useTheme } from '@/components/theme';

interface AreaChartProps {
  /** Values oldest → newest. */
  data: number[];
  color: string;
  height?: number;
}

/** Single-accent area chart that fades to transparent. No axes, no animation. */
export function AreaChart({ data, color, height = 120 }: AreaChartProps) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  const padY = 10;
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

  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
  const area = pts.length
    ? `${line} L${pts[pts.length - 1].x},${height} L${pts[0].x},${height} Z`
    : '';

  return (
    <View style={[styles.container, { height }]} onLayout={onLayout}>
      {pts.length > 0 ? (
        <Svg width={width} height={height}>
          <Defs>
            <LinearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={color} stopOpacity={0.28} />
              <Stop offset="1" stopColor={color} stopOpacity={0} />
            </LinearGradient>
          </Defs>
          <Path d={area} fill={`url(#${gradId})`} />
          <Path d={line} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" />
          {pts.map((p, i) => (
            <Circle key={i} cx={p.x} cy={p.y} r={2} fill={color} />
          ))}
        </Svg>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%', justifyContent: 'center' },
});
