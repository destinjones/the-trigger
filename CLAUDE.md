# The Trigger: notes for coding agents

Open-source tracker of US readiness for an AI-funded citizen dividend. Read README.md first.

## Commands
- `pnpm test` (vitest), `pnpm typecheck`, `pnpm lint`, `pnpm build` (Astro, static, root `web/`)
- `pnpm snapshot [-- --date D --replay FILE --record FILE --revise --dry-run --weights v1]`
- `pnpm scorecard` regenerates SCOREBOARD.md from predictions/ledger.json

## Non-negotiables
1. Git is the database. No backend, no runtime API calls in the browser. The site reads `data/*.json` at build time.
2. Never rewrite a past snapshot. Corrections are a new revision (`--revise`), committed separately.
3. Every rendered number carries a `SourceCite` deep link. A source result without an `https` `sourceUrl` is rejected by the runner.
4. Weights live only in `index/weights.v*.yaml`. Never hardcode weights in logic. Never edit a published weights version; add a new one.
5. `index/` is pure: no I/O, no `Date.now()`, no randomness (lint enforces). Pass the date in.
6. Predictions ledger is append-only. SCOREBOARD.md is generated; do not hand-edit.
7. Tone: technical, flat, sentence case, no emoji, no hype.

## Layout
- `index/` model (normalize.ts transforms, model.ts composite + projection, weights YAML)
- `sources/` one module per source implementing `Source` from `_types.ts`; register in `sources/index.ts`. Use `ctx.http` (never global fetch) so runs can be recorded/replayed, and `ctx.today` (never the clock).
- `sources/curated/*.yaml` hand-maintained values with deep links; fail when `reviewedOn` is older than `maxAgeDays`.
- `scripts/lib/run.ts` runner: isolates failures, carries last values forward with `stale: true`.
- `web/` Astro + Preact components. Only `Clock` hydrates (`client:load`).
- `fixtures/cassettes/` recorded upstream responses for tests.

## Adding a source
1. Implement `Source` (or `RichSource` for bills/actors/filings), return raw values in upstream units.
2. Add a transform with a comment in `normalize.ts` and map the metric in a weights file (or `null` for unscored).
3. Test the parser against a recorded or minimal real response. Missing key → set `requiresEnv` so it is skipped, not failed.
4. Add its terms to DATA_LICENSE.md.

## Design tokens
bg #0e1117, panel #151a23, border #242b38, fg #e6e9ef, muted #7b8798, green #2fd47a, red #ff5c5c, amber #f5b544, cyan #3dd6f5, violet #a78bfa. Weights 400/500 only, min 11px, no gradients or shadows, mono tabular numerals for figures.
