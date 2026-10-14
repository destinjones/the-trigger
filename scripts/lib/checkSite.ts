/**
 * Post-build guard: every page must render the same snapshot. Base.astro writes
 * <meta name="trigger:snapshot" content="DATE rREV READINESS"> on each page;
 * this compares them against each other and against the newest data file.
 */
export interface PageStamp { page: string; stamp: string | null }

export function readStamp(html: string): string | null {
  const m = /<meta name="trigger:snapshot" content="([^"]+)"/.exec(html);
  return m?.[1] ?? null;
}

export function expectedStamp(s: { date: string; revision: number; readiness: number }): string {
  return `${s.date} r${s.revision} ${s.readiness}`;
}

/** Problems, one line each; empty means the site is consistent. */
export function checkStamps(pages: PageStamp[], expected: string): string[] {
  const out: string[] = [];
  if (pages.length === 0) out.push('no HTML pages found');
  for (const p of pages) {
    if (p.stamp === null) out.push(`${p.page}: no trigger:snapshot meta`);
    else if (p.stamp !== expected) out.push(`${p.page}: renders "${p.stamp}", newest data file is "${expected}"`);
  }
  return out;
}
