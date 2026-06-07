import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '@/constants/theme';
import { AppText, Badge, Card } from '@/components/ui';
import { Item } from '@/types';
import { CATEGORY_ICONS } from '@/lib/category';
import { BILLING_CYCLE_SHORT } from '@/lib/options';
import { formatCurrency } from '@/lib/currency';
import { relativeDateLabel } from '@/lib/date';
import { urgencyColor, urgencyForDate } from '@/lib/urgency';

interface ItemRowProps {
  item: Item;
  onPress: () => void;
}

export function ItemRow({ item, onPress }: ItemRowProps) {
  const level = urgencyForDate(item.nextDate);
  const dateColor = urgencyColor(level);
  const cycleSuffix = BILLING_CYCLE_SHORT[item.billingCycle];

  return (
    <Card onPress={onPress} style={styles.card}>
      <View style={styles.iconCircle}>
        <Ionicons
          name={CATEGORY_ICONS[item.category]}
          size={20}
          color={theme.colors.accent}
        />
      </View>

      <View style={styles.middle}>
        <AppText weight="semibold" numberOfLines={1}>
          {item.name}
        </AppText>
        <View style={styles.metaRow}>
          <Badge label={item.category} variant="neutral" />
          {item.nextDate ? (
            <AppText size="xs" weight="medium" color={dateColor}>
              {relativeDateLabel(item.nextDate)}
            </AppText>
          ) : (
            <AppText size="xs" color={theme.colors.text.tertiary}>
              No set date
            </AppText>
          )}
        </View>
      </View>

      <View style={styles.right}>
        <AppText weight="semibold">{formatCurrency(item.amount, item.currency)}</AppText>
        {cycleSuffix ? (
          <AppText size="xs" color={theme.colors.text.tertiary}>
            {cycleSuffix}
          </AppText>
        ) : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.md,
    gap: theme.spacing.md,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  middle: {
    flex: 1,
    gap: theme.spacing.xs,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  right: {
    alignItems: 'flex-end',
  },
});
