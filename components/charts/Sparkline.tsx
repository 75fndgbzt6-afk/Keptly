import React from 'react';
import Svg, { Polyline } from 'react-native-svg';

interface SparklineProps {
  data: number[];
  color: string;
  width?: number;
  height?: number;
}

/** Tiny inline trend line — no axes, no labels. */
export function Sparkline({ data, color, width = 64, height = 22 }: SparklineProps) {
  if (data.length < 2) return null;
  const pad = 2;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const span = Math.max(1e-6, max - min);
  const pts = data
    .map((v, i) => {
      const x = pad + (i / (data.length - 1)) * (width - pad * 2);
      const y = pad + (1 - (v - min) / span) * (height - pad * 2);
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <Svg width={width} height={height}>
      <Polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
