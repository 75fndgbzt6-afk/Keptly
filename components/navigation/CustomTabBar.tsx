/**
 * CustomTabBar — frosted-glass bottom bar with a native, finger-tracked
 * indicator (works with @react-navigation/material-top-tabs).
 *
 * Glass: native iOS UIBlurEffect (expo-blur). The root is absolutely
 * positioned so the pager screens fill the full height and scroll *behind*
 * the translucent bar (Apple Music look). Screens add TAB_BAR_CLEARANCE.
 *
 * Motion (all UI-thread, zero per-frame JS):
 *   • `position` (Animated value fed by PagerView's native scroll) drives a
 *     crossfade between each tab's active/inactive icon via interpolate.
 *   • A sliding accent line interpolates across the 5-slot bar geometry with
 *     Animated.multiply — follows the finger 1:1 at 60 fps.
 */
import React, { useRef } from 'react';
import { View, TouchableOpacity, StyleSheet, Animated, Dimensions } from 'react-native';
import { BlurView } from 'expo-blur';
import type { MaterialTopTabBarProps } from '@react-navigation/material-top-tabs';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Theme } from '@/constants/theme';
import { useTheme, useThemedStyles } from '@/components/theme';
import { AppText } from '@/components/ui/AppText';
import { hapticSelection } from '@/lib/haptics';

/** Height of the bar content (excluding the safe-area inset). */
export const TAB_BAR_CONTENT_HEIGHT = 56;
/** Bottom padding tab screens add so content clears the floating glass bar. */
export const TAB_BAR_CLEARANCE = 96;

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

export function CustomTabBar({ state, navigation, position }: MaterialTopTabBarProps) {
  const theme  = useTheme();
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const router = useRouter();

  // ── Tap handler (keeps tabPress → scroll-to-top working) ─────────────────────
  const tapTab = (routeIndex: number) => {
    const route = state.routes[routeIndex];
    if (!route) return;
    const isFocused = state.index === routeIndex;
    const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
    if (!isFocused && !event.defaultPrevented) {
      hapticSelection();
      navigation.navigate(route.name, route.params);
    }
  };

  // ── Sliding indicator ────────────────────────────────────────────────────────
  // 5 equal slots: [Home][Items][+][Calendar][Insights]. Page indices 0→3 map
  // to slot centres at ratios [0.1, 0.3, 0.7, 0.9] of the bar width (slot 2 is
  // the "+" and is skipped). A single Animated.multiply yields the pixel X.
  const indicatorRatio = position.interpolate({
    inputRange:  [0, 1, 2, 3],
    outputRange: [0.1, 0.3, 0.7, 0.9],
    extrapolate: 'clamp',
  });
  const barWidthAnim = useRef(new Animated.Value(Dimensions.get('window').width)).current;
  const indicatorX   = Animated.multiply(indicatorRatio, barWidthAnim);

  const renderTab = (routeIndex: number) => {
    const route = state.routes[routeIndex];
    if (!route) return null;
    const config = TAB_CONFIG[route.name];
    if (!config) return null;

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
    const isFocused = state.index === routeIndex;

    return (
      <TouchableOpacity
        key={route.key}
        style={styles.tab}
        activeOpacity={0.65}
        accessibilityRole="button"
        accessibilityLabel={config.label}
        accessibilityState={{ selected: isFocused }}
        onPress={() => tapTab(routeIndex)}
      >
        <View style={styles.iconStack}>
          <Animated.View style={{ opacity: inactiveOpacity }}>
            <Ionicons name={config.inactive} size={22} color={theme.colors.text.tertiary} />
          </Animated.View>
          <Animated.View style={[StyleSheet.absoluteFill, styles.iconCenter, { opacity: activeOpacity }]}>
            <Ionicons name={config.active} size={22} color={theme.colors.accent} />
          </Animated.View>
        </View>
        <AppText
          size="xs"
          weight={isFocused ? 'medium' : 'regular'}
          color={isFocused ? theme.colors.accent : theme.colors.text.tertiary}
        >
          {config.label}
        </AppText>
      </TouchableOpacity>
    );
  };

  return (
    <View
      style={[styles.container, { paddingBottom: Math.max(insets.bottom, 8) }]}
      onLayout={(e) => barWidthAnim.setValue(e.nativeEvent.layout.width)}
    >
      {/* Native frosted-glass material — pager screens scroll behind this. */}
      <BlurView
        intensity={theme.colors.glass.intensity}
        tint={theme.colors.glass.tint}
        style={StyleSheet.absoluteFill}
      />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.colors.glass.overlay }]} />

      {/* Finger-tracked sliding accent line. */}
      <Animated.View
        style={[
          styles.slidingLine,
          { backgroundColor: theme.colors.accent, transform: [{ translateX: Animated.subtract(indicatorX, 18) }] },
        ]}
      />

      <View style={styles.bar}>
        {renderTab(0)}
        {renderTab(1)}
        <View style={styles.addWrapper}>
          <TouchableOpacity
            style={styles.addButton}
            activeOpacity={0.85}
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
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.glass.border,
    overflow: 'visible',
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
