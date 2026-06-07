import React, { useState } from 'react';
import { View, ScrollView, TouchableOpacity, Dimensions, Alert, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen, AppText, Card, Button } from '@/components/ui';
import { Theme } from '@/constants/theme';
import { useTheme, useThemedStyles } from '@/components/theme';
import { CURRENCY_SYMBOLS } from '@/constants/config';
import { ONBOARDING_COPY as C } from '@/lib/copy/onboarding';
import { canAuthenticate } from '@/services/app-lock';
import { useOnboardingStore } from '@/stores/onboardingStore';
import { usePreferencesStore } from '@/stores/preferencesStore';
import { useNotificationsStore } from '@/stores/notificationsStore';
import { useSecurityStore } from '@/stores/securityStore';

type StepKey = 'welcome' | 'features' | 'currency' | 'notifications' | 'security' | 'done';
const STEPS: StepKey[] = ['welcome', 'features', 'currency', 'notifications', 'security', 'done'];
const CURRENCIES = Object.keys(CURRENCY_SYMBOLS);

export default function OnboardingScreen() {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();
  const finishOnboarding = useOnboardingStore((s) => s.finish);
  const defaultCurrency = usePreferencesStore((s) => s.defaultCurrency);
  const updatePrefs = usePreferencesStore((s) => s.update);
  const requestNotifications = useNotificationsStore((s) => s.request);
  const declineNotifications = useNotificationsStore((s) => s.declineForNow);
  const updateSecurity = useSecurityStore((s) => s.update);

  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const step = STEPS[index];

  const next = () => setIndex((i) => Math.min(i + 1, STEPS.length - 1));
  const back = () => setIndex((i) => Math.max(i - 1, 0));

  const leave = async (then?: () => void) => {
    await finishOnboarding();
    router.replace('/(tabs)');
    then?.();
  };

  const onAllowNotifications = async () => {
    setBusy(true);
    await requestNotifications();
    setBusy(false);
    next();
  };
  const onSkipNotifications = async () => {
    await declineNotifications();
    next();
  };

  const onEnableLock = async () => {
    setBusy(true);
    const ok = await canAuthenticate();
    setBusy(false);
    if (!ok) {
      Alert.alert(C.security.title, C.security.body);
      return;
    }
    await updateSecurity({ appLockEnabled: true });
    next();
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={styles.topBar}>
        <View style={styles.topSlot}>
          {index > 0 ? (
            <TouchableOpacity onPress={back} accessibilityRole="button" accessibilityLabel={C.back} hitSlop={8}>
              <Ionicons name="chevron-back" size={24} color={theme.colors.text.secondary} />
            </TouchableOpacity>
          ) : null}
        </View>
        <View style={styles.dots}>
          {STEPS.map((s, i) => (
            <View key={s} style={[styles.dot, i === index && styles.dotActive]} />
          ))}
        </View>
        <View style={[styles.topSlot, styles.topRight]}>
          {step !== 'done' ? (
            <TouchableOpacity onPress={() => leave()} accessibilityRole="button" accessibilityLabel={C.skip} hitSlop={8}>
              <AppText size="sm" weight="medium" color={theme.colors.text.secondary}>
                {C.skip}
              </AppText>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      <View style={styles.body}>
        {step === 'welcome' ? (
          <Centered icon="sparkles-outline" title={C.welcome.title} body={C.welcome.body} />
        ) : null}

        {step === 'features' ? <Features /> : null}

        {step === 'currency' ? (
          <View style={styles.fill}>
            <Heading title={C.currency.title} body={C.currency.body} />
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.currencyList}>
              {CURRENCIES.map((code) => {
                const active = code === defaultCurrency;
                return (
                  <Card
                    key={code}
                    onPress={() => updatePrefs({ defaultCurrency: code })}
                    style={StyleSheet.flatten([styles.currencyRow, active && styles.currencyRowActive])}
                  >
                    <AppText weight="semibold" style={styles.currencySymbol}>
                      {CURRENCY_SYMBOLS[code]}
                    </AppText>
                    <AppText weight="medium" style={styles.fill}>
                      {code}
                    </AppText>
                    {active ? (
                      <Ionicons name="checkmark-circle" size={20} color={theme.colors.accent} />
                    ) : null}
                  </Card>
                );
              })}
            </ScrollView>
          </View>
        ) : null}

        {step === 'notifications' ? (
          <Centered icon="notifications-outline" title={C.notifications.title} body={C.notifications.body} />
        ) : null}

        {step === 'security' ? (
          <Centered icon="lock-closed-outline" title={C.security.title} body={C.security.body} />
        ) : null}

        {step === 'done' ? (
          <Centered icon="checkmark-done-outline" title={C.done.title} body={C.done.body} />
        ) : null}
      </View>

      <View style={styles.actions}>
        {step === 'welcome' ? <Button label={C.welcome.cta} onPress={next} size="lg" fullWidth /> : null}
        {step === 'features' ? <Button label={C.features.cta} onPress={next} size="lg" fullWidth /> : null}
        {step === 'currency' ? <Button label={C.currency.cta} onPress={next} size="lg" fullWidth /> : null}
        {step === 'notifications' ? (
          <>
            <Button label={C.notifications.allow} onPress={onAllowNotifications} loading={busy} size="lg" fullWidth />
            <Button label={C.notifications.later} variant="ghost" onPress={onSkipNotifications} fullWidth />
          </>
        ) : null}
        {step === 'security' ? (
          <>
            <Button label={C.security.enable} onPress={onEnableLock} loading={busy} size="lg" fullWidth />
            <Button label={C.security.later} variant="ghost" onPress={next} fullWidth />
          </>
        ) : null}
        {step === 'done' ? (
          <>
            <Button
              label={C.done.cta}
              onPress={() => leave(() => router.push('/(modal)/add-item'))}
              size="lg"
              fullWidth
            />
            <Button label={C.done.finish} variant="ghost" onPress={() => leave()} fullWidth />
          </>
        ) : null}
      </View>
    </Screen>
  );
}

function Heading({ title, body }: { title: string; body: string }) {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.heading}>
      <AppText size="xl" weight="bold">
        {title}
      </AppText>
      <AppText size="sm" color={theme.colors.text.secondary}>
        {body}
      </AppText>
    </View>
  );
}

