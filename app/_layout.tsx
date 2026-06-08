import 'react-native-gesture-handler';
import React, { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import { initDatabase } from '@/db/schema';
import { initNotifications, reconcile, addResponseListener } from '@/services/notifications';
import { useRecommendationsStore } from '@/stores/recommendationsStore';
import { useThemeStore } from '@/stores/themeStore';
import { useOnboardingStore } from '@/stores/onboardingStore';
import { usePreferencesStore } from '@/stores/preferencesStore';
import { AppLockProvider } from '@/components/security';
import { ThemeProvider, useTheme } from '@/components/theme';
import { safeWarn } from '@/lib/safe-log';

/** Status bar text adapts to the active theme (dark text on light, light on dark). */
function ThemedStatusBar() {
  const theme = useTheme();
  return <StatusBar style={theme.mode === 'dark' ? 'light' : 'dark'} />;
}

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });
  const [dbReady, setDbReady] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        await useThemeStore.getState().refresh();
        await useOnboardingStore.getState().refresh();
        await initDatabase();
        await usePreferencesStore.getState().refresh();
        await initNotifications();
        await reconcile();
        await useRecommendationsStore.getState().refresh();
      } catch (e) {
        safeWarn('Startup init failed', { message: e instanceof Error ? e.message : String(e) });
      } finally {
        setDbReady(true);
      }
    })();
  }, []);

  useEffect(() => {
    const sub = addResponseListener();
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if ((fontsLoaded || fontError) && dbReady) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError, dbReady]);

  if ((!fontsLoaded && !fontError) || !dbReady) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <ThemedStatusBar />
          <AppLockProvider>
          <Stack
            screenOptions={{
              headerShown: false,
              animation: 'slide_from_right',
              gestureEnabled: true,
            }}
          >
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="item/[id]" />
            <Stack.Screen name="notifications" />
            <Stack.Screen name="vault" />
            <Stack.Screen name="settings" />
            <Stack.Screen name="onboarding/index" />
            <Stack.Screen
              name="(modal)/add-item"
              options={{ presentation: 'modal' }}
            />
            <Stack.Screen
              name="(modal)/enable-reminders"
              options={{ presentation: 'modal' }}
            />
            <Stack.Screen
              name="(modal)/edit-reminders"
              options={{ presentation: 'modal' }}
            />
          </Stack>
          </AppLockProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
