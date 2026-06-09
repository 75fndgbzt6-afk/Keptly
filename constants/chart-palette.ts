// iOS system colors — vivid, readable on both light and dark backgrounds.
// These are the ONLY non-theme colors allowed in charts.
export const CHART_PALETTE = [
  '#007AFF', // iOS blue
  '#30D158', // iOS green
  '#FF9F0A', // iOS amber
  '#FF375F', // iOS pink-red
  '#BF5AF2', // iOS purple
  '#FF6B00', // iOS orange
] as const;

export type ChartColor = (typeof CHART_PALETTE)[number];

/**
 * Apple-Watch-style activity-ring colors — three vivid, distinct hues that match
 * the Move / Exercise / Stand rings. Fixed so rings look identical in both modes.
 */
export const RING_COLORS = {
  red: '#FF2D55',
  green: '#00E676',
  blue: '#00B4FF',
} as const;

/** Color for a series index, cycling through the palette. */
export function chartColorAt(index: number): string {
  return CHART_PALETTE[((index % CHART_PALETTE.length) + CHART_PALETTE.length) % CHART_PALETTE.length];
}
