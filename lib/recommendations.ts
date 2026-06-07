// Display metadata for recommendation types. Pure data + lookups — no React, no DB.
// Business rules live in services/recommendation-engine.ts; this is presentation only.
import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { RecommendationType } from '@/types';
import { theme } from '@/constants/theme';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

interface RecommendationMeta {
  label: string;
  icon: IoniconName;
  /** Accent used for the type's icon chip. */
  tint: string;
  tintBg: string;
  /** Grouping order on the Insights list (lower = higher up). */
  order: number;
}

export const RECOMMENDATION_META: Record<RecommendationType, RecommendationMeta> = {
  trial_ending: {
    label: 'Trial ending',
    icon: 'hourglass-outline',
    tint: theme.colors.status.danger,
    tintBg: theme.colors.status.dangerLight,
    order: 0,
  },
  cancel: {
    label: 'Cancel candidate',
    icon: 'close-circle-outline',
    tint: theme.colors.status.warning,
    tintBg: theme.colors.status.warningLight,
    order: 1,
  },
  duplicate: {
    label: 'Possible overlap',
    icon: 'copy-outline',
    tint: theme.colors.accent,
    tintBg: theme.colors.accentLight,
    order: 2,
  },
  cycle_optimization: {
    label: 'Cycle tip',
    icon: 'swap-horizontal-outline',
    tint: theme.colors.status.good,
    tintBg: theme.colors.status.goodLight,
    order: 3,
  },
};

/** The "Apply" affordance differs per type. */
export const RECOMMENDATION_APPLY_LABEL: Record<RecommendationType, string> = {
  trial_ending: 'Open item',
  cancel: 'Cancel it',
  duplicate: 'Review',
  cycle_optimization: 'Edit cycle',
};

/** Whether a type contributes its estimatedSavings to the potential-savings total. */
export const COUNTS_TOWARD_SAVINGS: Record<RecommendationType, boolean> = {
  trial_ending: false,
  cancel: true,
  duplicate: true,
  cycle_optimization: false,
};
