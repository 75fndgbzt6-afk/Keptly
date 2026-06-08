import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Tabs, Redirect } from 'expo-router';
import { CustomTabBar } from '@/components/navigation/CustomTabBar';
import { AssistantHost } from '@/components/ai';
import { useOnboardingStore } from '@/stores/onboardingStore';

export default function TabLayout() {
  const onboardingLoaded = useOnboardingStore((s) => s.loaded);
  const onboardingComplete = useOnboardingStore((s) => s.complete);

  // First launch: route into onboarding before showing the app.
  if (onboardingLoaded && !onboardingComplete) {
    return <Redirect href="/onboarding" />;
  }

  return (
    <View style={styles.fill}>
      <Tabs
        tabBar={(props) => <CustomTabBar {...props} />}
        screenOptions={{ headerShown: false, animation: 'none', lazy: false }}
      >
        <Tabs.Screen name="index" />
        <Tabs.Screen name="items" />
        <Tabs.Screen name="calendar" />
        <Tabs.Screen name="insights" />
      </Tabs>
      {/* Persistent across the four tabs; sits above the tab bar, clear of "+". */}
      <AssistantHost />
    </View>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
