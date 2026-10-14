/**
 * Per-metric transforms from raw units to a 0–100 score where
 * higher = closer to a dividend being paid.
 *
 * Every transform is a linear clamp between two anchors unless noted. The
 * anchors are editorial: they say "this value means nothing is happening"
 * (0) and "this value means the trigger has been pulled" (100). They are
 * listed here, not in weights.v1.yaml, because changing an anchor changes the
 * meaning of a metric, while changing a weight only changes its importance.
 * Both are fair game for a PR.
 */

export interface LinearTransform {
  kind: 'linear';
  /** Raw value that maps to 0. */
  at0: number;
  /** Raw value that maps to 100. May be lower than at0 (inverted metric). */
  at100: number;
  unit: string;
  note: string;
}

export interface LogTransform {
  kind: 'log';
  /** Raw value that maps to 100. Zero maps to 0. */
  at100: number;
  unit: string;
  note: string;
}

export type Transform = LinearTransform | LogTransform;

export function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

/** Linear map of `value` from [at0, at100] onto [0, 100], clamped. */
export function linear(value: number, at0: number, at100: number): number {
  if (at0 === at100) throw new Error('linear(): anchors must differ');
  return clamp(((value - at0) / (at100 - at0)) * 100, 0, 100);
}

/**
 * log10(1 + x) scaled so that `at100` maps to 100. Used for dollar totals that
 * span six orders of magnitude, where the first $100M matters far more for
 * precedent than the next $100M does.
 */
export function logScale(value: number, at100: number): number {
  if (at100 <= 0) throw new Error('logScale(): at100 must be positive');
  if (value <= 0) return 0;
  return clamp((Math.log10(1 + value) / Math.log10(1 + at100)) * 100, 0, 100);
}

