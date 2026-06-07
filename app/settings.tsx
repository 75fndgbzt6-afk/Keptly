import React, { useEffect, useState } from 'react';
import { View, ScrollView, TouchableOpacity, Alert, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen, AppText, Card, Button, Input } from '@/components/ui';
import { ToggleField } from '@/components/form';
import { theme } from '@/constants/theme';
import { canAuthenticate } from '@/services/app-lock';
import { exportData, deleteAllData } from '@/services/data-export';
import { useSecurityStore, TIMEOUT_OPTIONS, TimeoutMinutes } from '@/stores/securityStore';
import { useItemsStore } from '@/stores/itemsStore';
import { useRecommendationsStore } from '@/stores/recommendationsStore';
import { usePaymentMethodsStore } from '@/stores/paymentMethodsStore';

const DELETE_WORD = 'DELETE';

export default function SettingsScreen() {
  const router = useRouter();
  const security = useSecurityStore();
  const refreshItems = useItemsStore((s) => s.refresh);
  const refreshRecs = useRecommendationsStore((s) => s.refresh);
  const refreshMethods = usePaymentMethodsStore((s) => s.refresh);

  const [authAvailable, setAuthAvailable] = useState(true);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteText, setDeleteText] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    security.refresh();
    canAuthenticate().then(setAuthAvailable);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const onExport = async () => {
    setBusy(true);
    try {
      const ok = await exportData();
      if (!ok) Alert.alert('Sharing unavailable', 'This device can’t open the share sheet.');
    } finally {
      setBusy(false);
    }
  };

  const onConfirmDelete = async () => {
    if (deleteText !== DELETE_WORD) return;
    setBusy(true);
    try {
      await deleteAllData();
      await Promise.all([refreshItems(), refreshRecs(), refreshMethods()]);
      setConfirmingDelete(false);
      setDeleteText('');
      router.replace('/(tabs)');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen padded={false} scroll>
      <View style={styles.topBar}>
        <Button label="Back" variant="ghost" onPress={() => router.back()} style={styles.backButton} />
        <AppText size="xl" weight="bold" style={styles.title}>
          Settings
        </AppText>
      </View>

      <View style={styles.body}>
        {!authAvailable ? (
          <Card style={styles.warnCard}>
            <Ionicons name="warning-outline" size={18} color={theme.colors.status.warning} />
            <AppText size="sm" color={theme.colors.text.secondary} style={styles.flex1}>
              Set up Face ID, Touch ID, or a device passcode to lock Renewly and your vault.
            </AppText>
          </Card>
        ) : null}

        <Section title="Security">
          <Card style={styles.card}>
            <ToggleField
              label="App lock"
              hint="Require Face ID / passcode to open Renewly."
              value={security.appLockEnabled}
              onChange={(v) => security.update({ appLockEnabled: v })}
            />
            <View style={styles.divider} />
            <ToggleField
              label="Vault lock"
              hint="Always ask before opening the Document Vault."
              value={security.vaultLockEnabled}
              onChange={(v) => security.update({ vaultLockEnabled: v })}
            />
            <View style={styles.divider} />
            <View style={styles.timeoutBlock}>
              <AppText weight="medium">Auto-lock after</AppText>
              <AppText size="xs" color={theme.colors.text.tertiary}>
                Re-lock the app this long after it goes to the background.
              </AppText>
              <View style={styles.segments}>
                {TIMEOUT_OPTIONS.map((min) => {
                  const active = security.inactivityTimeoutMin === min;
                  return (
                    <TouchableOpacity
                      key={min}
                      activeOpacity={0.7}
                      onPress={() => security.update({ inactivityTimeoutMin: min as TimeoutMinutes })}
                      style={[styles.segment, active && styles.segmentActive]}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                    >
                      <AppText
                        size="sm"
                        weight={active ? 'semibold' : 'regular'}
                        color={active ? theme.colors.text.inverse : theme.colors.text.secondary}
                      >
                        {min} min
                      </AppText>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </Card>
        </Section>

        <Section title="Your data">
          <Card style={styles.card}>
            <View style={styles.dataRow}>
              <View style={styles.flex1}>
                <AppText weight="medium">Export all data</AppText>
                <AppText size="xs" color={theme.colors.text.tertiary}>
                  Share a JSON copy. Numbers are masked — full IDs are never exported.
                </AppText>
              </View>
              <Button label="Export" variant="secondary" size="sm" onPress={onExport} />
            </View>

            <View style={styles.divider} />

            {!confirmingDelete ? (
              <View style={styles.dataRow}>
                <View style={styles.flex1}>
                  <AppText weight="medium">Delete all data</AppText>
                  <AppText size="xs" color={theme.colors.text.tertiary}>
                    Erase every item, scan, and secret from this device.
                  </AppText>
                </View>
                <Button
                  label="Delete"
                  variant="danger"
                  size="sm"
                  onPress={() => setConfirmingDelete(true)}
                />
              </View>
            ) : (
              <View style={styles.confirmBlock}>
                <AppText weight="medium" color={theme.colors.status.danger}>
                  This can’t be undone.
                </AppText>
                <AppText size="sm" color={theme.colors.text.secondary}>
                  Type {DELETE_WORD} to confirm permanent deletion of all data.
                </AppText>
                <Input
                  value={deleteText}
                  onChangeText={setDeleteText}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  placeholder={DELETE_WORD}
                />
                <View style={styles.confirmActions}>
                  <Button
                    label="Cancel"
                    variant="ghost"
                    onPress={() => {
                      setConfirmingDelete(false);
                      setDeleteText('');
                    }}
                    style={styles.flex1}
                  />
                  <Button
                    label="Permanently delete"
                    variant="danger"
                    onPress={onConfirmDelete}
                    disabled={deleteText !== DELETE_WORD || busy}
                    loading={busy}
                    style={styles.flex1}
                  />
                </View>
              </View>
            )}
          </Card>
        </Section>
      </View>
    </Screen>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <AppText size="sm" weight="semibold" color={theme.colors.text.tertiary}>
        {title.toUpperCase()}
      </AppText>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: {
    paddingHorizontal: theme.spacing.sm,
    paddingTop: theme.spacing.xs,
    gap: theme.spacing.xs,
  },
  backButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: theme.spacing.sm,
  },
  title: {
    paddingHorizontal: theme.spacing.sm,
  },
  body: {
    paddingHorizontal: theme.spacing.base,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.xl,
    gap: theme.spacing.lg,
  },
  section: {
    gap: theme.spacing.sm,
  },
  card: {
    gap: theme.spacing.md,
  },
  warnCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.status.warningLight,
    borderColor: theme.colors.status.warningLight,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: theme.colors.border,
  },
  timeoutBlock: {
    gap: theme.spacing.sm,
  },
  segments: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.radius.full,
    padding: theme.spacing.xs,
    gap: theme.spacing.xs,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.full,
  },
  segmentActive: {
    backgroundColor: theme.colors.accent,
  },
  dataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  confirmBlock: {
    gap: theme.spacing.sm,
  },
  confirmActions: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  flex1: {
    flex: 1,
  },
});
