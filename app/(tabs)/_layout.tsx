/**
 * Tab layout — @react-navigation/material-top-tabs (backed by
 * react-native-pager-view) so the swipe gesture and page transition run
 * entirely on the UI/native thread (Instagram-style finger tracking).
 * withLayoutContext wires it into expo-router so deep links, router.navigate(),
 * and back behaviour all keep working.
 *
 * Gesture conflict: PagerView's native recogniser yields to child horizontal
 * ScrollViews / FlatLists via the platform responder chain (iOS UIScrollView,
 * Android requestDisallowInterceptTouchEvent), so the Items chip row and chart
 * scrubbers keep working. The uiStore lock guards any residual conflicts.
 */
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { withLayoutContext, Redirect } from 'expo-router';
import { CustomTabBar } from '@/components/navigation/CustomTabBar';
import { AssistantHost } from '@/components/ai';
import { useOnboardingStore } from '@/stores/onboardingStore';
import { useTheme } from '@/components/theme';

const { Navigator } = createMaterialTopTabNavigator();
const Tabs = withLayoutContext(Navigator);

export default function TabLayout() {
  const onboardingLoaded   = useOnboardingStore((s) => s.loaded);
  const onboardingComplete = useOnboardingStore((s) => s.complete);
  const theme = useTheme();

  if (onboardingLoaded && !onboardingComplete) {
    return <Redirect href="/onboarding" />;
  }

  return (
    <View style={styles.fill}>
      <Tabs
        tabBarPosition="bottom"
        tabBar={(props) => <CustomTabBar {...props} />}
        screenOptions={{
          // Keep all screens mounted (preserves useFocusEffect + chart state).
          lazy: false,
          sceneStyle: { backgroundColor: theme.colors.background },
          // Hide the default material bar — our glass CustomTabBar replaces it.
          tabBarStyle: { display: 'none' },
          tabBarIndicatorStyle: { display: 'none' },
          swipeEnabled: true,
        }}
      >
        <Tabs.Screen name="index" />
        <Tabs.Screen name="items" />
        <Tabs.Screen name="calendar" />
        <Tabs.Screen name="insights" />
      </Tabs>

      <AssistantHost />
    </View>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
