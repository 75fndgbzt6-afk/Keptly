/**
 * Tab layout — uses @react-navigation/material-top-tabs (backed by
 * react-native-pager-view) so the swipe gesture and page transition run
 * entirely on the UI/native thread. withLayoutContext wires this into
 * expo-router so deep links, router.navigate(), and back behaviour all work.
 *
 * Gesture conflict strategy: PagerView's native recogniser only activates
 * on a sufficiently horizontal touch; child ScrollViews / horizontal FlatLists
 * win when the initial direction is horizontal inside them (iOS: UIScrollView
 * responder chain; Android: ViewPager requestDisallowInterceptTouchEvent).
 * The "items" category chip row and chart PanResponders call
 * beginInteraction()/endInteraction() via uiStore so even the fallback
 * gesture-handler swipe (if re-added) would be suppressed.
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

/**
 * Bind the material-top-tabs Navigator to expo-router's file-based routing.
 * Screens are auto-discovered from app/(tabs)/*.tsx — no need to list them
 * explicitly as long as Tabs.Screen names match the file names.
 */
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
          // Screens must stay mounted so useFocusEffect / chart state is preserved.
          lazy: false,
          // Background so there is never a white flash behind the pager.
          sceneStyle: { backgroundColor: theme.colors.background },
          // Hide the default material tab indicator — our CustomTabBar replaces it.
          tabBarShowLabel: false,
          tabBarShowIcon: false,
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

      {/* AssistantHost floats above all tabs and the tab bar. */}
      <AssistantHost />
    </View>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
