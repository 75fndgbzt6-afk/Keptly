import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, View, LayoutChangeEvent, PanResponder, StyleSheet } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop, Line } from 'react-native-svg';
import { useTheme } from '@/components/theme';
import { AppText } from '@/components/ui';

const Y_AXIS_W = 36;
const TOOLTIP_W = 96;
const DOT_R = 5;

interface AreaChartProps {
  data: number[];
  color: string;
  height?: number;
  labels?: string[];
  onInteractionStart?: () => void;
  onInteractionEnd?: () => void;
}

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

function shortNum(v: number): string {
  if (v >= 100000) return `${Math.round(v / 1000)}k`;
  if (v >= 1000) return `${(v / 1000).toFixed(1)}k`;
  return String(Math.round(v));
}

export function AreaChart({
  data,
  color,
  height = 120,
  labels,
  onInteractionStart,
  onInteractionEnd,
}: AreaChartProps) {
  const theme = useTheme();
  const [chartW, setChartW] = useState(0);

  const onStartRef = useRef(onInteractionStart);
  onStartRef.current = onInteractionStart;
  const onEndRef = useRef(onInteractionEnd);
  onEndRef.current = onInteractionEnd;
  const chartWRef = useRef(chartW);
  chartWRef.current = chartW;

  const padY = 12;
  const n = data.length;
  const max = Math.max(1, ...data);
  const min = Math.min(...data);
  const span = Math.max(1, max - min);
  const gradId = 'areaFill';

  const pts = useMemo(
    () =>
      chartW > 0 && n > 1
        ? data.map((v, i) => ({
            x: (i / (n - 1)) * chartW,
            y: padY + (1 - (v - min) / span) * (height - padY * 2),
          }))
        : [],
    [data, chartW, n, min, span, height],
  );
  const ptsRef = useRef(pts);
  ptsRef.current = pts;

  const line = smoothLine(pts);
  const baseY = padY + (height - padY * 2);
  const area = pts.length
    ? `${line} L${pts[pts.length - 1].x},${baseY} L${pts[0].x},${baseY} Z`
    : '';

  // ── All animated via direct setValue — zero React re-renders per pixel ──────
  // Crosshair line: translateX only
  const lineX = useRef(new Animated.Value(-2)).current;
  const lineOpacity = useRef(new Animated.Value(0)).current;
  // Dot: separate X and Y (avoids Animated.subtract which is unreliable)
  const dotX = useRef(new Animated.Value(-DOT_R - 2)).current;
  const dotY = useRef(new Animated.Value(-DOT_R - 2)).current;
  const dotOpacity = useRef(new Animated.Value(0)).current;

  // State only for tooltip TEXT — triggered at most ~n times per full scrub
  const [scrubIdx, setScrubIdx] = useState<number | null>(null);
  const scrubIdxRef = useRef<number | null>(null);

  useEffect(() => {
    lineOpacity.setValue(0);
    dotOpacity.setValue(0);
    scrubIdxRef.current = null;
    setScrubIdx(null);
  }, [data, chartW, lineOpacity, dotOpacity]);

  const handleTouch = (lx: number) => {
    const w = chartWRef.current;
    const p = ptsRef.current;
    if (w === 0 || p.length < 2) return;
    const count = p.length;
    const idx = Math.max(0, Math.min(count - 1, Math.round((lx / w) * (count - 1))));

    // Crosshair tracks the raw finger position — perfectly smooth, zero snapping.
    // Dot snaps to the nearest data-point so it stays precisely on the curve.
    lineX.setValue(lx);
    lineOpacity.setValue(1);
    dotX.setValue(p[idx].x - DOT_R);
    dotY.setValue(p[idx].y - DOT_R);
    dotOpacity.setValue(1);

    // Tooltip text: only re-render when crossing a data point boundary
    if (idx !== scrubIdxRef.current) {
      scrubIdxRef.current = idx;
      setScrubIdx(idx);
    }
  };

  const hide = () => {
    lineOpacity.setValue(0);
    dotOpacity.setValue(0);
    scrubIdxRef.current = null;
    setScrubIdx(null);
  };

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (evt) => { onStartRef.current?.(); handleTouch(evt.nativeEvent.locationX); },
      onPanResponderMove: (evt) => { handleTouch(evt.nativeEvent.locationX); },
      onPanResponderRelease: () => { onEndRef.current?.(); hide(); },
      onPanResponderTerminate: () => { onEndRef.current?.(); hide(); },
    }),
  ).current;

  const tooltipLeft =
    scrubIdx !== null && pts[scrubIdx]
      ? Math.max(4, Math.min(chartW - TOOLTIP_W - 4, pts[scrubIdx].x - TOOLTIP_W / 2))
      : 0;

  return (
    <View>
      <View style={[styles.yAxisRow, { height }]}>
        <View style={styles.yAxis}>
          <AppText size="xs" color={theme.colors.text.tertiary}>{shortNum(max)}</AppText>
          <AppText size="xs" color={theme.colors.text.tertiary}>{shortNum(min)}</AppText>
        </View>

        <View
          style={styles.chartArea}
          onLayout={(e: LayoutChangeEvent) => setChartW(e.nativeEvent.layout.width)}
          {...pan.panHandlers}
        >
          {/* Static SVG — never re-renders during interaction */}
          {pts.length > 0 ? (
            <Svg width={chartW} height={height} style={StyleSheet.absoluteFill}>
              <Defs>
                <LinearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor={color} stopOpacity={0.18} />
                  <Stop offset="1" stopColor={color} stopOpacity={0} />
                </LinearGradient>
              </Defs>
              <Line x1={0} y1={baseY + 0.5} x2={chartW} y2={baseY + 0.5}
                stroke={theme.colors.border} strokeWidth={1} />
              <Path d={area} fill={`url(#${gradId})`} />
              <Path d={line} fill="none" stroke={color} strokeWidth={2.5}
                strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          ) : null}

          {/* Crosshair line — Animated.View, position via translateX */}
          <Animated.View
            style={[styles.crosshairLine, {
              top: padY,
              height: baseY - padY,
              backgroundColor: theme.colors.text.secondary,
              opacity: lineOpacity,
              transform: [{ translateX: lineX }],
            }]}
            pointerEvents="none"
          />

          {/* Dot — separate X and Y Animated.Values, no Animated.subtract needed */}
          <Animated.View
            style={[styles.scrubDot, {
              borderColor: theme.colors.background,
              backgroundColor: color,
              opacity: dotOpacity,
              transform: [{ translateX: dotX }, { translateY: dotY }],
            }]}
            pointerEvents="none"
          />

          {/* Tooltip — only re-renders when crossing a data point */}
          {scrubIdx !== null ? (
            <View
              style={[styles.tooltip, {
                left: tooltipLeft,
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
              }]}
              pointerEvents="none"
            >
              <AppText size="xs" color={theme.colors.text.tertiary}>
                {labels?.[scrubIdx] ?? `${scrubIdx + 1}`}
              </AppText>
              <AppText size="xs" weight="semibold" color={color}>
                {shortNum(data[scrubIdx] ?? 0)}
              </AppText>
            </View>
          ) : null}
        </View>
      </View>

      {labels && labels.length > 0 ? (
        <View style={styles.xAxis}>
          <View style={styles.xAxisSpacer} />
          <View style={styles.xAxisLabels}>
            {labels.map((l, i) => (
              <AppText key={i} size="xs" color={theme.colors.text.tertiary} align="center" style={styles.xLabel}>
                {l}
              </AppText>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  yAxisRow: { flexDirection: 'row', alignItems: 'stretch' },
  yAxis: { width: Y_AXIS_W, justifyContent: 'space-between', paddingVertical: 10 },
  chartArea: { flex: 1 },
  crosshairLine: {
    position: 'absolute',
    left: 0,
    width: 1,
  },
  scrubDot: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: DOT_R * 2,
    height: DOT_R * 2,
    borderRadius: DOT_R,
    borderWidth: 2,
  },
  tooltip: {
    position: 'absolute',
    top: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    zIndex: 10,
    width: TOOLTIP_W,
  },
  xAxis: { flexDirection: 'row', marginTop: 4 },
  xAxisSpacer: { width: Y_AXIS_W },
  xAxisLabels: { flex: 1, flexDirection: 'row', justifyContent: 'space-between' },
  xLabel: { flex: 1 },
});
