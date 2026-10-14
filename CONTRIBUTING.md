# Contributing

Thanks for looking. The Trigger is small on purpose: one daily snapshot, one
static site, every number cited. Contributions that keep it that way are
welcome. Read [CLAUDE.md](CLAUDE.md) for the non-negotiables (it is written for
coding agents, and it is the shortest accurate summary for people too).

## Setup

```sh
nvm use                 # Node 22.12+
corepack enable         # pnpm 10
pnpm install
pnpm test && pnpm typecheck && pnpm lint
pnpm snapshot -- --replay fixtures/cassettes/2026-10-14.json --dry-run   # offline, no keys
pnpm dev                # site at http://localhost:4321
```

## Ways to help, smallest first

1. **Fix a curated value.** Everything in `sources/curated/*.yaml` has a deep
   link. If one is wrong, stale, or better sourced elsewhere, change it, bump
   `reviewedOn`, and put the new link in the PR description.
2. **Add a poll.** Append to `sources/curated/polling.yaml` with pollster, field
   end date, sample size, support, oppose, partisan lean (`left`, `right` or
   `null`), the question wording, and a link to the topline.
3. **Add an equity proposal or a bill.** Proposals go in
   `sources/curated/corporate.yaml` with a status (`binding`, `signed`,
   `reported`, `floated`). Bills go in `sources/watchlist.yaml`.
4. **Add an event** to `index/events.yaml` for the "what would move it" page.
   It needs a checkable condition, the raw metric values it would change, and a
   `watch` link where anyone can see whether it happened.
5. **Argue with the weights.** Copy `index/weights.v2.yaml` to
   `weights.v3.yaml`, change what you disagree with, explain why in comments,
   and include the readiness and date your version produces
   (`pnpm snapshot -- --replay ... --dry-run --weights v3`). Never edit a
   published weights file.
6. **Add a source.** Follow "Adding a source" in CLAUDE.md: implement `Source`,
   use `ctx.http` and `ctx.today`, add a transform with a comment in
   `index/normalize.ts`, map it in a new weights version (or `null` for
   unscored), test the parser against a recorded response, and add its terms to
   DATA_LICENSE.md.

## Rules that will get a PR sent back

- A number without an `https` source link.
- An edit to a past file in `data/`, to `predictions/ledger.json` history, or to
  a published `weights.v*.yaml`.
- `Date.now()`, randomness, or I/O inside `index/`.
- A source that calls `fetch` directly instead of `ctx.http`.
- Hype, emoji, or advocacy in copy. The site states what the data says, flatly.

## Reporting a problem

Open an issue with the snapshot date, the number you think is wrong, and the
link that shows the right one.
