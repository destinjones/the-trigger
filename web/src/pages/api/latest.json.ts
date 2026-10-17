/** The newest snapshot, byte-for-byte as committed in data/. Static; rebuilt on every deploy. */
import { latest } from '../../lib/data.ts';

export function GET(): Response {
  return new Response(JSON.stringify(latest, null, 2) + '\n', { headers: { 'content-type': 'application/json; charset=utf-8' } });
}
