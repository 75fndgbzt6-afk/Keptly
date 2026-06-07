import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import { useTheme } from '@/components/theme';

export interface ActivityRing {
  /** 0..1 fill fraction. */
  fraction: number;
  color: string;
}

interface ActivityRingsProps {
  /** Outer ring first. */
  rings: ActivityRing[];
  size?: number;
  thickness?: number;
  gap?: number;
  children?: React.ReactNode;
}

/** Apple-Watch-style concentric activity rings (rounded caps, faint tracks). */
export function ActivityRings({
  rings,
  size = 120,
  thickness = 12,
  gap = 4,
  children,
}: ActivityRingsProps) {
  const theme = useTheme();
  const cx = size / 2;
  const cy = size / 2;

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <G rotation={-90} origin={`${cx}, ${cy}`}>
          {rings.map((ring, i) => {
            const r = (size - thickness) / 2 - i * (thickness + gap);
            if (r <= 0) return null;
            const circ = 2 * Math.PI * r;
            const len = Math.max(0, Math.min(1, ring.fraction)) * circ;
            return (
              <G key={i}>
                <Circle
                  cx={cx}
                  cy={cy}
                  r={r}
                  fill="none"
                  stroke={theme.colors.surfaceAlt}
                  strokeWidth={thickness}
                />
                <Circle
                  cx={cx}
                  cy={cy}
                  r={r}
                  fill="none"
                  stroke={ring.color}
                  strokeWidth={thickness}
                  strokeLinecap="round"
                  strokeDasharray={`${len} ${circ - len}`}
                />
              </G>
            );
          })}
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
