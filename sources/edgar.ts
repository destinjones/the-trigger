/**
 * SEC EDGAR: "spent $X on GPUs, cut Y people", in one place.
 *
 * For each tracked company we read two things from its last two annual reports:
 *
 *   capex      XBRL companyconcept (PaymentsToAcquirePropertyPlantAndEquipment or
 *              the company's equivalent), annual duration facts from 10-K filings.
 *   headcount  the Human Capital section of the 10-K text. Headcount is almost
 *              never XBRL-tagged, so we parse the sentence every 10-K carries
 *              ("As of December 31, 2025, we had 190,167 employees").
 *
 * Metric: corporate.capex_headcount_gap_pp = aggregate capex growth minus
 * aggregate headcount growth, in percentage points, across companies where
 * both years parsed. Per-company rows are published as `filings`.
 *
 * SEC requires a descriptive User-Agent with contact info (SEC_USER_AGENT) and
 * allows 10 requests/second.
 */
import type { FetchContext, FilingRecord, Http, RichSource, SourceOutput } from './_types.ts';

export interface Company {
  name: string;
  ticker: string;
  cik: number;
  /** us-gaap concepts to try for capex, in order. */
  capex: string[];
}

// SEC's documented form is "Company Name AdminContact@domain". Set SEC_USER_AGENT to
// that with a real inbox. Tested from a GitHub Actions runner on 2026-10-14:
// data.sec.gov answers 403 to any agent carrying a users.noreply.github.com
// address, and 200 to a plain name, so the default is the name alone rather
// than an address SEC refuses.
export const DEFAULT_SEC_USER_AGENT = 'TheTrigger';

export const COMPANIES: Company[] = [
  { name: 'Microsoft', ticker: 'MSFT', cik: 789019, capex: ['PaymentsToAcquirePropertyPlantAndEquipment'] },
  { name: 'Alphabet', ticker: 'GOOGL', cik: 1652044, capex: ['PaymentsToAcquirePropertyPlantAndEquipment'] },
  { name: 'Amazon', ticker: 'AMZN', cik: 1018724, capex: ['PaymentsToAcquireProductiveAssets', 'PaymentsToAcquirePropertyPlantAndEquipment'] },
  { name: 'Meta Platforms', ticker: 'META', cik: 1326801, capex: ['PaymentsToAcquirePropertyPlantAndEquipment'] },
  { name: 'Oracle', ticker: 'ORCL', cik: 1341439, capex: ['PaymentsToAcquirePropertyPlantAndEquipment'] },
  { name: 'NVIDIA', ticker: 'NVDA', cik: 1045810, capex: ['PaymentsToAcquirePropertyPlantAndEquipment', 'PaymentsToAcquireProductiveAssets'] },
];

const pad = (cik: number) => String(cik).padStart(10, '0');
export const conceptUrl = (c: Company, concept: string) =>
  `https://data.sec.gov/api/xbrl/companyconcept/CIK${pad(c.cik)}/us-gaap/${concept}.json`;
export const submissionsUrl = (c: Company) => `https://data.sec.gov/submissions/CIK${pad(c.cik)}.json`;
export const docUrl = (c: Company, accession: string, doc: string) =>
  `https://www.sec.gov/Archives/edgar/data/${c.cik}/${accession.replace(/-/g, '')}/${doc}`;

interface ConceptFact {
  start?: string;
  end: string;
  val: number;
  fy?: number;
  form: string;
  accn: string;
  filed: string;
}
interface ConceptResponse {
  units: Record<string, ConceptFact[]>;
}
interface Submissions {
  filings: {
    recent: {
      accessionNumber: string[];
      form: string[];
      reportDate: string[];
      filingDate: string[];
      primaryDocument: string[];
    };
  };
}

export interface AnnualValue {
  end: string;
  val: number;
}

/**
 * Annual (≈12-month duration) values reported in 10-K filings, one per fiscal
 * year end, newest first. When a later 10-K restates a year, the latest filing wins.
 */
