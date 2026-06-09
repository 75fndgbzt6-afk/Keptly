import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, View, LayoutChangeEvent, PanResponder, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { hapticSelection } from '@/lib/haptics';

export interface StackSeries {
  color: string;
  /** Values oldest → newest; all series share the same length. */
  values: number[];
}

interface StackedAreaChartProps {
  series: StackSeries[];
  height?: number;
  /** Optional — present for API compatibility; not rendered. */
  seriesLabels?: string[];
  labels?: string[];
  /** Controlled selection (mirrors the Donut). */
  selectedSeries?: number | null;
  onSelectSeries?: (i: number | null) => void;
  onInteractionStart?: () => void;
  onInteractionEnd?: () => void;
}

const AnimatedPath = Animated.createAnimatedComponent(Path);

/**
 * Stacked area chart (spend by category over time).
 *
 * Interaction mirrors the Donut: tap a band to select it (the band stays vivid,
 * the others dim); tap it again — or drag across bands — to change the selection.
 * Deliberately simple: flat fills, one animated value per band, nothing else.
 */
export function StackedAreaChart({
  series,
  height = 140,
  selectedSeries: controlledSelected,
  onSelectSeries,
  onInteractionStart,
  onInteractionEnd,
}: StackedAreaChartProps) {
  const [width, setWidth] = useState(0);
  const [internalSelected, setInternalSelected] = useState<number | null>(null);
  const selected = controlledSelected !== undefined ? controlledSelected : internalSelected;

  const n = series[0]?.values.length ?? 0;
  const totals = useMemo(
    () => Array.from({ length: n }, (_, i) => series.reduce((s, ser) => s + (ser.values[i] ?? 0), 0)),
    [series, n],
  );
  const max = Math.max(1, ...totals);

  const x = (i: number) => (n > 1 ? (i / (n - 1)) * width : 0);
  const y = (v: number) => height - (v / max) * height;

  // Cumulative lower/upper bounds for each band (needed for paths AND hit-testing).
  const { bands, lo, hi } = useMemo(() => {
    const loArr: number[][] = [];
    const hiArr: number[][] = [];
    const running = new Array(n).fill(0);
    const paths = series.map((ser) => {
      const lower = [...running];
      const upper = running.map((v, i) => v + (ser.values[i] ?? 0));
      loArr.push(lower);
      hiArr.push(upper);
      const top = upper.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(v)}`).join(' ');
      const bottom = lower.map((_, i) => `L${x(n - 1 - i)},${y(lower[n - 1 - i])}`).join(' ');
      for (let i = 0; i < n; i += 1) running[i] = upper[i];
      return { path: `${top} ${bottom} Z`, color: ser.color };
    });
    return { bands: paths, lo: loArr, hi: hiArr };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [series, n, width, max, height]);

  // ── One animated opacity per band — vivid when selected/none, dim otherwise ──
  const opacities = useRef<Animated.Value[]>([]);
  if (opacities.current.length !== series.length) {
    opacities.current = series.map(() => new Animated.Value(0.85));
  }
  useEffect(() => {
    const hasSel = selected !== null;
    Animated.parallel(
      opacities.current.map((a, i) =>
        Animated.spring(a, {
          toValue: !hasSel ? 0.85 : i === selected ? 0.95 : 0.12,
          useNativeDriver: false,
          speed: 20,
          bounciness: 0,
        }),
      ),
    ).start();
  }, [selected]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Hit-test: which band is under (lx, ly)? Closest band always wins. ───────
  const widthRef = useRef(width); widthRef.current = width;
  const loRef = useRef(lo); loRef.current = lo;
  const hiRef = useRef(hi); hiRef.current = hi;
  const selectedRef = useRef(selected); selectedRef.current = selected;
  const onSelectRef = useRef(onSelectSeries); onSelectRef.current = onSelectSeries;
  const onStartRef = useRef(onInteractionStart); onStartRef.current = onInteractionStart;
  const onEndRef = useRef(onInteractionEnd); onEndRef.current = onInteractionEnd;

  const bandAt = (lx: number, ly: number): number => {
    const w = widthRef.current;
    if (w === 0 || n < 2) return -1;
    const idx = Math.max(0, Math.min(n - 1, Math.round((lx / w) * (n - 1))));
    let best = 0;
    let bestDist = Infinity;
    for (let si = 0; si < series.length; si++) {
      const top = y(hiRef.current[si][idx]);
      const bot = y(loRef.current[si][idx]);
      if (ly >= top - 6 && ly <= bot + 6) return si;
      const mid = (top + bot) / 2;
      const d = Math.abs(ly - mid);
      if (d < bestDist) { bestDist = d; best = si; }
    }
    return best;
  };
  const bandAtRef = useRef(bandAt);
  bandAtRef.current = bandAt;

  const select = (idx: number | null) => {
    setInternalSelected(idx);
    onSelectRef.current?.(idx);
  };
  const selectRef = useRef(select);
  selectRef.current = select;

  // Tap selects (toggles); dragging scrubs the selection across bands.
  const draggingRef = useRef(false);
  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (e) => {
        draggingRef.current = false;
        onStartRef.current?.();
        const si = bandAtRef.current(e.nativeEvent.locationX, e.nativeEvent.locationY);
        if (si < 0) return;
        const next = selectedRef.current === si ? null : si;
        hapticSelection();
        selectRef.current(next);
      },
      onPanResponderMove: (e) => {
        draggingRef.current = true;
        const si = bandAtRef.current(e.nativeEvent.locationX, e.nativeEvent.locationY);
        if (si >= 0 && si !== selectedRef.current) {
          hapticSelection();
          selectRef.current(si);
        }
      },
      onPanResponderRelease: () => onEndRef.current?.(),
      onPanResponderTerminate: () => onEndRef.current?.(),
    }),
  ).current;

  return (
    <View
      style={[styles.container, { height }]}
      onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
      {...pan.panHandlers}
    >
      {width > 0 && n > 1 ? (
        <Svg width={width} height={height}>
          {bands.map((b, i) => (
            <AnimatedPath
              key={i}
              d={b.path}
              fill={b.color}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              fillOpacity={opacities.current[i] as any}
            />
          ))}
        </Svg>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%' },
});
