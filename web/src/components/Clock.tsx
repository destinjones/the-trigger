import { useEffect, useState } from 'preact/hooks';
import SourceCite from './SourceCite.tsx';

/**
 * Live countdown to the projected first federal AI dividend. Always shown with
 * its confidence and band: never a date without a band.
 */
export interface ClockProps {
  /** Projected date, YYYY-MM-DD. */
  target: string;
  confidence: number;
  bandMonths: number;
  readiness: number;
  /** Snapshot date the projection belongs to. */
  asOf: string;
  citeHref: string;
  methodHref: string;
}

const DAY = 86_400_000;

function addMonths(iso: string, months: number): Date {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1 + months, d));
}
const ymd = (d: Date) => d.toISOString().slice(0, 10);
function quarter(iso: string): string {
  const [y, m] = iso.split('-').map(Number) as [number, number];
  return `Q${Math.floor((m - 1) / 3) + 1} ${y}`;
}

export function parts(ms: number) {
  const t = Math.max(0, ms);
  return {
    days: Math.floor(t / DAY),
    hours: Math.floor((t % DAY) / 3_600_000),
    minutes: Math.floor((t % 3_600_000) / 60_000),
    seconds: Math.floor((t % 60_000) / 1000),
  };
}

export default function Clock({ target, confidence, bandMonths, readiness, asOf, citeHref, methodHref }: ClockProps) {
  const targetMs = Date.parse(`${target}T00:00:00Z`);
  // First render uses the snapshot date so server and client markup agree; the effect takes over with the real clock.
  const [now, setNow] = useState(() => Date.parse(`${asOf}T00:00:00Z`));
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const p = parts(targetMs - now);
  const lo = addMonths(target, -bandMonths);
  const hi = addMonths(target, bandMonths);

  // Band axis: snapshot date to the end of the projection range.
  const axis0 = Date.parse(`${asOf}T00:00:00Z`);
  const axis1 = Date.UTC(2034, 0, 1);
  const pos = (t: number) => `${Math.max(0, Math.min(100, ((t - axis0) / (axis1 - axis0)) * 100)).toFixed(2)}%`;

  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    <div class="clock">
      <div class="clock-label">Projected first federal AI dividend payment</div>
      <div class="clock-date">
        <strong>{target}</strong> · {quarter(target)} · ±{bandMonths} months · {Math.round(confidence * 100)}% confidence
      </div>
      <div class="countdown" role="timer" aria-live="off">
        <div class="unit"><span class="v">{p.days.toLocaleString('en-US')}</span><span class="l">days</span></div>
        <div class="unit"><span class="v">{pad(p.hours)}</span><span class="l">hours</span></div>
        <div class="unit"><span class="v">{pad(p.minutes)}</span><span class="l">min</span></div>
        <div class="unit"><span class="v">{pad(p.seconds)}</span><span class="l">sec</span></div>
      </div>
      <div class="clock-band" aria-label={`Band ${ymd(lo)} to ${ymd(hi)}`}>
        <div class="band-track">
          <div class="band-range" style={{ left: pos(lo.getTime()), width: `calc(${pos(hi.getTime())} - ${pos(lo.getTime())})` }} />
          <div class="band-point" style={{ left: pos(targetMs) }} />
        </div>
        <div class="band-axis"><span>{asOf}</span><span>band {ymd(lo)} → {ymd(hi)}</span><span>2034</span></div>
      </div>
      <div class="clock-meta">
        <span>readiness <b>{readiness.toFixed(1)}</b></span>
        <span>confidence <b>{Math.round(confidence * 100)}%</b></span>
        <span>band <b>±{bandMonths} mo</b></span>
        <a href={methodHref}>how this is computed</a>
        <SourceCite href={citeHref} name={`snapshot ${asOf}`} />
      </div>
    </div>
  );
}