function Centered({
  icon,
  title,
  body,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  body: string;
}) {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.centered}>
      <View style={styles.iconRing}>
        <Ionicons name={icon} size={40} color={theme.colors.accent} />
      </View>
      <AppText size="xl" weight="bold" align="center">
        {title}
      </AppText>
      <AppText size="sm" color={theme.colors.text.secondary} align="center" style={styles.centeredBody}>
        {body}
      </AppText>
    </View>
  );
}

function Features() {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  const width = Dimensions.get('window').width;
  return (
    <View style={styles.fill}>
      <Heading title={C.features.title} body="" />
      <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}>
        {C.features.cards.map((card) => (
          <View key={card.title} style={[styles.featurePage, { width: width - theme.spacing.base * 2 }]}>
            <View style={styles.iconRing}>
              <Ionicons name={card.icon} size={36} color={theme.colors.accent} />
            </View>
            <AppText size="lg" weight="bold" align="center">
              {card.title}
            </AppText>
            <AppText size="sm" color={theme.colors.text.secondary} align="center" style={styles.centeredBody}>
              {card.body}
            </AppText>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: theme.spacing.sm,
    },
    topSlot: {
      width: 60,
    },
    topRight: {
      alignItems: 'flex-end',
    },
    dots: {
      flex: 1,
      flexDirection: 'row',
      justifyContent: 'center',
      gap: theme.spacing.xs,
    },
    dot: {
      width: 7,
      height: 7,
      borderRadius: theme.radius.full,
      backgroundColor: theme.colors.border,
    },
    dotActive: {
      backgroundColor: theme.colors.accent,
      width: 18,
    },
    body: {
      flex: 1,
    },
    fill: {
      flex: 1,
    },
    heading: {
      gap: theme.spacing.xs,
      paddingVertical: theme.spacing.lg,
    },
    centered: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: theme.spacing.sm,
    },
    centeredBody: {
      maxWidth: 300,
    },
    iconRing: {
      width: 88,
      height: 88,
      borderRadius: 44,
      backgroundColor: theme.colors.accentLight,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: theme.spacing.md,
    },
    featurePage: {
      alignItems: 'center',
      justifyContent: 'center',
      gap: theme.spacing.sm,
      paddingHorizontal: theme.spacing.base,
    },
    currencyList: {
      gap: theme.spacing.sm,
      paddingBottom: theme.spacing.lg,
    },
    currencyRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.md,
      padding: theme.spacing.base,
    },
    currencyRowActive: {
      borderColor: theme.colors.accent,
    },
    currencySymbol: {
      width: 28,
    },
    actions: {
      gap: theme.spacing.sm,
      paddingTop: theme.spacing.md,
    },
  });
