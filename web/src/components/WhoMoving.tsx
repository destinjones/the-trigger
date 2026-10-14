import type { ActorRecord } from '../../../sources/_types.ts';
import SourceCite from './SourceCite.tsx';

/** Actor, vehicle, status, directional signal. */
export default function WhoMoving({ actors }: { actors: ActorRecord[] }) {
  const glyph = { toward: '▲', away: '▼', neutral: '■' } as const;
  const cls = { toward: 'green', away: 'red', neutral: 'muted' } as const;
  return (
    <table class="table">
      <thead>
        <tr><th>Actor</th><th>Vehicle</th><th>Status</th><th>Signal</th><th>Source</th></tr>
      </thead>
      <tbody>
        {actors.map((a) => (
          <tr key={`${a.actor}-${a.vehicle}`}>
            <td class="nowrap">{a.actor}</td>
            <td>{a.vehicle}</td>
            <td class="small">{a.status}</td>
            <td class={`num ${cls[a.signal]}`} title={a.signal}>{glyph[a.signal]} {a.signal}</td>
            <td><SourceCite href={a.sourceUrl} name={a.sourceName} asOf={a.asOf} /></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
