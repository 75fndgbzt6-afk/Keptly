// Maps an upcoming date to an urgency level + theme color (green/amber/red).
import { theme } from '@/constants/theme';
import { daysUntil } from './date';

export type UrgencyLevel = 'good' | 'warning' | 'danger' | 'none';

/** danger: overdue · warning: due within 7 days · good: further out · none: no date */
export function urgencyForDate(
  iso: string | null | undefined,
  from?: Date,
): UrgencyLevel {
  const d = daysUntil(iso, from);
  if (d === null) return 'none';
  if (d < 0) return 'danger';
  if (d <= 7) return 'warning';
  return 'good';
}

export function urgencyColor(level: UrgencyLevel): string {
  switch (level) {
    case 'danger':
      return theme.colors.status.danger;
    case 'warning':
      return theme.colors.status.warning;
    case 'good':
      return theme.colors.status.good;
    case 'none':
    default:
      return theme.colors.text.tertiary;
  }
}

/** Badge variant matching an urgency level. */
export function urgencyBadgeVariant(level: UrgencyLevel): 'good' | 'warning' | 'danger' | 'neutral' {
  return level === 'none' ? 'neutral' : level;
}
