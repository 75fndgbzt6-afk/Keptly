// Category metadata + mapping to category-specific detail shapes (SPEC §6).
import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Category, DetailKind, ItemDetails } from '@/types';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

export const CATEGORIES: Category[] = [
  'Streaming/OTT',
  'Music',
  'AI tools',
  'Cloud/Software',
  'Gym/Fitness',
  'Utilities',
  'Telecom',
  'Insurance',
  'Warranty',
  'Government document',
  'Membership',
  'Other',
];

export const CATEGORY_ICONS: Record<Category, IoniconName> = {
  'Streaming/OTT': 'tv-outline',
  Music: 'musical-notes-outline',
  'AI tools': 'sparkles-outline',
  'Cloud/Software': 'cloud-outline',
  'Gym/Fitness': 'barbell-outline',
  Utilities: 'flash-outline',
  Telecom: 'cellular-outline',
  Insurance: 'shield-checkmark-outline',
  Warranty: 'construct-outline',
  'Government document': 'document-text-outline',
  Membership: 'card-outline',
  Other: 'ellipsis-horizontal-outline',
};

/** Which category-specific detail shape (if any) a category uses. */
export function detailKindForCategory(category: Category): DetailKind {
  switch (category) {
    case 'Warranty':
      return 'warranty';
    case 'Government document':
      return 'document';
    case 'Utilities':
    case 'Telecom':
      return 'utility';
    case 'Insurance':
      return 'insurance';
    default:
      return 'none';
  }
}

/** A fresh, empty details object for a category. */
export function emptyDetailsFor(category: Category): ItemDetails {
  switch (detailKindForCategory(category)) {
    case 'warranty':
      return { kind: 'warranty' };
    case 'document':
      return { kind: 'document' };
    case 'utility':
      return { kind: 'utility' };
    case 'insurance':
      return { kind: 'insurance' };
    case 'none':
    default:
      return { kind: 'none' };
  }
}
