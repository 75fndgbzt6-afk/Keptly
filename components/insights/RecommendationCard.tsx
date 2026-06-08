import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText, Button, Card } from '@/components/ui';
import { Theme } from '@/constants/theme';
import { useTheme, useThemedStyles } from '@/components/theme';
import { Recommendation } from '@/types';
import { RECOMMENDATION_META, RECOMMENDATION_APPLY_LABEL, recommendationTint } from '@/lib/recommendations';
import { formatCurrency } from '@/lib/currency';

interface RecommendationCardProps {
  recommendation: Recommendation;
  itemName: string;
  onApply: () => void;
  onDismiss: () => void;
  /** AI-narrated body that replaces the deterministic reason when present. */
  narration?: string | null;
}

export function RecommendationCard({
  recommendation,
  itemName,
  onApply,
  onDismiss,
  narration,
}: RecommendationCardProps) {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  const meta = RECOMMENDATION_META[recommendation.type];
  const { tint, tintBg } = recommendationTint(meta.tone, theme.colors);

  return (
    <Card style={styles.card}>
      <View style={styles.topRow}>
        <View style={[styles.iconChip, { backgroundColor: tintBg }]}>
          <Ionicons name={meta.icon} size={18} color={tint} />
        </View>
        <View style={styles.headingText}>
          <AppText weight="semibold" numberOfLines={1}>
            {itemName}
          </AppText>
          <AppText size="xs" color={theme.colors.text.tertiary}>
            {meta.label}
          </AppText>
        </View>
        {recommendation.estimatedSavings !== null ? (
          <View style={styles.savings}>
            <AppText size="sm" weight="semibold" color={theme.colors.status.good}>
              {formatCurrency(recommendation.estimatedSavings)}
            </AppText>
            <AppText size="xs" color={theme.colors.text.tertiary}>
              /mo saved
            </AppText>
          </View>
        ) : null}
      </View>

      <AppText size="sm" color={theme.colors.text.secondary} style={styles.reason}>
        {narration ?? recommendation.reason}
      </AppText>

      <View style={styles.actions}>
        <Button
          label={RECOMMENDATION_APPLY_LABEL[recommendation.type]}
          variant="secondary"
          size="sm"
          onPress={onApply}
          style={styles.flex1}
        />
        <Button
          label="Dismiss"
          variant="ghost"
          size="sm"
          onPress={onDismiss}
          style={styles.flex1}
        />
      </View>
    </Card>
  );
}

const makeStyles = (theme: Theme) => StyleSheet.create({
  card: {
    gap: theme.spacing.md,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  iconChip: {
    width: 36,
    height: 36,
    borderRadius: theme.radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headingText: {
    flex: 1,
    gap: 2,
  },
  savings: {
    alignItems: 'flex-end',
  },
  reason: {
    lineHeight: theme.lineHeight.sm,
  },
  actions: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  flex1: {
    flex: 1,
  },
});
