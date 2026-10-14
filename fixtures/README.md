# Fixtures

`cassettes/YYYY-MM-DD.json` are recorded upstream HTTP responses, keyed by
method + URL with credentials stripped. They serve two purposes:

1. Source parsers are tested against real responses (`sources/sources.test.ts`).
2. A snapshot can be rebuilt byte-for-byte from what upstream said that day:
   `pnpm snapshot -- --date 2026-10-14 --replay fixtures/cassettes/2026-10-14.json --revise --dry-run`

Record a new one with `pnpm snapshot -- --record fixtures/cassettes/$(date +%F).json`.

The 2026-10-14 cassette was recorded through an HTTPS relay because the build
container had no direct egress; bodies were re-serialized, values are verbatim.
GovTrack returned 502 for every request that day and the cassette keeps those
failures, which is what exercises the stale-value path.
