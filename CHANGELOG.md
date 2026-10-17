# Changelog

Changes to the code, the model and the site. Data changes are not listed here: every snapshot is its own commit in [`data/`](data), and the weekly [log](https://destinjones.github.io/the-trigger/log) describes what moved. Weight changes are also recorded, with their reasons, in [WEIGHTS.md](WEIGHTS.md).

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Versions follow [Semantic Versioning](https://semver.org/), where a change to the weights or the projection formula is a minor version.

## [Unreleased]

### Model
- Weights v3 is the default. Same weights as v2; confidence now counts sources skipped for a missing key as missing data. Confidence on current inputs goes from 64% to 55%; readiness and the projected date are unchanged. See [WEIGHTS.md](WEIGHTS.md).
- `pnpm snapshot` defaults to the newest `index/weights.v*.yaml` instead of a version named in code, and accepts the documented `pnpm snapshot -- --flag` form (the `--` used to be rejected).

### Added
- `/data` page and static JSON endpoints: `/api/latest.json` (newest snapshot) and `/api/history.json` (one row per day). Dataset metadata (schema.org) for search engines.
- `sitemap.xml`, `robots.txt`, a 404 page, a skip-to-content link and visible keyboard focus.
- Pipeline health report (`pnpm health`). After every snapshot run the workflow opens or updates one `pipeline-health` issue listing failed or skipped sources, curated files within 14 days of expiring, and a stalled daily job, and closes it when a run is clean.
- `astro check` in `pnpm typecheck`, so the site's TypeScript is checked in CI, not only the model and sources.
- Lint rules that keep sources on `ctx.http` and `ctx.today`, and keep `new Date()` out of the model.
- CHANGELOG.md, SECURITY.md, CODE_OF_CONDUCT.md, CITATION.cff, issue forms, a pull request template and Dependabot.

### Changed
- `/log` is daily: one entry per snapshot against the day before, quiet days included and marked. RSS stays a weekly digest.
- The Kalshi metric is labelled "Market odds of tariff-funded household checks", which is what that market asks. It was labelled as if it priced a federal dividend.
- Fonts are self-hosted (IBM Plex, latin subset, weights 400 and 500). Pages make no third-party requests.
- Label text uses `--mut` instead of `--dim`, which was 2.1:1 against the background. All text now meets WCAG AA contrast; `--dim` remains for rules, ticks and disabled controls.
- Wide tables on `/method` and the tracker scroll inside their panel on phones instead of widening the page.

### Fixed
- The ledger's `Prediction` type on the site was missing `kind`, `window` and `revision`; the site now imports the scorecard's type.

## [0.1.0] - 2026-10-15

First public version.

- Six-sub-index readiness score, projection with band and confidence, weights v1 and v2 in versioned YAML ([WEIGHTS.md](WEIGHTS.md)).
- Sources: BLS, Congress.gov, FRED, Federal Register, guaranteed-income pilots, national polling, LegiScan, SEC EDGAR (capex vs headcount from 10-Ks, one throttled client), corporate equity proposals, Challenger AI-attributed layoffs, Kalshi. GovTrack retired after returning 502 throughout.
- Daily snapshot job, git as the database, revisions instead of rewrites, record and replay of upstream responses.
- Prediction ledger and generated SCOREBOARD.md; the dial and the ledger share one projection and the build fails if they disagree.
- Site: tracker with dial and gap chart, "what you'd get" calculator, "what would move it", weekly log with RSS, embeddable badge, generated share card, method page.

[Unreleased]: https://github.com/destinjones/the-trigger/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/destinjones/the-trigger/commits/v0.1.0
