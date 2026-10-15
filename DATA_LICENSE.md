# Data sources, attribution and terms

The code in this repository is MIT licensed. The data in `data/`, `fixtures/` and
`sources/curated/` is derived from the sources below, each under its own terms.
Every value in a snapshot carries `sourceName` and `sourceUrl` pointing at the
upstream record. If you republish snapshots, keep those fields.

Our own derived values (normalized scores, sub-indices, readiness, projections)
are released under CC0.

| Source | Used for | Access | Terms |
|---|---|---|---|
| U.S. Bureau of Labor Statistics (api.bls.gov) | Unemployment (LNS14000000), payrolls (CES0000000001), JOLTS openings (JTS540099000000000JOL) | No key; optional `BLS_API_KEY` | Public domain (U.S. government work). BLS asks that it be cited as the source and that it not be implied to endorse this project. |
| Congress.gov API (Library of Congress) | Bill records, co-sponsors, actions | `CONGRESS_API_KEY` (free); falls back to api.data.gov `DEMO_KEY` | Public domain U.S. government data; subject to api.data.gov rate limits. |
| GovTrack.us | Bill status labels, enactment prognosis | No key | GovTrack data is open; attribution to GovTrack.us requested. Prognosis is GovTrack's model. Retired 2026-10-15 (API returned 502); not called. |
| FRED, Federal Reserve Bank of St. Louis | Deficit % GDP (FYFSGDA188S), interest outlays (FYOINT), receipts (FYFR) | No key (fredgraph CSV); optional `FRED_API_KEY` | Underlying series are OMB/Treasury public data. FRED terms of use apply to the API; attribute "Federal Reserve Bank of St. Louis, FRED". |
| Federal Register API (National Archives) | Presidential documents citing AI | No key | Public domain U.S. government work. |
| SEC EDGAR | Capex (XBRL company concepts), headcount (10-K text) | No key; `SEC_USER_AGENT` with contact info required by SEC | Public domain. SEC fair-access policy: identify yourself in the User-Agent, stay under 10 requests/second. |
| LegiScan | State bills mentioning guaranteed or basic income | `LEGISCAN_API_KEY` (free tier) | LegiScan API terms; CC BY 4.0 for bulk data. Attribute LegiScan. |
| Kalshi | Market price on federal household checks (unscored) | No key, public market data | Kalshi terms of service. Prices are recorded for calibration, not redistributed as a feed. |
| Challenger, Gray & Christmas | Job cuts attributed to AI (curated) | Monthly public reports; no API | Figures are facts reported in public press releases, cited by deep link. Our trailing-12-month figure is our own arithmetic. |
| Guaranteed Income Pilots Dashboard (guaranteedincome.us) and program records | Pilot and permanent program counts, cash disbursed, recipients (curated) | Public pages; no API | Cited by deep link. Totals marked unverified where the publisher does not state them. |
| National polls (Manhattan Institute, Data for Progress, AP-NORC) | Support for a basic income, weighted average (curated) | Public releases and toplines | Cited by deep link with sponsor, sample, field dates and question wording. |
| U.S. Census Bureau, IRS, Sen. Sanders' office, Alaska Department of Revenue | Calculator: population, plan sizes and payment amounts (curated, `sources/curated/payouts.yaml`) | Public pages | Public domain (Census, IRS) or public statements; cited by deep link. |
| OpenAI announcements | Valuation used to size the 5% equity proposal (curated) | Public pages | Cited by deep link. |
| News reports (TechCrunch, CNBC, Economic Security Project, Alaska Department of Revenue) | Corporate proposals, actor roster (curated) | Public pages | Cited by deep link. We record facts, not article text. |

## Fonts

`web/og/fonts/` holds IBM Plex Mono (Copyright 2017 IBM Corp.) under the SIL Open
Font License 1.1, included as `web/og/fonts/OFL.txt`. It is used only to render the
share card at build time.

## Recorded responses

`fixtures/cassettes/*.json` contain upstream API responses recorded for tests and
reproducibility, with credentials stripped. They are redistributed under the same
terms as the sources above.

## Corrections

If a value is wrong, open an issue with the correct upstream link. Corrections are
published as a new revision of the affected snapshot; the original stays in git
history.
