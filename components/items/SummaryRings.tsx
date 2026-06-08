import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Theme } from '@/constants/theme';
import { useTheme, useThemedStyles } from '@/components/theme';
import { AppText, Card } from '@/components/ui';
import { ActivityRings } from '@/components/charts';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

export interface RingDatum {
  fraction: number;
  color: string;
  label: string;
  caption: string;
  icon: IoniconName;
}

/** Apple-Watch-style summary card: three rings + an icon legend + an expand arrow. */
export function SummaryRings({ rings, onExpand }: { rings: RingDatum[]; onExpand?: () => void }) {
  const styles = useThemedStyles(makeStyles);
  const theme = useTheme();

  return (
    <Card style={styles.card}>
      <ActivityRings
        size={104}
        thickness={11}
        gap={4}
        rings={rings.map((r) => ({ fraction: r.fraction, color: r.color }))}
      />
      <View style={styles.legend}>
        {rings.map((r) => (
          <View key={r.label} style={styles.legendRow}>
            <View style={[styles.iconChip, { backgroundColor: r.color }]}>
              <Ionicons name={r.icon} size={12} color={theme.colors.text.inverse} />
            </View>
            <View style={styles.legendText}>
              <AppText size="sm" weight="medium" numberOfLines={1}>
                {r.label}
              </AppText>
              <AppText size="xs" color={theme.colors.text.tertiary} numberOfLines={1}>
                {r.caption}
              </AppText>
            </View>
          </View>
        ))}
      </View>
      {onExpand ? (
        <TouchableOpacity
          onPress={onExpand}
          style={styles.expand}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Enlarge rings"
        >
          <Ionicons name="expand-outline" size={18} color={theme.colors.text.tertiary} />
        </TouchableOpacity>
      ) : null}
    </Card>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.lg,
    },
    legend: {
      flex: 1,
      gap: theme.spacing.sm,
    },
    legendRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
    },
    iconChip: {
      width: 22,
      height: 22,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
    },
    legendText: {
      flex: 1,
    },
    expand: {
      position: 'absolute',
      top: theme.spacing.sm,
      right: theme.spacing.sm,
      width: 28,
      height: 28,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
