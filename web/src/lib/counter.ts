/**
 * Live counters, honestly: a year-to-date figure extended at its own average
 * rate since the last data point. Every counter is labeled as interpolated.
 * Runs in the browser only; the build renders the last published value.
 */
export interface Interpolated { base: number; ratePerMs: number; since: number }

export function interpolate(ytd: number, asOfISO: string, yearStartISO: string): Interpolated {
  const since = Date.parse(asOfISO);
  const elapsed = Math.max(since - Date.parse(yearStartISO), 1);
  return { base: ytd, ratePerMs: ytd / elapsed, since };
}

export function valueAt(c: Interpolated, now = Date.now()): number {
  return c.base + c.ratePerMs * Math.max(now - c.since, 0);
}

/** One rAF loop for every counter on the page, throttled to ~11fps. */
export function startCounters(items: { el: HTMLElement; c: Interpolated }[]): void {
  const fmt = (n: number) => Math.round(n).toLocaleString('en-US');
  let last = 0;
  const frame = (ts: number) => {
    if (ts - last > 90) {
      last = ts;
      for (const it of items) it.el.textContent = fmt(valueAt(it.c));
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
