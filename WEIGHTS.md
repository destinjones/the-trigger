# Weights changelog

The weights are the index's whole opinion. They live in `index/weights.v*.yaml`; a published version is never edited, and every version stays runnable (`pnpm snapshot -- --weights v1`). This file records each version, what moved, and why. The snapshot records which version scored it (`weightsVersion`).

There have been three versions. The default is **v3**, which keeps v2's weights and changes how confidence counts sources.

| Sub-index | v1 | v2 | Why it moved |
| --- | --- | --- | --- |
| Labor dislocation | 0.25 | **0.30** | It is the thesis: checks get forced by payroll breaking. It should be the heaviest weight. |
| Political momentum | 0.20 | 0.20 | Unchanged. |
| Public opinion | 0.15 | 0.15 | Weight unchanged; the input became a weighted average of national polls instead of the latest single poll. |
| Corporate equity | 0.10 | **0.15** | Now scores the equity pipeline (proposals discounted by firmness) against a $25B anchor. v1 counted binding commitments only, which pinned it at 0 on the liveliest story in the data. |
| Precedent | 0.15 | 0.15 | Unchanged. |
| Fiscal pressure | 0.15 | **0.05** | The deficit says whether government is stretched, not whether AI is displacing anyone, and its sign is ambiguous. In v1 it outweighed corporate equity. |

## v3: skipped sources count against confidence

v3 has the same weights as v2. It adds `coverage.countSkipped: true`: the confidence term now counts a source skipped for a missing key (EDGAR without `SEC_USER_AGENT`, LegiScan without a key) as missing data. Under v2 a skipped source dropped out of the count entirely, so on 2026-10-15, retiring GovTrack and skipping EDGAR raised confidence from 55% to 64% with no new information.

Same inputs, 2026-10-16: readiness **28.1** and the projected date (2031-01-01, ±22 months) are unchanged under both; source coverage goes from 100% to 81.8% and confidence from **64%** to **55%**. The new projection is appended to the ledger; the 64% entry stays and is still graded.

## Effect on the score (v1 to v2)

Same inputs, 2026-10-14: v1 scored **25.7** (first check 2031-03-12, ±22 months, 54% confidence); v2 scores **28.1** (2031-01-01, ±22 months, 55%). The full rationale is in the header comment of `index/weights.v2.yaml`.

## Revisions of 2026-10-14

Eight revisions of the first day's snapshot are in git. Only one of them changed weights.

| Rev | Weights | Readiness | What changed |
| --- | --- | --- | --- |
| r0 | v1 | 25.8 | First snapshot, Tier-1 sources only. |
| r1 | v1 | 25.7 | Tier-2/3 sources added (curated pilots, polls, Challenger, Kalshi, LegiScan, EDGAR). |
| r2 | v1 | 25.7 | Re-run. No model or input change. |
| r3 | **v2** | 28.1 | Weights v2, poll average, equity pipeline. The only reweighting. |
| r4 to r7 | v2 | 28.1 | Re-runs triggered by code pushes (EDGAR fixes, site changes). Inputs and score unchanged. |

## Predictions across versions

Each projection in `predictions/ledger.json` records the weights version it was made with. When a revision changes the projection, the new one is appended and the old one stays in the ledger and is still graded. The site shows the newest projection, and the build fails if the dial and the ledger disagree.

## Proposing a v4

Copy `index/weights.v3.yaml` to `weights.v4.yaml`, change the numbers with a comment on each line, add a row to the table above, run `pnpm test` and `pnpm snapshot -- --weights v4 --dry-run`, and open a pull request with the score your weights produce. See CONTRIBUTING.md.
