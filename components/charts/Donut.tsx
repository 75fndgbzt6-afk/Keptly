import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { View, StyleSheet, Animated, PanResponder } from 'react-native';
import Svg, { G, Path, Circle } from 'react-native-svg';
import { hapticSelection } from '@/lib/haptics';
import { useTheme } from '@/components/theme';

export interface DonutSlice {
  value: number;
  color: string;
}

interface DonutProps {
  data: DonutSlice[];
  size?: number;
  thickness?: number;
  gap?: number;
  selectedIndex?: number | null;
  onSelect?: (index: number | null) => void;
  /** Called when a ring-touch begins — use to disable parent ScrollView. */
  onInteractionStart?: () => void;
  /** Called when the touch ends — use to re-enable parent ScrollView. */
  onInteractionEnd?: () => void;
  children?: React.ReactNode;
}

function ringArc(
  cx: number,
  cy: number,
  outerR: number,
  innerR: number,
  startAngle: number,
  endAngle: number,
): string {
  const sweep = Math.min(endAngle - startAngle, Math.PI * 2 - 0.001);
  const end = startAngle + sweep;
  const large = sweep > Math.PI ? 1 : 0;
  return (
    `M${cx + outerR * Math.cos(startAngle)},${cy + outerR * Math.sin(startAngle)}` +
    ` A${outerR},${outerR},0,${large},1,${cx + outerR * Math.cos(end)},${cy + outerR * Math.sin(end)}` +
    ` L${cx + innerR * Math.cos(end)},${cy + innerR * Math.sin(end)}` +
    ` A${innerR},${innerR},0,${large},0,${cx + innerR * Math.cos(startAngle)},${cy + innerR * Math.sin(startAngle)} Z`
  );
}

const AnimatedG = Animated.createAnimatedComponent(G);
const START = -Math.PI / 2;
// Arcs smaller than ~1.1° are hidden to prevent SVG rendering artefacts.
const MIN_SWEEP = 0.02;

