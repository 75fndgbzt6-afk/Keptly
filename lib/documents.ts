// Document-type presentation: a sensible icon per government/personal doc type.
import React from 'react';
import { Ionicons } from '@expo/vector-icons';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const DOC_TYPE_ICONS: Record<string, IoniconName> = {
  Passport: 'airplane-outline',
  'Driving License': 'car-outline',
  'Vehicle RC': 'car-sport-outline',
  'Voter ID': 'finger-print-outline',
  PAN: 'card-outline',
  Aadhaar: 'id-card-outline',
  'National ID': 'id-card-outline',
  'Health Insurance Card': 'medkit-outline',
  'Birth Certificate': 'document-text-outline',
  'Marriage Certificate': 'heart-outline',
  'Educational Certificate': 'school-outline',
  'Property Document': 'home-outline',
  'Other document': 'document-outline',
};

/** Icon for a document type; falls back to a generic document glyph. */
export function iconForDocType(docType: string | undefined): IoniconName {
  if (!docType) return 'document-text-outline';
  return DOC_TYPE_ICONS[docType] ?? 'document-text-outline';
}
