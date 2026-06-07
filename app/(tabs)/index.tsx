import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useFocusEffect, useRootNavigationState, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen, AppText, Card, Badge, Button, EmptyState } from '@/components/ui';
import { ReminderPermissionBanner } from '@/components/notifications/ReminderPermissionBanner';
import { theme } from '@/constants/theme';
import { Item } from '@/types';
import { CATEGORY_ICONS } from '@/lib/category';
import { REMINDER_TYPE_LABELS, ACTION_IDS } from '@/lib/notification-copy';
import { formatCurrency } from '@/lib/currency';
import { relativeDateLabel } from '@/lib/date';
import { urgencyColor, urgencyForDate } from '@/lib/urgency';
import {
  getMonthlyTotal,
  getYearlyTotal,
  getActiveItemCount,
  getTopCategory,
  getUpcomingRenewals,
  getActiveAlerts,
  ActiveAlert,
} from '@/services/dashboard';
import { handleAction } from '@/services/notifications';
import { useItemsStore } from '@/stores/itemsStore';
import { useRecommendationsStore } from '@/stores/recommendationsStore';
import { useNotificationsStore } from '@/stores/notificationsStore';

export default function HomeScreen() {
  const router = useRouter();
  const navReady = !!useRootNavigationState()?.key;
  const items = useItemsStore((s) => s.items);
  const refreshItems = useItemsStore((s) => s.refresh);
  const potentialSavings = useRecommendationsStore((s) => s.potentialSavings);
  const refreshRecs = useRecommendationsStore((s) => s.refresh);

  const permission = useNotificationsStore((s) => s.permission);
  const asked = useNotificationsStore((s) => s.asked);
  const refreshPermission = useNotificationsStore((s) => s.refresh);

  const [alerts, setAlerts] = useState<ActiveAlert[]>([]);

  useEffect(() => {
    refreshPermission();
  }, [refreshPermission]);

  // Show the calm pre-prompt once, before the OS dialog, if we've never asked.
  // Wait for the root navigator to mount before navigating.
  useEffect(() => {
    if (navReady && permission === 'undetermined' && !asked) {
      router.push('/(modal)/enable-reminders');
    }
  }, [navReady, permission, asked, router]);

  const reload = useCallback(async () => {
    await refreshItems();
    await refreshRecs();
    setAlerts(await getActiveAlerts(useItemsStore.getState().items));
  }, [refreshItems, refreshRecs]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  const monthly = useMemo(() => getMonthlyTotal(items), [items]);
  const yearly = useMemo(() => getYearlyTotal(items), [items]);
  const activeCount = useMemo(() => getActiveItemCount(items), [items]);
  const topCategory = useMemo(() => getTopCategory(items), [items]);
  const upcoming = useMemo(() => getUpcomingRenewals(items), [items]);

  const remindersOff = asked && permission !== 'granted';
  const hasItems = items.length > 0;

  const onAlertAction = async (actionId: string, alert: ActiveAlert) => {
    await handleAction(actionId, alert.reminder.itemId, alert.reminder.id);
    await reload();
  };

  return (
    <Screen padded={false}>
      <View style={styles.header}>
        <AppText size="xl" weight="bold">
          Renewly
        </AppText>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerButton}
            accessibilityLabel="Notifications"
            accessibilityRole="button"
            onPress={() => router.push('/notifications')}
          >
            <Ionicons name="notifications-outline" size={22} color={theme.colors.text.secondary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerButton}
            accessibilityLabel="Settings"
            accessibilityRole="button"
            onPress={() => {}}
          >
            <Ionicons name="settings-outline" size={22} color={theme.colors.text.secondary} />
          </TouchableOpacity>
        </View>
      </View>

      {remindersOff ? <ReminderPermissionBanner /> : null}

      {!hasItems ? (
        <EmptyState
          icon="home-outline"
          title="Add your first subscription"
          message="Track subscriptions, bills, warranties, and documents to see your spending and what's due here."
          action={{
            label: 'Add your first item',
            onPress: () => router.push('/(modal)/add-item'),
          }}
        />
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Card style={styles.spendCard} elevated>
            <AppText size="sm" color={theme.colors.text.secondary}>
              Monthly spend
            </AppText>
            <AppText size="xxl" weight="bold">
              {formatCurrency(monthly)}
            </AppText>
            <AppText size="sm" color={theme.colors.text.tertiary}>
              {formatCurrency(yearly)} per year
            </AppText>
          </Card>

          {potentialSavings > 0 ? (
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => router.push('/(tabs)/insights')}
              accessibilityRole="button"
            >
              <Card style={styles.savingsCard}>
                <Ionicons name="trending-down-outline" size={20} color={theme.colors.status.good} />
                <AppText size="sm" color={theme.colors.text.secondary} style={styles.savingsText}>
                  You could save {formatCurrency(potentialSavings)}/month — see recommendations.
                </AppText>
                <Ionicons name="chevron-forward" size={16} color={theme.colors.text.tertiary} />
              </Card>
            </TouchableOpacity>
          ) : null}

          {alerts.length > 0 ? (
            <Section title="Needs attention">
              {alerts.map((alert) => (
                <Card key={alert.reminder.id} style={styles.alertCard}>
                  <View style={styles.alertHeading}>
                    <Ionicons name="alert-circle-outline" size={18} color={theme.colors.status.warning} />
                    <View style={styles.alertText}>
                      <AppText weight="medium" numberOfLines={1}>
                        {alert.item?.name ?? 'Item'}
                      </AppText>
                      <AppText size="xs" color={theme.colors.text.tertiary}>
                        {REMINDER_TYPE_LABELS[alert.reminder.type]} ·{' '}
                        {relativeDateLabel(alert.reminder.triggerDate.slice(0, 10))}
                      </AppText>
                    </View>
                  </View>
                  <View style={styles.alertActions}>
                    <Button
                      label="Mark done"
                      variant="secondary"
                      size="sm"
                      onPress={() => onAlertAction(ACTION_IDS.done, alert)}
                      style={styles.flex1}
                    />
                    <Button
                      label="Snooze 1 day"
                      variant="ghost"
                      size="sm"
                      onPress={() => onAlertAction(ACTION_IDS.snooze, alert)}
                      style={styles.flex1}
                    />
                  </View>
                </Card>
              ))}
            </Section>
          ) : null}

          <Section title="Upcoming renewals">
            {upcoming.length === 0 ? (
              <Card>
                <AppText size="sm" color={theme.colors.text.tertiary}>
                  Nothing due in the next 30 days.
                </AppText>
              </Card>
            ) : (
              <Card style={styles.listCard}>
                {upcoming.map((item, i) => (
                  <UpcomingRow
                    key={item.id}
                    item={item}
                    last={i === upcoming.length - 1}
                    onPress={() => router.push(`/item/${item.id}`)}
                  />
                ))}
              </Card>
            )}
          </Section>

          <View style={styles.statsRow}>
            <Card style={styles.statCard}>
              <AppText size="xl" weight="bold">
                {activeCount}
              </AppText>
              <AppText size="xs" color={theme.colors.text.tertiary}>
                Active {activeCount === 1 ? 'item' : 'items'}
              </AppText>
            </Card>
            <Card style={styles.statCard}>
              <AppText size="md" weight="semibold" numberOfLines={1}>
                {topCategory ? topCategory.category : '—'}
              </AppText>
              <AppText size="xs" color={theme.colors.text.tertiary}>
                {topCategory ? `Top — ${formatCurrency(topCategory.monthlyAmount)}/mo` : 'Top category'}
              </AppText>
            </Card>
          </View>
        </ScrollView>
      )}
    </Screen>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <AppText size="sm" weight="semibold" color={theme.colors.text.tertiary}>
        {title.toUpperCase()}
      </AppText>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function UpcomingRow({ item, last, onPress }: { item: Item; last: boolean; onPress: () => void }) {
  const level = urgencyForDate(item.nextDate);
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      style={[styles.upcomingRow, !last && styles.rowBorder]}
      accessibilityRole="button"
    >
      <View style={styles.iconCircle}>
        <Ionicons name={CATEGORY_ICONS[item.category]} size={18} color={theme.colors.accent} />
      </View>
      <View style={styles.upcomingMiddle}>
        <AppText weight="medium" numberOfLines={1}>
          {item.name}
        </AppText>
        <View style={styles.upcomingMeta}>
          <Badge label={item.category} variant="neutral" />
          <AppText size="xs" weight="medium" color={urgencyColor(level)}>
            {relativeDateLabel(item.nextDate)}
          </AppText>
        </View>
      </View>
      <AppText weight="semibold">{formatCurrency(item.amount, item.currency)}</AppText>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.base,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: theme.spacing.base,
    gap: theme.spacing.lg,
  },
  spendCard: {
    gap: theme.spacing.xs,
  },
  savingsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.status.goodLight,
    borderColor: theme.colors.status.goodLight,
  },
  savingsText: {
    flex: 1,
  },
  section: {
    gap: theme.spacing.sm,
  },
  sectionBody: {
    gap: theme.spacing.sm,
  },
  alertCard: {
    gap: theme.spacing.md,
  },
  alertHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  alertText: {
    flex: 1,
    gap: 2,
  },
  alertActions: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  listCard: {
    paddingVertical: 0,
  },
  upcomingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    paddingVertical: theme.spacing.md,
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  upcomingMiddle: {
    flex: 1,
    gap: theme.spacing.xs,
  },
  upcomingMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  statsRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  statCard: {
    flex: 1,
    gap: theme.spacing.xs,
  },
  flex1: {
    flex: 1,
  },
});
