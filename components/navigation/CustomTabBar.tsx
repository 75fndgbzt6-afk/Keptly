import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Theme } from '@/constants/theme';
import { useTheme, useThemedStyles } from '@/components/theme';
import { AppText } from '@/components/ui/AppText';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

interface TabConfig {
  active: IoniconName;
  inactive: IoniconName;
  label: string;
}

const TAB_CONFIG: Record<string, TabConfig> = {
  index: { active: 'home', inactive: 'home-outline', label: 'Home' },
  items: { active: 'list', inactive: 'list-outline', label: 'Items' },
  calendar: { active: 'calendar', inactive: 'calendar-outline', label: 'Calendar' },
  insights: { active: 'bar-chart', inactive: 'bar-chart-outline', label: 'Insights' },
};

export function CustomTabBar({ state, navigation }: BottomTabBarProps) {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const renderTab = (routeIndex: number) => {
    const route = state.routes[routeIndex];
    if (!route) return null;
    const config = TAB_CONFIG[route.name];
    if (!config) return null;
    const isFocused = state.index === routeIndex;

    const onPress = () => {
      const event = navigation.emit({
        type: 'tabPress',
        target: route.key,
        canPreventDefault: true,
      });
      if (!isFocused && !event.defaultPrevented) {
        navigation.navigate(route.name as never);
      }
    };

    return (
      <TouchableOpacity
        key={route.key}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityState={{ selected: isFocused }}
        accessibilityLabel={config.label}
        style={styles.tab}
      >
        <Ionicons
          name={isFocused ? config.active : config.inactive}
          size={22}
          color={isFocused ? theme.colors.accent : theme.colors.text.tertiary}
        />
        <AppText
          size="xs"
          weight={isFocused ? 'medium' : 'regular'}
          color={isFocused ? theme.colors.accent : theme.colors.text.tertiary}
          style={styles.tabLabel}
        >
          {config.label}
        </AppText>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      <View style={styles.bar}>
        {renderTab(0)}
        {renderTab(1)}

        <View style={styles.addWrapper}>
          <TouchableOpacity
            style={styles.addButton}
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
  tabLabel: {
    // slight nudge up to account for gap
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
    // Shadow for the floating button
    shadowColor: theme.colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
});
