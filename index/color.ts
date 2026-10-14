/**
 * Color encodes value, never identity: the same score gets the same color on
 * every element of every page. Red means "barely started". Pure.
 */
export function readinessColor(v: number): string {
  if (v < 25) return 'var(--red)';
  if (v < 45) return 'var(--amb)';
  if (v < 65) return 'var(--cyn)';
  return 'var(--grn)';
}

/** Hex values of the same tokens, for renderers without CSS (the share card, the badge). */
export const TOKEN_HEX: Readonly<Record<string, string>> = {
  'var(--red)': '#ff4a4a',
  'var(--amb)': '#ffb020',
  'var(--cyn)': '#38d2f2',
  'var(--grn)': '#3ddc84',
};
