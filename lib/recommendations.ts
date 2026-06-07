// Display metadata for recommendation types. Pure data + lookups — no React, no DB.
// Business rules live in services/recommendation-engine.ts; this is presentation only.
import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { RecommendationType } from '@/types';
import { Palette } from '@/constants/theme';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

/** Semantic tone for a recommendation type; resolved to colors at render time. */
export type RecommendationTone = 'danger' | 'warning' | 'accent' | 'good';

interface RecommendationMeta {
  label: string;
  icon: IoniconName;
  tone: RecommendationTone;
  /** Grouping order on the Insights list (lower = higher up). */
  order: number;
}

export const RECOMMENDATION_META: Record<RecommendationType, RecommendationMeta> = {
  trial_ending: { label: 'Trial ending', icon: 'hourglass-outline', tone: 'danger', order: 0 },
  cancel: { label: 'Cancel candidate', icon: 'close-circle-outline', tone: 'warning', order: 1 },
  duplicate: { label: 'Possible overlap', icon: 'copy-outline', tone: 'accent', order: 2 },
  cycle_optimization: { label: 'Cycle tip', icon: 'swap-horizontal-outline', tone: 'good', order: 3 },
};

/** Resolve a tone to its icon color + chip background for the active palette. */
export function recommendationTint(tone: RecommendationTone, colors: Palette): {
  tint: string;
  tintBg: string;
} {
  switch (tone) {
    case 'danger':
      return { tint: colors.status.danger, tintBg: colors.status.dangerLight };
    case 'warning':
      return { tint: colors.status.warning, tintBg: colors.status.warningLight };
    case 'accent':
      return { tint: colors.accent, tintBg: colors.accentLight };
    case 'good':
      return { tint: colors.status.good, tintBg: colors.status.goodLight };
  }
}

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
