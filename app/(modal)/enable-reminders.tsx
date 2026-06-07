import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen, AppText, Button } from '@/components/ui';
import { Theme } from '@/constants/theme';
import { useTheme, useThemedStyles } from '@/components/theme';
import { useNotificationsStore } from '@/stores/notificationsStore';

const REASONS: { icon: React.ComponentProps<typeof Ionicons>['name']; text: string }[] = [
  { icon: 'time-outline', text: 'A gentle heads-up before renewals and bills are charged.' },
  { icon: 'pricetag-outline', text: 'Catch free trials before they quietly turn into paid plans.' },
  { icon: 'document-text-outline', text: 'Know in advance when documents are about to expire.' },
];

export default function EnableRemindersModal() {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();
  const request = useNotificationsStore((s) => s.request);
  const declineForNow = useNotificationsStore((s) => s.declineForNow);
  const [busy, setBusy] = useState(false);

  const onAllow = async () => {
    setBusy(true);
    await request();
    setBusy(false);
    router.back();
  };

  const onNotNow = async () => {
    await declineForNow();
    router.back();
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={styles.body}>
        <View style={styles.top}>
          <View style={styles.iconRing}>
            <Ionicons name="notifications-outline" size={36} color={theme.colors.accent} />
          </View>
          <AppText size="xl" weight="bold" align="center">
            Never miss a renewal
          </AppText>
          <AppText size="sm" color={theme.colors.text.secondary} align="center" style={styles.sub}>
            Renewly can remind you ahead of time so nothing slips through. Reminders
            stay on your device — we don't send anything anywhere.
          </AppText>

          <View style={styles.reasons}>
            {REASONS.map((r) => (
              <View key={r.text} style={styles.reasonRow}>
                <Ionicons name={r.icon} size={20} color={theme.colors.accent} />
                <AppText size="sm" color={theme.colors.text.secondary} style={styles.reasonText}>
                  {r.text}
                </AppText>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.actions}>
          <Button label="Allow reminders" onPress={onAllow} loading={busy} size="lg" fullWidth />
          <Button label="Not now" variant="ghost" onPress={onNotNow} fullWidth />
        </View>
      </View>
    </Screen>
  );
}

const makeStyles = (theme: Theme) => StyleSheet.create({
  body: {
    flex: 1,
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.lg,
  },
  top: {
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  iconRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: theme.colors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.sm,
  },
  sub: {
    maxWidth: 320,
  },
  reasons: {
    gap: theme.spacing.md,
    marginTop: theme.spacing.lg,
    alignSelf: 'stretch',
  },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  reasonText: {
    flex: 1,
  },
  actions: {
    gap: theme.spacing.sm,
  },
});