export function annualFacts(res: ConceptResponse): AnnualValue[] {
  const facts = res.units.USD ?? [];
  const byEnd = new Map<string, ConceptFact>();
  for (const f of facts) {
    if (!f.form.startsWith('10-K') || !f.start) continue;
    const days = (Date.parse(f.end) - Date.parse(f.start)) / 86_400_000;
    if (days < 350 || days > 380) continue;
    const prev = byEnd.get(f.end);
    if (!prev || f.filed > prev.filed) byEnd.set(f.end, f);
  }
  return [...byEnd.values()]
    .sort((a, b) => b.end.localeCompare(a.end))
    .map((f) => ({ end: f.end, val: f.val }));
}

/** Latest annual reports (10-K, not amendments), newest first. */
export function annualReports(sub: Submissions, n = 2): { accession: string; reportDate: string; doc: string }[] {
  const r = sub.filings.recent;
  const out: { accession: string; reportDate: string; doc: string }[] = [];
  for (let i = 0; i < r.form.length && out.length < n; i++) {
    if (r.form[i] === '10-K') {
      out.push({ accession: r.accessionNumber[i] as string, reportDate: r.reportDate[i] as string, doc: r.primaryDocument[i] as string });
    }
  }
  return out;
}

/** HTML -> plain text, enough for sentence matching. */
export function htmlToText(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;|&#xa0;/gi, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#8217;|&rsquo;/g, "'")
    .replace(/\s+/g, ' ');
}

const HEADCOUNT_PATTERNS: RegExp[] = [
  // "we had 190,167 employees" / "we employed approximately 228,000 people on a full-time basis"
  /\b(?:had|employed|employ|have)\s+(?:a total of\s+)?(?:approximately|about|over|roughly)?\s*([\d]{1,3}(?:,\d{3})+)\s+(?:full[- ]time\s+(?:and\s+part[- ]time\s+)?|total\s+)?(?:employees|people|team members|workers)\b/i,
  // "approximately 36,000 employees in 38 countries"
  /\b(?:approximately|about|over|roughly)\s+([\d]{1,3}(?:,\d{3})+)\s+(?:full[- ]time\s+(?:and\s+part[- ]time\s+)?)?employees\b/i,
  // "our workforce consisted of approximately 162,000 employees"
  /\bworkforce\s+(?:consisted|was comprised)\s+of\s+(?:approximately|about)?\s*([\d]{1,3}(?:,\d{3})+)/i,
];

/**
 * Extract total headcount from 10-K text. Looks only inside the Human Capital /
 * Employees section when it can find one, to avoid matching e.g. a customer's
 * headcount elsewhere in the filing.
 */
export function parseHeadcount(text: string): number | null {
  const flat = text.replace(/\s+/g, ' ');
  const anchor = flat.search(/human capital|our employees|employees and human capital|\bemployees\b\s*(?:as of|at)/i);
  const windows = anchor >= 0 ? [flat.slice(anchor, anchor + 6000), flat] : [flat];
  for (const w of windows) {
    for (const re of HEADCOUNT_PATTERNS) {
      const m = re.exec(w);
      if (m?.[1]) {
        const n = Number(m[1].replace(/,/g, ''));
        if (n >= 1000 && n < 5_000_000) return n;
      }
    }
  }
  return null;
}

export function pct(cur: number, prev: number): number {
  return ((cur - prev) / prev) * 100;
}