export function Donut({
  data,
  size = 90,
  thickness = 14,
  gap = 3,
  selectedIndex = null,
  onSelect,
  onInteractionStart,
  onInteractionEnd,
  children,
}: DonutProps) {
  const theme = useTheme();
  const popOut = 8;
  const cx = size / 2;
  const cy = size / 2;
  const outerR = size / 2 - popOut - 2;
  const innerR = outerR - thickness;
  const midR = (outerR + innerR) / 2;

  // ── Slice geometry ────────────────────────────────────────────────────────
  const slices = useMemo(() => {
    const active = data.filter((d) => d.value > 0);
    const total = active.reduce((s, d) => s + d.value, 0);
    if (total === 0) return [];
    const gapAngle = active.length > 1 ? gap / outerR : 0;
    let cursor = START;
    return active.map((d) => {
      const sliceAngle = (d.value / total) * (2 * Math.PI - gapAngle * active.length);
      const startAngle = cursor + gapAngle / 2;
      const endAngle = startAngle + sliceAngle;
      cursor = endAngle + gapAngle / 2;
      const midAngle = (startAngle + endAngle) / 2;
      const sweep = Math.max(0, Math.min(sliceAngle, Math.PI * 2 - 0.001));
      return {
        startAngle,
        endAngle,
        midAngle,
        sweep,
        // Slices too tiny to render cleanly are hidden but stay in the array
        // so parent selectedIndex values stay in sync with donutData indices.
        visible: sweep >= MIN_SWEEP,
        color: d.color,
        txTarget: Math.cos(midAngle) * popOut,
        tyTarget: Math.sin(midAngle) * popOut,
      };
    });
  }, [data, gap, outerR, popOut]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Per-slice Animated.Values ──────────────────────────────────────────────
  const animsRef = useRef<{
    tx: Animated.Value[];
    ty: Animated.Value[];
    op: Animated.Value[];
  } | null>(null);

  if (!animsRef.current || animsRef.current.tx.length !== slices.length) {
    animsRef.current = {
      tx: slices.map(() => new Animated.Value(0)),
      ty: slices.map(() => new Animated.Value(0)),
      op: slices.map(() => new Animated.Value(1)),
    };
  }
  const anims = animsRef.current;

  useEffect(() => {
    const hasSel = selectedIndex !== null;
    Animated.parallel(
      slices.flatMap((s, i) => {
        const isSel = selectedIndex === i;
        return [
          Animated.spring(anims.tx[i], { toValue: isSel ? s.txTarget : 0, useNativeDriver: false, speed: 24, bounciness: 0 }),
          Animated.spring(anims.ty[i], { toValue: isSel ? s.tyTarget : 0, useNativeDriver: false, speed: 24, bounciness: 0 }),
          Animated.spring(anims.op[i], { toValue: !hasSel || isSel ? 1 : 0.18, useNativeDriver: false, speed: 24, bounciness: 0 }),
        ];
      }),
    ).start();
  }, [selectedIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Stable refs for PanResponder callbacks ────────────────────────────────
  const slicesRef = useRef(slices);
  slicesRef.current = slices;
  const selectedRef = useRef(selectedIndex);
  selectedRef.current = selectedIndex;
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const onStartRef = useRef(onInteractionStart);
  onStartRef.current = onInteractionStart;
  const onEndRef = useRef(onInteractionEnd);
  onEndRef.current = onInteractionEnd;

  // ── Hit test: minimum-territory Voronoi ───────────────────────────────────
  // Each slice gets at least MIN_HALF_TERRITORY of angular zone, so small
  // slices aren't skipped when dragging quickly.
  const MIN_HALF_TERRITORY = Math.PI / 6; // 30° guaranteed half-zone per slice
  const hitTest = useCallback(
    (lx: number, ly: number): number | null => {
      const dx = lx - cx;
      const dy = ly - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < innerR - 6 || dist > outerR + popOut + 6) return null;
      const geo = slicesRef.current;
      if (geo.length === 0) return null;

      const angle =
        ((Math.atan2(dy, dx) - START) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);

      let best = -1;
      let bestScore = Infinity;
      let bestAngDist = Infinity;
      for (let i = 0; i < geo.length; i++) {
        // Skip invisible slices — they can't be tapped meaningfully.
        if (!geo[i].visible) continue;
        const mid =
          ((geo[i].midAngle - START) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
        const angDist = Math.min(Math.abs(angle - mid), 2 * Math.PI - Math.abs(angle - mid));
        // Territory = max of natural half-span vs minimum guaranteed zone.
        const halfSpan = (geo[i].endAngle - geo[i].startAngle) / 2;
        const territory = Math.max(halfSpan, MIN_HALF_TERRITORY);
        // Score = how far outside this slice's territory the touch is (0 = inside).
        const score = Math.max(0, angDist - territory);
        // Tiebreak by angular distance: when multiple slices overlap in their minimum
        // territories, the one whose midAngle is closest to the touch wins.
        if (score < bestScore || (score === bestScore && angDist < bestAngDist)) {
          bestScore = score;
          bestAngDist = angDist;
          best = i;
        }
      }
      return best >= 0 ? best : null;
    },
    [cx, cy, innerR, outerR, popOut], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const hitTestRef = useRef(hitTest);
  hitTestRef.current = hitTest;

  // ── PanResponder ──────────────────────────────────────────────────────────
  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: (evt) =>
        !!onSelectRef.current &&
        hitTestRef.current(evt.nativeEvent.locationX, evt.nativeEvent.locationY) !== null,
      // Never steal move events — prevents ScrollView conflicts.
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (evt) => {
        const idx = hitTestRef.current(evt.nativeEvent.locationX, evt.nativeEvent.locationY);
        if (idx === null) {
          onSelectRef.current?.(null);
          return;
        }
        onStartRef.current?.();
        if (selectedRef.current !== idx) hapticSelection();
        onSelectRef.current?.(selectedRef.current === idx ? null : idx);
      },
      onPanResponderMove: (evt) => {
        const idx = hitTestRef.current(evt.nativeEvent.locationX, evt.nativeEvent.locationY);
        if (idx !== null && idx !== selectedRef.current) {
          hapticSelection();
          onSelectRef.current?.(idx);
        }
      },
      onPanResponderRelease: () => onEndRef.current?.(),
      onPanResponderTerminate: () => onEndRef.current?.(),
    }),
  ).current;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <View style={{ width: size, height: size }} {...pan.panHandlers}>
      <Svg width={size} height={size}>
        <Circle cx={cx} cy={cy} r={midR} fill="none" stroke={theme.colors.surfaceAlt} strokeWidth={thickness} />
        {slices.map((s, i) =>
          // Skip tiny arcs — they'd render as artefacts (stray pixels / micro-fills).
          // The slice still exists in the array so selectedIndex values stay in sync.
          s.visible ? (
            <AnimatedG
              key={i}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              translateX={anims.tx[i] as any}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              translateY={anims.ty[i] as any}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              opacity={anims.op[i] as any}
            >
              <Path d={ringArc(cx, cy, outerR, innerR, s.startAngle, s.endAngle)} fill={s.color} />
            </AnimatedG>
          ) : null,
        )}
      </Svg>
      {children ? (
        <View style={[styles.center, { width: size, height: size }]}>{children}</View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
});
