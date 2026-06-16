import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Theme } from '@/constants/theme';
import { useTheme, useThemedStyles } from '@/components/theme';
import { AppText, Badge, Card } from '@/components/ui';
import { ActivityRings } from '@/components/charts';
import { Item } from '@/types';
import { iconForCategory } from '@/lib/category';
import { BILLING_CYCLE_SHORT } from '@/lib/options';
import { COST_UNIT_SUFFIX } from '@/lib/usage-models';
import { formatCurrency } from '@/lib/currency';
import { relativeDateLabel } from '@/lib/date';
import { urgencyColor, urgencyForDate } from '@/lib/urgency';
import { CostPerUse } from '@/services/value-engine';

interface ItemRowProps {
  item: Item;
  onPress: () => void;
  onLongPress?: () => void;
  /** Optional cost-per-use over the last 30 days; shows a muted metric when present. */
  costPerUse?: CostPerUse | null;
  /** Optional 0..1 utilization for tracked items; draws a tiny ring around the icon. */
  utilization?: number | null;
}

export function ItemRow({ item, onPress, onLongPress, costPerUse, utilization }: ItemRowProps) {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  const level = urgencyForDate(item.nextDate);
  const dateColor = urgencyColor(level, theme.colors);
  const cycleSuffix = BILLING_CYCLE_SHORT[item.billingCycle];
  const cpuLabel =
    costPerUse && costPerUse.value !== null
      ? `${formatCurrency(costPerUse.value)}${COST_UNIT_SUFFIX[costPerUse.unit]}`
      : null;
  const icon = (
    <Ionicons name={iconForCategory(item.category)} size={20} color={theme.colors.accent} />
  );

  return (
    <Card onPress={onPress} onLongPress={onLongPress} style={styles.card}>
      {utilization != null ? (
        <ActivityRings size={40} thickness={4} rings={[{ fraction: utilization, color: theme.colors.accent }]}>
          {icon}
        </ActivityRings>
      ) : (
        <View style={styles.iconCircle}>{icon}</View>
      )}

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
        <AppText weight="semibold">{formatCurrency(item.amount)}</AppText>
        {cycleSuffix ? (
          <AppText size="xs" color={theme.colors.text.tertiary}>
            {cycleSuffix}
          </AppText>
        ) : null}
        {cpuLabel ? (
          <AppText size="xs" color={theme.colors.text.tertiary}>
            {cpuLabel}
          </AppText>
        ) : null}
      </View>
    </Card>
  );
}

const makeStyles = (theme: Theme) => StyleSheet.create({
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
