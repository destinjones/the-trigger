import { describe, expect, it } from 'vitest';
import { checkStamps, expectedStamp, readStamp } from './checkSite.ts';

describe('checkSite', () => {
  const exp = expectedStamp({ date: '2026-10-14', revision: 5, readiness: 28.1 });
  it('reads the stamp from a page', () => {
    expect(readStamp('<head><meta name="trigger:snapshot" content="2026-10-14 r5 28.1"></head>')).toBe(exp);
    expect(readStamp('<head></head>')).toBeNull();
  });
  it('passes when every page matches the newest snapshot', () => {
    expect(checkStamps([{ page: 'index.html', stamp: exp }, { page: 'log/index.html', stamp: exp }], exp)).toEqual([]);
  });
  it('flags a page serving an older revision or missing the stamp', () => {
    const p = checkStamps([{ page: 'index.html', stamp: '2026-10-14 r2 25.7' }, { page: 'log/index.html', stamp: null }], exp);
    expect(p).toHaveLength(2);
    expect(p[0]).toContain('r2 25.7');
  });
});
