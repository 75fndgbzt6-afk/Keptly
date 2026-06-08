import React from 'react';
import { Tabs, Redirect } from 'expo-router';
import { CustomTabBar } from '@/components/navigation/CustomTabBar';
import { useOnboardingStore } from '@/stores/onboardingStore';

export default function TabLayout() {
  const onboardingLoaded = useOnboardingStore((s) => s.loaded);
  const onboardingComplete = useOnboardingStore((s) => s.complete);

  // First launch: route into onboarding before showing the app.
  if (onboardingLoaded && !onboardingComplete) {
    return <Redirect href="/onboarding" />;
  }

  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{ headerShown: false, animation: 'none', lazy: false }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="items" />
      <Tabs.Screen name="calendar" />
      <Tabs.Screen name="insights" />
    </Tabs>
  );
}
