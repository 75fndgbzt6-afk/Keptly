import React, { useEffect, useState } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen, AppText, Button } from '@/components/ui';
import { Theme } from '@/constants/theme';
import { useTheme, useThemedStyles } from '@/components/theme';
import { Item } from '@/types';
import { DEFAULT_LEAD_DAYS, primaryTrackType } from '@/lib/reminders';
import { REMINDER_TYPE_LABELS } from '@/lib/notification-copy';
import { getItem, updateItem } from '@/db/items';
import { useItemsStore } from '@/stores/itemsStore';

function leadLabel(days: number): string {
  if (days <= 0) return 'On the day';
  if (days === 1) return '1 day before';
  return `${days} days before`;
}

export default function EditRemindersModal() {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const refresh = useItemsStore((s) => s.refresh);

  const [item, setItem] = useState<Item | null>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const found = await getItem(id);
      if (!found) return;
      setItem(found);
      const type = primaryTrackType(found);
      const defaults = type ? DEFAULT_LEAD_DAYS[type] : [];
      setSelected(found.reminderLeadDays ?? defaults);
    })();
  }, [id]);

  const type = item ? primaryTrackType(item) : null;
  const candidates = type ? DEFAULT_LEAD_DAYS[type] : [];

  const toggle = (day: number) =>
    setSelected((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day],
    );

  const onSave = async () => {
    if (!item) return;
    setSaving(true);
    const sorted = [...selected].sort((a, b) => b - a);
    await updateItem(item.id, { reminderLeadDays: sorted });
    await refresh();
    setSaving(false);
    router.back();
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={styles.header}>
        <AppText size="lg" weight="semibold">
          Reminder timing
        </AppText>
        <TouchableOpacity onPress={() => router.back()} accessibilityLabel="Close" accessibilityRole="button">
          <Ionicons name="close" size={22} color={theme.colors.text.secondary} />
        </TouchableOpacity>
      </View>

      {type ? (
        <>
          <AppText size="sm" color={theme.colors.text.secondary} style={styles.intro}>
            Choose when to be reminded before each {REMINDER_TYPE_LABELS[type].toLowerCase()}.
          </AppText>

          <View style={styles.list}>
            {candidates.map((day) => {
              const on = selected.includes(day);
              return (
                <TouchableOpacity
                  key={day}
                  activeOpacity={0.7}
                  onPress={() => toggle(day)}
                  style={styles.row}
                >
                  <AppText color={theme.colors.text.primary}>{leadLabel(day)}</AppText>
                  <Ionicons
                    name={on ? 'checkbox' : 'square-outline'}
                    size={22}
                    color={on ? theme.colors.accent : theme.colors.text.tertiary}
                  />
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.footer}>
            <Button label="Save" onPress={onSave} loading={saving} size="lg" fullWidth />
          </View>
        </>
      ) : (
        <View style={styles.empty}>
          <AppText color={theme.colors.text.secondary} align="center">
            This item has no date-based reminders to configure. Add a renewal date,
            due date, or expiry to enable reminders.
          </AppText>
        </View>
      )}
    </Screen>
  );
}

const makeStyles = (theme: Theme) => StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.md,
  },
  intro: {
    marginBottom: theme.spacing.base,
  },
  list: {
    gap: theme.spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  footer: {
    marginTop: theme.spacing.lg,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.lg,
  },
});
