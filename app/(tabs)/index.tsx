import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useFocusEffect, useRootNavigationState, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen, AppText, Card, Badge, Button, EmptyState } from '@/components/ui';
import { ReminderPermissionBanner } from '@/components/notifications/ReminderPermissionBanner';
import { Donut, ChartModal } from '@/components/charts';
import { Theme } from '@/constants/theme';
import { useTheme, useThemedStyles } from '@/components/theme';
import { chartColorAt } from '@/constants/chart-palette';
import { Item } from '@/types';
import { iconForCategory } from '@/lib/category';
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
  getSpendByCategory,
  ActiveAlert,
} from '@/services/dashboard';
import { handleAction } from '@/services/notifications';
import { hapticSelection } from '@/lib/haptics';
import { useItemContextMenu } from '@/components/items';
import { useItemsStore } from '@/stores/itemsStore';
import { useRecommendationsStore } from '@/stores/recommendationsStore';
import { useNotificationsStore } from '@/stores/notificationsStore';
import { useUiStore } from '@/stores/uiStore';

export default function HomeScreen() {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();
  const navigation = useNavigation();
  const navReady = !!useRootNavigationState()?.key;
  const items = useItemsStore((s) => s.items);
  const refreshItems = useItemsStore((s) => s.refresh);
  const potentialSavings = useRecommendationsStore((s) => s.potentialSavings);
  const refreshRecs = useRecommendationsStore((s) => s.refresh);

  const permission = useNotificationsStore((s) => s.permission);
  const asked = useNotificationsStore((s) => s.asked);
  const refreshPermission = useNotificationsStore((s) => s.refresh);

  const [alerts, setAlerts] = useState<ActiveAlert[]>([]);
  const [donutOpen, setDonutOpen] = useState(false);
  const [selectedSlice, setSelectedSlice] = useState<number | null>(null);
  const [scrollEnabled, setScrollEnabled] = useState(true);
  const onLongPress = useItemContextMenu();

  const scrollRef = useRef<ScrollView>(null);
  const scrollYRef = useRef(0);

  useEffect(() => {
    return navigation.addListener('tabPress' as never, () => {
      if (!navigation.isFocused()) return;
      if (scrollYRef.current > 8) {
        hapticSelection();
        scrollRef.current?.scrollTo({ y: 0, animated: true });
      }
    });
  }, [navigation]);

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
  const spendByCategory = useMemo(() => getSpendByCategory(items), [items]);
  const donutSlices = useMemo(
    () => spendByCategory.map((c, i) => ({ value: c.monthlyAmount, color: chartColorAt(i) })),
    [spendByCategory],
  );
  const topShare = monthly > 0 && topCategory ? Math.round((topCategory.monthlyAmount / monthly) * 100) : 0;

  const remindersOff = asked && permission !== 'granted';
  const hasItems = items.length > 0;

  const onAlertAction = async (actionId: string, alert: ActiveAlert) => {
    await handleAction(actionId, alert.reminder.itemId, alert.reminder.id);
    await reload();
  };

  return (
    <Screen padded={false}>
      <View style={styles.header}>
        <AppText size="xl" weight="bold" accessibilityRole="header">
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
            onPress={() => router.push('/settings')}
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
        <ScrollView
          ref={scrollRef}
          scrollEnabled={scrollEnabled}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          onScroll={(e) => { scrollYRef.current = e.nativeEvent.contentOffset.y; }}
          scrollEventThrottle={100}
        >
          <Card style={styles.spendCard} elevated>
            {/* Tap the left info side to expand the donut modal */}
            <TouchableOpacity
              style={styles.flex1}
              activeOpacity={0.7}
              onPress={() => setDonutOpen(true)}
              accessibilityRole="button"
              accessibilityLabel="Spend by category, tap to enlarge"
            >
              <AppText size="sm" color={theme.colors.text.secondary}>
                Monthly spend
              </AppText>
              <AppText size="xxl" weight="bold">
                {formatCurrency(monthly)}
              </AppText>
              <AppText size="sm" color={theme.colors.text.tertiary}>
                {formatCurrency(yearly)} per year
              </AppText>
            </TouchableOpacity>
            {donutSlices.length > 0 ? (
              <Donut
                data={donutSlices}
                size={90}
                thickness={13}
                selectedIndex={selectedSlice}
                onSelect={setSelectedSlice}
                onInteractionStart={() => { setScrollEnabled(false); useUiStore.getState().beginInteraction(); }}
                onInteractionEnd={() => { setScrollEnabled(true); useUiStore.getState().endInteraction(); }}
              >
                {selectedSlice != null && spendByCategory[selectedSlice] ? (
                  <>
                    <AppText size="xs" color={theme.colors.text.tertiary} numberOfLines={1} align="center">
                      {spendByCategory[selectedSlice].category}
                    </AppText>
                    <AppText size="sm" weight="bold">
                      {monthly > 0
                        ? Math.round((spendByCategory[selectedSlice].monthlyAmount / monthly) * 100)
                        : 0}%
                    </AppText>
                  </>
                ) : (
                  <>
                    <AppText size="md" weight="bold">
                      {topShare}%
                    </AppText>
                    <AppText size="xs" color={theme.colors.text.tertiary}>
                      top
                    </AppText>
                  </>
                )}
              </Donut>
            ) : null}
          </Card>

          <ChartModal
            visible={donutOpen}
            title="Spend by category"
            onClose={() => {
              setDonutOpen(false);
              setSelectedSlice(null);
            }}
          >
            <View style={styles.modalDonut}>
              <Donut data={donutSlices} size={200} thickness={30} selectedIndex={selectedSlice} onSelect={setSelectedSlice}>
                {selectedSlice != null && spendByCategory[selectedSlice] ? (
                  <>
                    <AppText size="xs" color={theme.colors.text.tertiary} numberOfLines={1}>
                      {spendByCategory[selectedSlice].category}
                    </AppText>
                    <AppText size="lg" weight="bold">
                      {monthly > 0
                        ? Math.round((spendByCategory[selectedSlice].monthlyAmount / monthly) * 100)
                        : 0}
                      %
                    </AppText>
                    <AppText size="xs" color={theme.colors.text.tertiary}>
                      {formatCurrency(spendByCategory[selectedSlice].monthlyAmount)}
                    </AppText>
                  </>
                ) : (
                  <>
                    <AppText size="xs" color={theme.colors.text.tertiary}>
                      Monthly
                    </AppText>
                    <AppText size="lg" weight="bold">
                      {formatCurrency(monthly)}
                    </AppText>
                  </>
                )}
              </Donut>
            </View>
            <View style={styles.modalLegend}>
              {spendByCategory.map((c, i) => {
                const active = selectedSlice === i;
                return (
                  <TouchableOpacity
                    key={c.category}
                    activeOpacity={0.7}
                    style={[styles.modalLegendRow, selectedSlice != null && !active && styles.legendDim]}
                    onPress={() => setSelectedSlice(active ? null : i)}
                    accessibilityRole="button"
                    accessibilityLabel={`${c.category}, ${formatCurrency(c.monthlyAmount)}`}
                  >
                    <View style={[styles.legendDot, { backgroundColor: chartColorAt(i) }]} />
                    <AppText size="sm" style={styles.flex1} numberOfLines={1}>
                      {c.category}
                    </AppText>
                    <AppText size="sm" weight="medium">
                      {formatCurrency(c.monthlyAmount)}
                    </AppText>
                    <AppText size="xs" color={theme.colors.text.tertiary} style={styles.legendPct}>
                      {monthly > 0 ? Math.round((c.monthlyAmount / monthly) * 100) : 0}%
                    </AppText>
                  </TouchableOpacity>
                );
              })}
            </View>
            <Button label="Open Insights" variant="secondary" onPress={() => { setDonutOpen(false); setSelectedSlice(null); router.push('/(tabs)/insights'); }} fullWidth />
          </ChartModal>

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

          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => router.push('/vault')}
            accessibilityRole="button"
          >
            <Card style={styles.vaultCard}>
              <View style={styles.vaultIcon}>
                <Ionicons name="shield-checkmark-outline" size={20} color={theme.colors.accent} />
              </View>
              <View style={styles.flex1}>
                <AppText weight="semibold">Document Vault</AppText>
                <AppText size="xs" color={theme.colors.text.tertiary}>
                  IDs & scans, locked behind your biometric
                </AppText>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.colors.text.tertiary} />
            </Card>
          </TouchableOpacity>

          {alerts.length > 0 ? (
            <Section title="Needs attention">
              {alerts.map((alert) => (
                <Card key={alert.reminder.id} style={styles.alertCard} onLongPress={alert.item ? () => onLongPress(alert.item!) : undefined}>
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
                    onLongPress={() => onLongPress(item)}
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
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.section}>
      <AppText size="sm" weight="semibold" color={theme.colors.text.tertiary}>
        {title.toUpperCase()}
      </AppText>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function UpcomingRow({ item, last, onPress, onLongPress }: { item: Item; last: boolean; onPress: () => void; onLongPress?: () => void }) {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  const level = urgencyForDate(item.nextDate);
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      onLongPress={onLongPress}
      style={[styles.upcomingRow, !last && styles.rowBorder]}
      accessibilityRole="button"
    >
      <View style={styles.iconCircle}>
        <Ionicons name={iconForCategory(item.category)} size={18} color={theme.colors.accent} />
      </View>
      <View style={styles.upcomingMiddle}>
        <AppText weight="medium" numberOfLines={1}>
          {item.name}
        </AppText>
        <View style={styles.upcomingMeta}>
          <Badge label={item.category} variant="neutral" />
          <AppText size="xs" weight="medium" color={urgencyColor(level, theme.colors)}>
            {relativeDateLabel(item.nextDate)}
          </AppText>
        </View>
      </View>
      <AppText weight="semibold">{formatCurrency(item.amount)}</AppText>
    </TouchableOpacity>
  );
}

const makeStyles = (theme: Theme) => StyleSheet.create({
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.base,
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
  vaultCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  vaultIcon: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalDonut: {
    alignItems: 'center',
  },
  modalLegend: {
    gap: theme.spacing.sm,
  },
  modalLegendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingVertical: 2,
  },
  legendDim: {
    opacity: 0.4,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendPct: {
    width: 40,
    textAlign: 'right',
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
