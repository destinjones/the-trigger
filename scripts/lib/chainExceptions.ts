import type { ChainExceptions } from './chain.ts';

/**
 * Known, legitimate breaks in the snapshot chain, keyed `${date}:${metricId}`.
 * Past files are never rewritten, so a historical anomaly is recorded here
 * with the reason instead. Keep this list short.
 */
export const CHAIN_EXCEPTIONS: ChainExceptions = {};
