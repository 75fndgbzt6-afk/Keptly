import React, { useCallback, useState } from 'react';
import { View, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen, AppText, Card, Button, EmptyState } from '@/components/ui';
import { Theme } from '@/constants/theme';
import { useTheme, useThemedStyles } from '@/components/theme';
import { Item, Reminder, ReminderType } from '@/types';
import { REMINDER_TYPE_LABELS } from '@/lib/notification-copy';
import { relativeDateLabel } from '@/lib/date';
import { listReminders } from '@/db/reminders';
import { useItemsStore } from '@/stores/itemsStore';
import { handleAction } from '@/services/notifications';
import { ACTION_IDS } from '@/lib/notification-copy';

const TYPE_ICONS: Record<ReminderType, React.ComponentProps<typeof Ionicons>['name']> = {
  renewal: 'refresh-outline',
  trial_end: 'hourglass-outline',
  bill_due: 'cash-outline',
  doc_expiry: 'document-text-outline',
  payment_failed: 'alert-circle-outline',
};

const DAY = 86_400_000;

function datePart(iso: string): string {
  return iso.slice(0, 10);
}

export default function NotificationsCenter() {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();
  const items = useItemsStore((s) => s.items);
  const refreshItems = useItemsStore((s) => s.refresh);
  const [reminders, setReminders] = useState<Reminder[]>([]);

  const load = useCallback(async () => {
    const [, all] = await Promise.all([refreshItems(), listReminders()]);
    setReminders(all);
  }, [refreshItems]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const itemsById = new Map<string, Item>(items.map((i) => [i.id, i]));
  const now = Date.now();

  const upcoming = reminders
    .filter((r) => r.status === 'pending' && Date.parse(r.triggerDate) > now && Date.parse(r.triggerDate) <= now + 30 * DAY)
    .sort((a, b) => Date.parse(a.triggerDate) - Date.parse(b.triggerDate));

  const past = reminders
    .filter((r) => Date.parse(r.triggerDate) <= now && Date.parse(r.triggerDate) >= now - 30 * DAY)
    .sort((a, b) => Date.parse(b.triggerDate) - Date.parse(a.triggerDate));

  const isEmpty = upcoming.length === 0 && past.length === 0;

  const onAction = async (actionId: string, r: Reminder) => {
    await handleAction(actionId, r.itemId, r.id);
    await load();
  };

  return (
    <Screen padded={false}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          accessibilityLabel="Back"
          accessibilityRole="button"
          style={styles.backButton}
        >
          <Ionicons name="chevron-back" size={24} color={theme.colors.text.primary} />
        </TouchableOpacity>
        <AppText size="lg" weight="semibold">
          Notifications
        </AppText>
        <View style={styles.backButton} />
      </View>

      {isEmpty ? (
        <EmptyState
          icon="notifications-outline"
          title="No reminders yet"
          message="As you add items with renewal dates, bills, or expiries, their reminders show up here."
        />
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Section title="Upcoming (next 30 days)">
            {upcoming.length === 0 ? (
              <AppText size="sm" color={theme.colors.text.tertiary} style={styles.sectionEmpty}>
                Nothing scheduled in the next 30 days.
              </AppText>
            ) : (
              upcoming.map((r) => (
                <ReminderCard
                  key={r.id}
                  reminder={r}
                  item={itemsById.get(r.itemId)}
                  showActions
                  onAction={onAction}
                  onOpen={() => router.push(`/item/${r.itemId}`)}
                />
              ))
            )}
          </Section>

          <Section title="Past (last 30 days)">
            {past.length === 0 ? (
              <AppText size="sm" color={theme.colors.text.tertiary} style={styles.sectionEmpty}>
                No recent reminders.
              </AppText>
            ) : (
              past.map((r) => (
                <ReminderCard
                  key={r.id}
                  reminder={r}
                  item={itemsById.get(r.itemId)}
                  onOpen={() => router.push(`/item/${r.itemId}`)}
                />
              ))
            )}
          </Section>
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

function ReminderCard({
  reminder,
  item,
  showActions = false,
  onAction,
  onOpen,
}: {
  reminder: Reminder;
  item: Item | undefined;
  showActions?: boolean;
  onAction?: (actionId: string, r: Reminder) => void;
  onOpen: () => void;
}) {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  const dimmed = reminder.status === 'dismissed';
  return (
    <Card style={styles.card}>
      <TouchableOpacity activeOpacity={0.7} onPress={onOpen} style={styles.cardRow}>
        <View style={styles.iconCircle}>
          <Ionicons name={TYPE_ICONS[reminder.type]} size={18} color={theme.colors.accent} />
        </View>
        <View style={styles.cardText}>
          <AppText weight="medium" numberOfLines={1} color={dimmed ? theme.colors.text.tertiary : theme.colors.text.primary}>
            {item?.name ?? 'Item'}
          </AppText>
          <AppText size="xs" color={theme.colors.text.tertiary}>
            {REMINDER_TYPE_LABELS[reminder.type]} · {relativeDateLabel(datePart(reminder.triggerDate))}
          </AppText>
        </View>
      </TouchableOpacity>

      {showActions && onAction ? (
        <View style={styles.actions}>
          <Button
            label="Mark done"
            variant="secondary"
            size="sm"
            onPress={() => onAction(ACTION_IDS.done, reminder)}
            style={styles.flex1}
          />
          <Button
            label="Snooze 1 day"
            variant="ghost"
            size="sm"
            onPress={() => onAction(ACTION_IDS.snooze, reminder)}
            style={styles.flex1}
          />
        </View>
      ) : null}
    </Card>
  );
}

const makeStyles = (theme: Theme) => StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.sm,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: theme.spacing.base,
    gap: theme.spacing.lg,
  },
  section: {
    gap: theme.spacing.sm,
  },
  sectionBody: {
    gap: theme.spacing.sm,
  },
  sectionEmpty: {
    paddingVertical: theme.spacing.sm,
  },
  card: {
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardText: {
    flex: 1,
    gap: 2,
  },
  actions: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  flex1: {
    flex: 1,
  },
});
