import React, { useEffect, useState } from 'react';
import { View, ScrollView, TouchableOpacity, Alert, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';
import { Screen, AppText, Card, Button, Input, Badge } from '@/components/ui';
import { ToggleField } from '@/components/form';
import { Theme, ThemeMode } from '@/constants/theme';
import { useTheme, useThemedStyles } from '@/components/theme';
import { useThemeStore } from '@/stores/themeStore';
import { canAuthenticate } from '@/services/app-lock';
import { exportData, deleteAllData } from '@/services/data-export';
import { CURRENCY_SYMBOLS } from '@/constants/config';
import { useSecurityStore, TIMEOUT_OPTIONS, TimeoutMinutes } from '@/stores/securityStore';
import { usePreferencesStore } from '@/stores/preferencesStore';
import { useAiStore } from '@/stores/aiStore';
import { refreshQuota, clearAiCache } from '@/services/ai';
import { AI_COPY } from '@/lib/copy/ai';
import { useItemsStore } from '@/stores/itemsStore';
import { useRecommendationsStore } from '@/stores/recommendationsStore';
import { usePaymentMethodsStore } from '@/stores/paymentMethodsStore';

const DELETE_WORD = 'DELETE';
const CURRENCIES = Object.keys(CURRENCY_SYMBOLS);
const APP_VERSION = Constants.expoConfig?.version ?? '1.0.0';

/** Format an hour (0–23) as a friendly 12-hour label. */
function hourLabel(h: number): string {
  const period = h < 12 ? 'am' : 'pm';
  const base = h % 12 === 0 ? 12 : h % 12;
  return `${base}${period}`;
}

const APPEARANCE_OPTIONS: { label: string; value: ThemeMode }[] = [
  { label: 'Light', value: 'light' },
  { label: 'Dark', value: 'dark' },
  { label: 'System', value: 'system' },
];

export default function SettingsScreen() {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();
  const security = useSecurityStore();
  const themeMode = useThemeStore((s) => s.mode);
  const setThemeMode = useThemeStore((s) => s.setMode);
  const prefs = usePreferencesStore();
  const aiEnabled = useAiStore((s) => s.enabled);
  const setAiEnabled = useAiStore((s) => s.setEnabled);
  const aiQuota = useAiStore((s) => s.quota);
  const refreshItems = useItemsStore((s) => s.refresh);
  const refreshRecs = useRecommendationsStore((s) => s.refresh);
  const refreshMethods = usePaymentMethodsStore((s) => s.refresh);

  const [authAvailable, setAuthAvailable] = useState(true);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteText, setDeleteText] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    security.refresh();
    prefs.refresh();
    canAuthenticate().then(setAuthAvailable);
    if (useAiStore.getState().enabled) void refreshQuota();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const onToggleAi = async (value: boolean) => {
    await setAiEnabled(value);
    if (value) void refreshQuota();
  };

  const shiftHour = (key: 'quietStartHour' | 'quietEndHour', delta: number) => {
    const current = key === 'quietStartHour' ? prefs.quietStartHour : prefs.quietEndHour;
    prefs.update({ [key]: (current + delta + 24) % 24 } as { quietStartHour: number } | { quietEndHour: number });
  };

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
        <AppText size="xl" weight="bold" style={styles.title} accessibilityRole="header">
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

        <Section title="Profile">
          <Card style={styles.card}>
            <Input
              label="Your name (optional)"
              placeholder="Add your name"
              value={prefs.name ?? ''}
              onChangeText={(t) => prefs.update({ name: t })}
            />
            <View>
              <AppText size="sm" weight="medium" color={theme.colors.text.secondary} style={styles.fieldLabel}>
                Default currency
              </AppText>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                {CURRENCIES.map((code) => {
                  const active = prefs.defaultCurrency === code;
                  return (
                    <TouchableOpacity
                      key={code}
                      activeOpacity={0.7}
                      onPress={() => prefs.update({ defaultCurrency: code })}
                      style={[styles.chip, active && styles.chipActive]}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      accessibilityLabel={`${code} currency`}
                    >
                      <AppText
                        size="sm"
                        weight={active ? 'semibold' : 'regular'}
                        color={active ? theme.colors.text.inverse : theme.colors.text.secondary}
                      >
                        {CURRENCY_SYMBOLS[code]} {code}
                      </AppText>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          </Card>
        </Section>

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

        <Section title="Notifications">
          <Card style={styles.card}>
            <ToggleField
              label="Quiet hours"
              hint="Don’t show reminders overnight."
              value={prefs.quietHoursEnabled}
              onChange={(v) => prefs.update({ quietHoursEnabled: v })}
            />
            {prefs.quietHoursEnabled ? (
              <>
                <View style={styles.divider} />
                <View style={styles.dataRow}>
                  <AppText weight="medium" style={styles.flex1}>
                    From
                  </AppText>
                  <Stepper
                    label={hourLabel(prefs.quietStartHour)}
                    onMinus={() => shiftHour('quietStartHour', -1)}
                    onPlus={() => shiftHour('quietStartHour', 1)}
                  />
                </View>
                <View style={styles.dataRow}>
                  <AppText weight="medium" style={styles.flex1}>
                    Until
                  </AppText>
                  <Stepper
                    label={hourLabel(prefs.quietEndHour)}
                    onMinus={() => shiftHour('quietEndHour', -1)}
                    onPlus={() => shiftHour('quietEndHour', 1)}
                  />
                </View>
              </>
            ) : null}
            <View style={styles.divider} />
            <View style={styles.dataRow}>
              <View style={styles.flex1}>
                <AppText weight="medium">Default reminders</AppText>
                <AppText size="xs" color={theme.colors.text.tertiary}>
                  Lead times for new items, in days before the due date.
                </AppText>
              </View>
              <AppText weight="medium" color={theme.colors.text.secondary}>
                {prefs.defaultLeadDays.join(' · ')}
              </AppText>
            </View>
          </Card>
        </Section>

        <Section title="Appearance">
          <Card style={styles.card}>
            <AppText weight="medium">Theme</AppText>
            <View style={styles.segments}>
              {APPEARANCE_OPTIONS.map((opt) => {
                const active = themeMode === opt.value;
                return (
                  <TouchableOpacity
                    key={opt.value}
                    activeOpacity={0.7}
                    onPress={() => setThemeMode(opt.value)}
                    style={[styles.segment, active && styles.segmentActive]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={`${opt.label} appearance`}
                  >
                    <AppText
                      size="sm"
                      weight={active ? 'semibold' : 'regular'}
                      color={active ? theme.colors.text.inverse : theme.colors.text.secondary}
                    >
                      {opt.label}
                    </AppText>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Card>
        </Section>

        <Section title={AI_COPY.settings.title}>
          <Card style={styles.card}>
            <ToggleField
              label={AI_COPY.settings.toggle}
              hint={AI_COPY.settings.subtitle}
              value={aiEnabled}
              onChange={onToggleAi}
            />
            {aiEnabled ? (
              <>
                <View style={styles.divider} />
                <View style={styles.dataRow}>
                  <View style={styles.flex1}>
                    <AppText weight="medium">{AI_COPY.settings.quotaLabel}</AppText>
                    <AppText size="xs" color={theme.colors.text.tertiary}>
                      {aiQuota
                        ? aiQuota.paid
                          ? 'Unlimited'
                          : `${aiQuota.used} of ${aiQuota.limit} used`
                        : 'Checking…'}
                    </AppText>
                  </View>
                  {aiQuota && !aiQuota.paid ? (
                    <View style={styles.meterTrack}>
                      <View
                        style={[
                          styles.meterFill,
                          {
                            width: `${Math.min(100, aiQuota.limit > 0 ? (aiQuota.used / aiQuota.limit) * 100 : 0)}%`,
                          },
                        ]}
                      />
                    </View>
                  ) : null}
                </View>
                {__DEV__ ? (
                  <>
                    <View style={styles.divider} />
                    <View style={styles.dataRow}>
                      <AppText weight="medium" style={styles.flex1} color={theme.colors.text.tertiary}>
                        {AI_COPY.settings.resetDev}
                      </AppText>
                      <Button
                        label="Reset"
                        variant="ghost"
                        size="sm"
                        onPress={() => {
                          clearAiCache();
                          void refreshQuota();
                        }}
                      />
                    </View>
                  </>
                ) : null}
              </>
            ) : null}
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

            <View style={styles.divider} />

            <View style={styles.dataRow}>
              <View style={styles.flex1}>
                <AppText weight="medium" color={theme.colors.text.tertiary}>
                  Backup to cloud
                </AppText>
                <AppText size="xs" color={theme.colors.text.tertiary}>
                  Sync an encrypted backup across devices.
                </AppText>
              </View>
              <Badge label="Coming soon" variant="neutral" />
            </View>
          </Card>
        </Section>

        <Section title="About">
          <Card style={styles.card}>
            <View style={styles.dataRow}>
              <AppText weight="medium" style={styles.flex1}>
                Version
              </AppText>
              <AppText color={theme.colors.text.secondary}>{APP_VERSION}</AppText>
            </View>
            <View style={styles.divider} />
            <AppText size="sm" color={theme.colors.text.secondary}>
              Renewly keeps your subscriptions, bills, warranties, and documents on your
              device. Made with care for calm, private life-admin.
            </AppText>
            <TouchableOpacity
              onPress={() =>
                Alert.alert(
                  'Privacy',
                  'Renewly stores everything locally on your device. Nothing is uploaded or shared. Sensitive numbers are masked and full values are encrypted behind your biometric.',
                )
              }
              accessibilityRole="button"
              accessibilityLabel="Privacy policy"
            >
              <AppText size="sm" weight="medium" color={theme.colors.accent}>
                Privacy policy
              </AppText>
            </TouchableOpacity>
          </Card>
        </Section>
      </View>
    </Screen>
  );
}

function Stepper({
  label,
  onMinus,
  onPlus,
}: {
  label: string;
  onMinus: () => void;
  onPlus: () => void;
}) {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.stepper}>
      <TouchableOpacity onPress={onMinus} style={styles.stepperBtn} accessibilityRole="button" accessibilityLabel="Earlier">
        <Ionicons name="remove" size={18} color={theme.colors.text.primary} />
      </TouchableOpacity>
      <AppText weight="semibold" style={styles.stepperLabel}>
        {label}
      </AppText>
      <TouchableOpacity onPress={onPlus} style={styles.stepperBtn} accessibilityRole="button" accessibilityLabel="Later">
        <Ionicons name="add" size={18} color={theme.colors.text.primary} />
      </TouchableOpacity>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.section}>
      <AppText size="sm" weight="semibold" color={theme.colors.text.tertiary}>
        {title.toUpperCase()}
      </AppText>
      {children}
    </View>
  );
}

const makeStyles = (theme: Theme) => StyleSheet.create({
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
  fieldLabel: {
    marginBottom: theme.spacing.sm,
  },
  chipRow: {
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
  },
  chip: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.surfaceAlt,
  },
  chipActive: {
    backgroundColor: theme.colors.accent,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  stepperBtn: {
    width: 32,
    height: 32,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperLabel: {
    minWidth: 44,
    textAlign: 'center',
  },
  meterTrack: {
    width: 90,
    height: 8,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.surfaceAlt,
    overflow: 'hidden',
  },
  meterFill: {
    height: 8,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.accent,
  },
});
