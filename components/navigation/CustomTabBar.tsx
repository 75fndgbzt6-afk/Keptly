/**
 * CustomTabBar — works with @react-navigation/material-top-tabs.
 *
 * Animation strategy (all UI-thread, zero JS re-renders per frame):
 *   • The navigator passes `position: Animated.AnimatedInterpolation<number>`
 *     which is connected to the PagerView scroll position via native driver.
 *   • Each tab renders TWO icons — accent (active) and tertiary (inactive) —
 *     stacked in absolute position. Their opacities are driven by
 *     `position.interpolate` with useNativeDriver, so the crossfade follows
 *     the finger 1:1 at 60 fps on the UI thread.
 *   • A small accent dot indicator below each icon fades the same way.
 *   • A thin animated sliding line under the whole bar interpolates from the
 *     `position` value across the 5-slot bar geometry (4 tabs + 1 "+" gap)
 *     using Animated.multiply — no JS measurement needed.
 */
import React, { useRef } from 'react';
import { View, TouchableOpacity, StyleSheet, Animated, Dimensions } from 'react-native';
import type { MaterialTopTabBarProps } from '@react-navigation/material-top-tabs';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Theme } from '@/constants/theme';
import { useTheme, useThemedStyles } from '@/components/theme';
import { AppText } from '@/components/ui/AppText';
import { hapticSelection } from '@/lib/haptics';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

interface TabConfig {
  active: IoniconName;
  inactive: IoniconName;
  label: string;
}

const TAB_CONFIG: Record<string, TabConfig> = {
  index:    { active: 'home',      inactive: 'home-outline',      label: 'Home'     },
  items:    { active: 'list',      inactive: 'list-outline',      label: 'Items'    },
  calendar: { active: 'calendar',  inactive: 'calendar-outline',  label: 'Calendar' },
  insights: { active: 'bar-chart', inactive: 'bar-chart-outline', label: 'Insights' },
};

// The bar has 5 equal visual slots: [Home][Items][+][Calendar][Insights].
// Tab indices map to visual slot indices (skipping slot 2 for the "+" button).
const TAB_SLOT: Record<number, number> = { 0: 0, 1: 1, 2: 3, 3: 4 };

