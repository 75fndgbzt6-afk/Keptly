import React, { useState } from 'react';
import { View, LayoutChangeEvent } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import { useTheme } from '@/components/theme';

interface HeatmapProps {
  /** Daily counts, oldest → newest. Rendered as the most recent `weeks`*7 days. */
  counts: number[];
  weeks?: number;
  accent: string;
}

/** GitHub-contribution-style density grid: columns = weeks, 7 cells each. */
export function Heatmap({ counts, weeks = 12, accent }: HeatmapProps) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  const cells = weeks * 7;
  const recent = counts.slice(-cells);
  const padded = [...new Array(Math.max(0, cells - recent.length)).fill(0), ...recent];
  const max = Math.max(1, ...padded);

  const gap = 3;
  const cell = width > 0 ? (width - gap * (weeks - 1)) / weeks : 0;
  const height = cell > 0 ? cell * 7 + gap * 6 : 0;

  const tierColor = (count: number): string => {
    if (count <= 0) return theme.colors.surfaceAlt;
    const t = count / max;
    const opacity = t > 0.75 ? 1 : t > 0.5 ? 0.8 : t > 0.25 ? 0.55 : 0.32;
    return withOpacity(accent, opacity);
  };

  return (
    <View style={{ width: '100%' }} onLayout={onLayout}>
      {cell > 0 ? (
        <Svg width={width} height={height}>
          {padded.map((count, i) => {
            const col = Math.floor(i / 7);
            const row = i % 7;
            return (
              <Rect
                key={i}
                x={col * (cell + gap)}
                y={row * (cell + gap)}
                width={cell}
                height={cell}
                rx={2}
                fill={tierColor(count)}
              />
            );
          })}
        </Svg>
      ) : null}
    </View>
  );
}

/** Apply an alpha to a #RRGGBB color → #RRGGBBAA. */
function withOpacity(hex: string, opacity: number): string {
  const a = Math.round(Math.max(0, Math.min(1, opacity)) * 255)
    .toString(16)
    .padStart(2, '0');
  return `${hex}${a}`;
}
