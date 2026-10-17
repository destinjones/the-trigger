# The Trigger: notes for coding agents

Open-source tracker of US readiness for an AI-funded citizen dividend. Read README.md first.

## Commands
- `pnpm test` (vitest), `pnpm typecheck`, `pnpm lint`, `pnpm build` (Astro, static, root `web/`)
- `pnpm snapshot [-- --date D --replay FILE --record FILE --revise --dry-run --weights vN]` (default: newest weights file)
- `pnpm scorecard` regenerates SCOREBOARD.md from predictions/ledger.json
- `pnpm health` lists failed/skipped sources and curated files near expiry; the snapshot job mirrors it into one `pipeline-health` issue
- `pnpm typecheck` runs `tsc` and `astro check`; CI runs lint, typecheck, test, build, check-site on every PR

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
- `web/` Astro + Preact components. Only `Calculator` hydrates (`client:load`). The dial's today-marker, the YTD counters, and the wire are small inline scripts over complete build-time HTML. `pnpm check-site` (after build) fails if any page renders a different snapshot than the newest data file.
- `fixtures/cassettes/` recorded upstream responses for tests.

## Adding a source
1. Implement `Source` (or `RichSource` for bills/actors/filings), return raw values in upstream units.
2. Add a transform with a comment in `normalize.ts` and map the metric in a weights file (or `null` for unscored).
3. Test the parser against a recorded or minimal real response. Missing key → set `requiresEnv` so it is skipped, not failed.
4. Add its terms to DATA_LICENSE.md.

## Design tokens
All in `web/src/styles/tokens.css`; never hardcode a colour or size. bg #06080b, pnl #0b0f15, bd #182030, grid #111720, fg #f4f7fb, mut #71829a, dim #3a4757, amb #ffb020 (the only brand accent), red #ff4a4a, cyn #38d2f2, grn #3ddc84. Readiness colour comes from `index/color.ts` only. Text is never `--dim` (2.1:1, fails WCAG AA); labels use `--mut`, and `--dim` is for rules, ticks and disabled controls. Bimodal type scale: 9.5/10/12.5/14 for labels and body, 22/31/40/62 for figures. Weights 400/500 only, no shadows; the one gradient is the gap fill. Mono tabular numerals for figures. Motion only on data, once on load, frozen under prefers-reduced-motion.
