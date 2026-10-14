/** Registry of every source the snapshot runner calls, in run order. */
import type { Source } from './_types.ts';
import { bls } from './bls.ts';
import { congress } from './congress.ts';
import { govtrack } from './govtrack.ts';
import { fred } from './fred.ts';
import { federalRegister } from './federal-register.ts';

export const SOURCES: Source[] = [bls, congress, govtrack, fred, federalRegister];
