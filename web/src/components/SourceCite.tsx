/** The link every rendered number carries. */
export interface SourceCiteProps {
  href: string;
  name: string;
  asOf?: string;
  stale?: boolean;
}

export default function SourceCite({ href, name, asOf, stale }: SourceCiteProps) {
  return (
    <a class="cite" href={href} target="_blank" rel="noopener" title={`${name}${asOf ? `, as of ${asOf}` : ''}`}>
      <span class="cite-mark">src</span>
      <span class="cite-name">{name}</span>
      {asOf && <span class="cite-date">{asOf}</span>}
      {stale && <span class="pill pill-stale">stale</span>}
    </a>
  );
}
