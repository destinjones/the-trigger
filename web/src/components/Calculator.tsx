import { useState } from 'preact/hooks';
import SourceCite from './SourceCite.tsx';
import { householdPerYear, type Plan, type Population } from '../../../index/payouts.ts';

/**
 * Household size in, dollars per month out, for every plan in
 * sources/curated/payouts.yaml. Plans and population arrive as props from the
 * build, so the page can never disagree with the committed data. The first
 * render uses the default household, so the static HTML is already useful
 * before (or without) JavaScript.
 */
export interface CalcPlan {
  plan: Plan;
  status: string;
  basis: string;
  sourceName: string;
  sourceUrl: string;
}
export interface CalculatorProps {
  plans: CalcPlan[];
  population: Population;
}

const usd = (v: number) => (v >= 100 ? `$${Math.round(v).toLocaleString('en-US')}` : `$${v.toFixed(2)}`);

function Stepper({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <div class="stepper">
      <span class="stepper-label">{label}</span>
      <button type="button" aria-label={`Fewer ${label}`} disabled={value <= min} onClick={() => onChange(value - 1)}>−</button>
      <span class="stepper-value num" aria-live="polite">{value}</span>
      <button type="button" aria-label={`More ${label}`} disabled={value >= max} onClick={() => onChange(value + 1)}>+</button>
    </div>
  );
}

export default function Calculator({ plans, population }: CalculatorProps) {
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const h = { adults, children };
  return (
    <div class="calc">
      <div class="calc-inputs">
        <Stepper label="adults" value={adults} min={1} max={8} onChange={setAdults} />
        <Stepper label="children" value={children} min={0} max={8} onChange={setChildren} />
      </div>
      <div class="table-wrap">
        <table class="table calc-table">
          <thead><tr><th>Plan</th><th>Your household, per month</th><th>Per year</th><th>Source</th></tr></thead>
          <tbody>
            {plans.map(({ plan, status, basis, sourceName, sourceUrl }) => {
              const year = householdPerYear(plan, population, h);
              return (
                <tr key={plan.id}>
                  <td>
                    <div class="bill-title">{plan.name}</div>
                    <div class="muted small">{status}. {basis}.</div>
                  </td>
                  <td class="num calc-month">{plan.recurring ? usd(year / 12) : '—'}</td>
                  <td class={`num${plan.recurring ? ' calc-year' : ''}`}>{usd(year)}{plan.recurring ? '' : ' once'}</td>
                  <td><SourceCite href={sourceUrl} name={sourceName} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
