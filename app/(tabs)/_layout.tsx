import React, { useMemo, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Tabs, Redirect, useRouter, usePathname } from 'expo-router';
import { CustomTabBar } from '@/components/navigation/CustomTabBar';
import { AssistantHost } from '@/components/ai';
import { useOnboardingStore } from '@/stores/onboardingStore';
import { useUiStore } from '@/stores/uiStore';
import { useTheme } from '@/components/theme';

// Fixed tab order; must match the Tabs.Screen declarations below.
const TAB_PATHS = ['/', '/items', '/calendar', '/insights'] as const;

function pathToIdx(p: string): number {
  if (p === '/' || p === '/index') return 0;
  for (let i = 1; i < TAB_PATHS.length; i++) {
    if (p === TAB_PATHS[i] || p.startsWith(TAB_PATHS[i] + '/')) return i;
  }
  return 0;
}

export default function TabLayout() {
  const onboardingLoaded  = useOnboardingStore((s) => s.loaded);
  const onboardingComplete = useOnboardingStore((s) => s.complete);
  // True while a chart scrub / row-swipe is in progress — disables tab-swipe.
  const interacting = useUiStore((s) => s.interacting > 0);
  const theme = useTheme();
  const router = useRouter();
  const pathname = usePathname();

  // Fresh refs so the gesture callback (created once) never reads stale values.
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;
  const routerRef = useRef(router);
  routerRef.current = router;

  const go = (dir: -1 | 1) => {
    const idx = pathToIdx(pathnameRef.current);
    const next = idx + dir;
    if (next >= 0 && next < TAB_PATHS.length) routerRef.current.navigate(TAB_PATHS[next]);
  };
  const goRef = useRef(go);
  goRef.current = go;

  // ── Swipe-between-tabs ─────────────────────────────────────────────────────
  // gesture-handler Pan: the gesture is RECOGNISED on the native thread (smooth,
  // never blocked by JS work), while the callback runs on JS (no Reanimated in
  // this project, so no worklets/runOnJS). activeOffsetX waits for a deliberate
  // horizontal move; failOffsetY makes it YIELD to vertical scrolls — so
  // ScrollViews, chip rows, and chart drags keep working untouched.
  // On release we navigate one tab over; the native 'shift' transition plays.
  const swipe = useMemo(
    () =>
      Gesture.Pan()
        .enabled(!interacting)
        .activeOffsetX([-22, 22])
        .failOffsetY([-16, 16])
        .runOnJS(true)
        .onEnd((e) => {
          const fast = Math.abs(e.velocityX) > 350;
          const far = Math.abs(e.translationX) > 70;
          if (!fast && !far) return;
          if (e.translationX < 0) goRef.current(1);   // swipe left → next tab
          else goRef.current(-1);                     // swipe right → previous tab
        }),
    [interacting],
  );

  if (onboardingLoaded && !onboardingComplete) {
    return <Redirect href="/onboarding" />;
  }

  return (
    <GestureDetector gesture={swipe}>
      <View style={styles.fill}>
        <Tabs
          tabBar={(props) => <CustomTabBar {...props} />}
          screenOptions={{
            headerShown: false,
            // 'none' = instant switch — zero white-flash risk (no intermediate
            // render frames where both screens overlap). The swipe gesture in
            // this file provides the physical "sliding" feel; the transition
            // itself should be instantaneous, exactly like Instagram tabs.
            // sceneStyle background is a safety net for any OS-level compositing.
            animation: 'none',
            lazy: false,
            sceneStyle: { backgroundColor: theme.colors.background },
          }}
        >
          <Tabs.Screen name="index" />
          <Tabs.Screen name="items" />
          <Tabs.Screen name="calendar" />
          <Tabs.Screen name="insights" />
        </Tabs>
        {/* Persistent across the four tabs; sits above the tab bar, clear of "+". */}
        <AssistantHost />
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
