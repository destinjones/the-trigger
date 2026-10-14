/** Binding corporate equity commitments and the "who's moving" roster (curated). */
import { curatedSource, curatedOutput, loadCurated } from './_curated.ts';

const base = curatedSource('corporate', 'corporate', 2);

export const corporate: typeof base = {
  ...base,
  async fetchRich(ctx) {
    const out = curatedOutput(loadCurated('corporate'), 'corporate', ctx.today);
    // The actor roster rides along with this source.
    out.actors = curatedOutput(loadCurated('actors'), 'actors', ctx.today).actors;
    return out;
  },
};
