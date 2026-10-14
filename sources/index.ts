/** Registry of every source the snapshot runner calls, in run order. */
import type { Source } from './_types.ts';
import { bls } from './bls.ts';
import { congress } from './congress.ts';
import { govtrack } from './govtrack.ts';
import { fred } from './fred.ts';
import { federalRegister } from './federal-register.ts';
import { pilots } from './pilots.ts';
import { polling } from './polling.ts';
import { legiscan } from './legiscan.ts';
import { edgar } from './edgar.ts';
import { corporate } from './corporate.ts';
import { challenger } from './challenger.ts';
import { kalshi } from './kalshi.ts';

export const SOURCES: Source[] = [
  // Tier 1
  bls, congress, govtrack, fred, federalRegister,
  // Tier 2
  pilots, polling, legiscan, edgar, corporate,
  // Tier 3
  challenger, kalshi,
];
