// Fixed, restrained chart palette (max 6 muted, harmonious shades) used across
// every chart so categories read consistently. Mid-tone hues chosen to sit calmly
// on both the light and dark backgrounds — RocketMoney/Stripe restraint, not bright
// iOS primaries. These are the ONLY non-theme colors allowed in charts.
export const CHART_PALETTE = [
  '#6B7DB3', // muted indigo
  '#5BA39B', // muted teal
  '#C9A66B', // muted gold
  '#B5786C', // muted terracotta
  '#8A9A5B', // muted olive
  '#9B83B5', // muted mauve
] as const;

export type ChartColor = (typeof CHART_PALETTE)[number];

/**
 * Apple-Watch-style activity-ring colors — three clean, distinct hues (red, green,
 * light blue). Fixed (not theme-derived) so the rings read the same in both modes.
 */
export const RING_COLORS = {
  red: '#FA5152',
  green: '#3DD27E',
  blue: '#4Fb8F0',
} as const;

/** Color for a series index, cycling through the palette. */
export function chartColorAt(index: number): string {
  return CHART_PALETTE[((index % CHART_PALETTE.length) + CHART_PALETTE.length) % CHART_PALETTE.length];
}