async function companyRow(http: Http, c: Company, headers: Record<string, string>): Promise<FilingRecord> {
  let capex: AnnualValue[] = [];
  let lastErr = 'no annual 10-K facts';
  for (const concept of c.capex) {
    try {
      capex = annualFacts(await http.getJson<ConceptResponse>(conceptUrl(c, concept), { headers }));
      if (capex.length >= 2) break;
    } catch (e) {
      // Companies switch concepts over time; try the next one.
      lastErr = e instanceof Error ? e.message : String(e);
    }
  }
  const [cur, prev] = capex;
  if (!cur) throw new Error(`${c.ticker}: capex unavailable (${lastErr})`);

  const reports = annualReports(await http.getJson<Submissions>(submissionsUrl(c), { headers }), 2);
  const heads: (number | null)[] = [];
  for (const r of reports) {
    const html = await http.getText(docUrl(c, r.accession, r.doc), { headers });
    heads.push(parseHeadcount(htmlToText(html)));
  }
  const [hc, hp] = heads;
  const latest = reports[0];
  return {
    company: c.name,
    ticker: c.ticker,
    fiscalYear: Number(cur.end.slice(0, 4)),
    periodEnd: cur.end,
    capexUsd: cur.val,
    capexYoyPct: prev ? Math.round(pct(cur.val, prev.val) * 10) / 10 : null,
    headcount: hc ?? null,
    headcountYoyPct: hc && hp ? Math.round(pct(hc, hp) * 10) / 10 : null,
    sourceUrl: latest ? docUrl(c, latest.accession, latest.doc) : `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${c.cik}&type=10-K`,
  };
}

/** Aggregate capex growth minus aggregate headcount growth, over rows with both. */
export function capexHeadcountGap(rows: FilingRecord[]): { gap: number; n: number; capexYoy: number; headYoy: number } | null {
  const ok = rows.filter((r) => r.capexYoyPct !== null && r.headcount && r.headcountYoyPct !== null);
  if (ok.length === 0) return null;
  let capCur = 0, capPrev = 0, hCur = 0, hPrev = 0;
  for (const r of ok) {
    capCur += r.capexUsd;
    capPrev += r.capexUsd / (1 + (r.capexYoyPct as number) / 100);
    hCur += r.headcount as number;
    hPrev += (r.headcount as number) / (1 + (r.headcountYoyPct as number) / 100);
  }
  const capexYoy = pct(capCur, capPrev);
  const headYoy = pct(hCur, hPrev);
  return { gap: capexYoy - headYoy, n: ok.length, capexYoy, headYoy };
}

export const edgar: RichSource = {
  id: 'edgar',
  tier: 2,
  cadence: 'weekly',
  async fetch(ctx) {
    return (await this.fetchRich(ctx)).metrics;
  },
  async fetchRich(ctx: FetchContext): Promise<SourceOutput> {
    // SEC fair access: the User-Agent must name the requester and give a contact
    // email, or data.sec.gov answers 403. SEC_USER_AGENT overrides the default.
    const ua = ctx.env.SEC_USER_AGENT || DEFAULT_SEC_USER_AGENT;
    const headers = { 'user-agent': ua, 'accept-encoding': 'gzip, deflate' };
    const rows: FilingRecord[] = [];
    const errors: string[] = [];
    for (const c of COMPANIES) {
      try {
        rows.push(await companyRow(ctx.http, c, headers));
      } catch (e) {
        errors.push(e instanceof Error ? e.message : String(e));
      }
    }
    const agg = capexHeadcountGap(rows);
    if (!agg) throw new Error(`EDGAR: no company with both capex and headcount. ${errors.join('; ')}`);
    const capexTotal = rows.reduce((a, r) => a + r.capexUsd, 0);
    const lead = [...rows].sort((a, b) => b.capexUsd - a.capexUsd)[0];
    return {
      metrics: [{
        metricId: 'corporate.capex_headcount_gap_pp',
        label: 'AI capex growth minus headcount growth',
        value: Math.round(agg.gap * 10) / 10,
        unit: 'pp',
        asOf: rows.map((r) => r.periodEnd).sort().at(-1) ?? ctx.today,
        fetchedAt: `${ctx.today}T00:00:00Z`,
        sourceName: `SEC 10-K filings, ${agg.n} companies`,
        sourceUrl: lead?.sourceUrl ?? 'https://www.sec.gov/edgar/search/',
        note: `Capex ${agg.capexYoy >= 0 ? '+' : ''}${agg.capexYoy.toFixed(0)}% YoY to $${Math.round(capexTotal / 1e9)}B; headcount ${agg.headYoy >= 0 ? '+' : ''}${agg.headYoy.toFixed(1)}%`,
      }],
      filings: rows,
    };
  },
};