export function CustomTabBar({ state, navigation, position }: MaterialTopTabBarProps) {
  const theme   = useTheme();
  const styles  = useThemedStyles(makeStyles);
  const insets  = useSafeAreaInsets();
  const router  = useRouter();
  const barWidthRef = useRef(Dimensions.get('window').width);

  // ── Tap handler ─────────────────────────────────────────────────────────────
  const tapTab = (routeIndex: number) => {
    const route = state.routes[routeIndex];
    if (!route) return;
    const isFocused = state.index === routeIndex;
    const event = navigation.emit({
      type: 'tabPress',
      target: route.key,
      canPreventDefault: true,
    });
    if (!isFocused && !event.defaultPrevented) {
      hapticSelection();
      navigation.navigate(route.name, route.params);
    }
  };

  // ── Sliding indicator ────────────────────────────────────────────────────────
  // The indicator translates across 5 equal slots. `position` interpolates
  // from 0→3 (page indices) which maps to slot positions 0→1→3→4 (skipping
  // the "+" slot). We compute translateX = slotCenter(mappedSlot) entirely
  // via Animated.multiply/add — no JS measurement, pure native driver.
  //
  // slotWidth = barWidth / 5
  // slotCenter(slot) = slot * slotWidth + slotWidth / 2
  //
  // Mapped positions for pages 0-3: slots 0, 1, 3, 4
  // → slotCenter values = [0.1W, 0.3W, 0.7W, 0.9W]
  //
  // We pre-express those as a ratio of barWidth so a single Animated.multiply
  // can compute the pixel value without knowing barWidth at setup time.
  //   position 0→1 = ratio 0.1→0.3  (slot 0→1)
  //   position 1→2 = ratio 0.3→0.7  (slot 1→3, jumps the "+" slot)
  //   position 2→3 = ratio 0.7→0.9  (slot 3→4)
  const indicatorRatio = position.interpolate({
    inputRange:  [0, 1, 2, 3],
    outputRange: [0.1, 0.3, 0.7, 0.9],
    extrapolate: 'clamp',
  });

  // Multiply by measured bar width on layout update (starts at screen width).
  const barWidthAnim = useRef(new Animated.Value(barWidthRef.current)).current;
  const indicatorX   = Animated.multiply(indicatorRatio, barWidthAnim);

  // ── Render a single tab ──────────────────────────────────────────────────────
  const renderTab = (routeIndex: number) => {
    const route = state.routes[routeIndex];
    if (!route) return null;
    const config = TAB_CONFIG[route.name];
    if (!config) return null;

    // Per-tab opacity driven by position — no JS callbacks per frame.
    const activeOpacity = position.interpolate({
      inputRange:  [routeIndex - 1, routeIndex, routeIndex + 1],
      outputRange: [0, 1, 0],
      extrapolate: 'clamp',
    });
    const inactiveOpacity = position.interpolate({
      inputRange:  [routeIndex - 1, routeIndex, routeIndex + 1],
      outputRange: [1, 0, 1],
      extrapolate: 'clamp',
    });

    return (
      <TouchableOpacity
        key={route.key}
        style={styles.tab}
        activeOpacity={0.65}
        accessibilityRole="button"
        accessibilityLabel={config.label}
        accessibilityState={{ selected: state.index === routeIndex }}
        onPress={() => tapTab(routeIndex)}
      >
        {/* Stacked icons: accent fades in when active, tertiary fades in when inactive */}
        <View style={styles.iconStack}>
          <Animated.View style={{ opacity: inactiveOpacity }}>
            <Ionicons name={config.inactive} size={22} color={theme.colors.text.tertiary} />
          </Animated.View>
          <Animated.View style={[StyleSheet.absoluteFill, styles.iconCenter, { opacity: activeOpacity }]}>
            <Ionicons name={config.active} size={22} color={theme.colors.accent} />
          </Animated.View>
        </View>

        {/* Label — static colour change is fine since it only triggers on JS-thread tab press */}
        <AppText
          size="xs"
          weight={state.index === routeIndex ? 'medium' : 'regular'}
          color={state.index === routeIndex ? theme.colors.accent : theme.colors.text.tertiary}
        >
          {config.label}
        </AppText>

        {/* Per-tab dot indicator (fades with page scroll on UI thread) */}
        <Animated.View style={[styles.dot, { backgroundColor: theme.colors.accent, opacity: activeOpacity }]} />
      </TouchableOpacity>
    );
  };

  return (
    <View
      style={[styles.container, { paddingBottom: Math.max(insets.bottom, 8) }]}
      onLayout={(e) => {
        const w = e.nativeEvent.layout.width;
        barWidthRef.current = w;
        barWidthAnim.setValue(w);
      }}
    >
      {/* Sliding accent line — absolutely positioned, follows page scroll natively */}
      <Animated.View
        style={[
          styles.slidingLine,
          { backgroundColor: theme.colors.accent },
          { transform: [{ translateX: Animated.subtract(indicatorX, new Animated.Value(18)) }] },
        ]}
      />

      <View style={styles.bar}>
        {renderTab(0)}
        {renderTab(1)}

        {/* Centre "+" — not part of the pager sequence */}
        <View style={styles.addWrapper}>
          <TouchableOpacity
            style={styles.addButton}
            activeOpacity={0.8}
            onPress={() => router.push('/(modal)/add-item')}
            accessibilityLabel="Add item"
            accessibilityRole="button"
          >
            <Ionicons name="add" size={28} color={theme.colors.text.inverse} />
          </TouchableOpacity>
        </View>

        {renderTab(2)}
        {renderTab(3)}
      </View>
    </View>
  );
}

const makeStyles = (theme: Theme) => StyleSheet.create({
  container: {
    backgroundColor: theme.colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: theme.spacing.sm,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    gap: 2,
    paddingBottom: 4,
  },
  iconStack: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCenter: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 2,
  },
  slidingLine: {
    position: 'absolute',
    top: 0,
    width: 36,
    height: 2,
    borderRadius: 1,
  },
  addWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 4,
  },
  addButton: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: theme.colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -16,
    shadowColor: theme.colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
});