export const TRANSFORMS: Readonly<Record<string, Transform>> = {
  // ── Labor dislocation ────────────────────────────────────────────────
  'labor.unemployment_rate': {
    kind: 'linear', at0: 4.0, at100: 9.0, unit: '%',
    // 4% is roughly full employment in the post-2015 economy. 9% is the
    // 2009–2010 peak band, the last time Congress mailed checks without a
    // pandemic as the excuse.
    note: '0 at 4.0%, 100 at 9.0%. 4% is roughly full employment; 9% is the 2009 peak band.',
  },
  'labor.payrolls_3mo_avg_change': {
    kind: 'linear', at0: 150, at100: -100, unit: 'thousand jobs/mo',
    // +150k/mo is about what the labor force needs to keep unemployment flat.
    // A sustained -100k/mo is recession territory.
    note: '0 at +150k/mo, 100 at −100k/mo. +150k roughly absorbs labor-force growth; −100k sustained is a recession.',
  },
  'labor.white_collar_openings_yoy': {
    kind: 'linear', at0: 0, at100: -40, unit: '% YoY',
    // Spec calls for entry-level white-collar postings. No free federal series
    // isolates entry level, so v1 uses JOLTS job openings in professional and
    // business services as a proxy. See /method, "known weaknesses".
    note: '0 at 0% YoY, 100 at −40% YoY. Proxy: JOLTS professional and business services openings.',
  },
  'labor.ai_layoffs_ttm': {
    kind: 'linear', at0: 0, at100: 500_000, unit: 'jobs',
    // 500k explicitly AI-attributed cuts in a year would be ~0.3% of payroll
    // employment, concentrated in the highest-spending households.
    note: '0 at 0, 100 at 500,000 jobs cut with AI cited as the reason, trailing 12 months.',
  },

  // ── Political momentum ───────────────────────────────────────────────
  'politics.bills_with_committee_movement': {
    kind: 'linear', at0: 0, at100: 10, unit: 'bills',
    // "Movement" = any committee action past referral (hearing, markup,
    // report) or any floor action. Ten simultaneously live bills means the
    // idea has a caucus, not a sponsor.
    note: '0 at 0, 100 at 10 active federal bills with committee action beyond referral.',
  },
  'politics.cosponsors_total': {
    kind: 'linear', at0: 0, at100: 218, unit: 'co-sponsors',
    // Added beyond the v1 spec list. Sum of co-sponsors across tracked bills;
    // 218 is a House majority, the point where co-sponsorship becomes a
    // discharge-petition threat.
    note: '0 at 0, 100 at 218 total co-sponsors across tracked bills (a House majority).',
  },
  'politics.ai_executive_actions_12mo': {
    kind: 'linear', at0: 0, at100: 20, unit: 'documents',
    // Added beyond the v1 spec list. Presidential documents and final rules in
    // the Federal Register that mention AI and workforce, trailing 12 months.
    note: '0 at 0, 100 at 20 AI-and-workforce executive documents in the Federal Register, trailing 12 months.',
  },

  // ── Precedent ────────────────────────────────────────────────────────
  'precedent.permanent_programs': {
    kind: 'linear', at0: 0, at100: 20, unit: 'programs',
    // A pilot that ends proves little politically. A program written into a
    // standing budget is precedent. Alaska PFD counts.
    note: '0 at 0, 100 at 20 enacted or permanent cash programs in the US.',
  },
  'precedent.cash_disbursed_usd': {
    kind: 'log', at100: 10_000_000_000, unit: 'USD',
    note: 'Log scale. 0 at $0, 100 at $10B cumulative guaranteed-income cash disbursed (excludes Alaska PFD).',
  },
  'precedent.recipients': {
    kind: 'log', at100: 1_000_000, unit: 'people',
    // Added beyond the v1 spec list. Log because the first 10,000 recipients
    // produce most of the research literature.
    note: 'Log scale. 0 at 0, 100 at 1,000,000 cumulative guaranteed-income recipients.',
  },

  // ── Fiscal pressure ──────────────────────────────────────────────────
  'fiscal.deficit_pct_gdp': {
    kind: 'linear', at0: 3, at100: 10, unit: '% of GDP',
    note: '0 at 3% of GDP, 100 at 10%. Federal surplus or deficit, inverted sign.',
  },
  'fiscal.interest_pct_receipts': {
    kind: 'linear', at0: 10, at100: 30, unit: '% of receipts',
    // Added beyond the v1 spec list. Debt service as a share of federal
    // receipts. Rising interest crowds out the status quo budget.
    note: '0 at 10%, 100 at 30% of federal receipts spent on interest.',
  },

  // ── Public opinion ───────────────────────────────────────────────────
  'opinion.ubi_support_pct': {
    kind: 'linear', at0: 30, at100: 75, unit: '%',
    note: '0 at 30% support, 100 at 75%. Most recent national poll on a federal basic income.',
  },

  // ── Corporate equity ─────────────────────────────────────────────────
  'corporate.equity_commitments_usd': {
    kind: 'linear', at0: 0, at100: 100_000_000_000, unit: 'USD',
    // Binding, dated commitments only. Proposals and op-eds score 0.
    note: '0 at $0, 100 at $100B of equity or cash committed by AI firms to a public fund.',
  },
  'corporate.equity_pipeline_usd': {
    kind: 'linear', at0: 0, at100: 25_000_000_000, unit: 'USD',
    // Added in v2. Sum of proposed equity or cash for a public fund, each
    // discounted by how firm it is: binding 1.0, signed 0.6, reported talks
    // 0.3, floated 0.15. $25B (discounted) is reachable this decade; v1's
    // $100B binding-only anchor was not.
    note: '0 at $0, 100 at $25B of discounted equity pipeline (binding ×1.0, signed ×0.6, reported talks ×0.3, floated ×0.15).',
  },
  'corporate.capex_headcount_gap_pp': {
    kind: 'linear', at0: 0, at100: 50, unit: 'pp',
    // Added beyond the v1 spec list. From SEC filings: YoY capex growth minus
    // YoY headcount growth across tracked AI firms, in percentage points. A
    // 50pp gap means machines are absorbing the budget people used to.
    note: '0 at 0pp, 100 at 50pp gap between capex growth and headcount growth at tracked AI firms (SEC 10-K).',
  },

  // ── Unscored, recorded for calibration ───────────────────────────────
  'labor.ai_layoffs_ytd': {
    kind: 'linear', at0: 0, at100: 500_000, unit: 'jobs',
    note: 'Unscored. AI-attributed job cuts, calendar year to date. Display only; the scored figure is the trailing 12 months.',
  },
  'markets.passage_probability': {
    kind: 'linear', at0: 0, at100: 100, unit: '%',
    note: 'Unscored. Prediction-market probability of a federal UBI/dividend, for calibration only.',
  },
  'politics.govtrack_prognosis_max': {
    kind: 'linear', at0: 0, at100: 100, unit: '%',
    note: 'Unscored. Highest GovTrack enactment prognosis among tracked bills.',
  },
  'politics.state_bills_active': {
    kind: 'linear', at0: 0, at100: 50, unit: 'bills',
    note: 'Unscored in v1. Active state guaranteed-income bills (LegiScan).',
  },
};

/** Normalize one raw value. Throws on unknown metric so typos fail loudly. */
export function normalize(metricId: string, value: number): number {
  const t = TRANSFORMS[metricId];
  if (!t) throw new Error(`normalize(): no transform for metric "${metricId}"`);
  if (!Number.isFinite(value)) throw new Error(`normalize(): non-finite value for "${metricId}"`);
  return t.kind === 'linear' ? linear(value, t.at0, t.at100) : logScale(value, t.at100);
}
