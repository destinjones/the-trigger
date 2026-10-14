import { describe, expect, it } from 'vitest';
import { readinessColor, TOKEN_HEX } from './color.ts';

describe('value color', () => {
  it('bands at 25 / 45 / 65', () => {
    expect([0, 24.9, 25, 44.9, 45, 64.9, 65, 100].map(readinessColor)).toEqual([
      'var(--red)', 'var(--red)', 'var(--amb)', 'var(--amb)', 'var(--cyn)', 'var(--cyn)', 'var(--grn)', 'var(--grn)',
    ]);
  });
  it('has a hex for every band', () => {
    for (const v of [0, 30, 50, 90]) expect(TOKEN_HEX[readinessColor(v)]).toMatch(/^#[0-9a-f]{6}$/);
  });
});
