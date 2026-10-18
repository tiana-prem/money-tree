import { useState } from 'react';
import { Area, Bar, BarChart, CartesianGrid, ComposedChart, Legend, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { ProjectionResult } from '../engine/types';
import type { PlanSummary } from '../engine/plan';
import { ChartTooltip } from './ui';
import { fmtMonth } from '../lib/dates';
import { money, moneyShort } from '../lib/money';

const AXIS = { fontSize: 12, fill: '#868c86' };

/** Stacked allocation of monthly take-home pay. Every segment is read from the plan summary. */
export function AllocationBar({ s }: { s: PlanSummary }) {
  const parts = [
    { key: 'Essentials', v: s.essentials, c: 'var(--c-essentials)' },
    { key: 'Discretionary', v: s.discretionary + s.recurringCommitments, c: 'var(--c-discretionary)' },
    { key: 'Goal savings', v: s.plannedSavings, c: 'var(--c-savings)' },
    { key: 'Debt payments', v: s.debtPayments, c: 'var(--c-debt)' },
    { key: 'Unassigned', v: Math.max(0, s.unallocated), c: 'var(--c-unallocated)' },
  ].filter((p) => p.v > 0);
  const total = parts.reduce((a, p) => a + p.v, 0);
  return (
    <div>
      <div className="alloc-bar" role="img" aria-label={`Monthly allocation: ${parts.map((p) => `${p.key} ${money(p.v)}`).join(', ')}`}>
        {parts.map((p) => <div key={p.key} title={`${p.key}: ${money(p.v)}`} style={{ flexBasis: `${(p.v / total) * 100}%`, background: p.c }} />)}
      </div>
      <div className="legend mt-12">
        {parts.map((p) => <span key={p.key}><span className="swatch" style={{ background: p.c }} />{p.key} <strong className="num" style={{ color: 'var(--text)' }}>{money(p.v)}</strong> <span className="faint">{Math.round((p.v / s.monthlyNet) * 100)}%</span></span>)}
      </div>
      {s.overAllocated && <div className="small neg mt-8">Planned outflows exceed take-home pay by {money(-s.unallocated)} per month.</div>}
    </div>
  );
}

/** Monthly cash-flow chart: one stacked bar per month from the projection snapshots. */
export function CashFlowChart({ proj, months }: { proj: ProjectionResult; months: number }) {
  const data = proj.snapshots.slice(1, months + 1).map((s) => ({
    month: s.monthKey,
    Essentials: s.essentials / 100,
    Discretionary: (s.discretionary + s.purchases + s.recurring) / 100,
    'Goal savings': Object.values(s.contributions).reduce((a, b) => a + b, 0) / 100,
    'Debt payments': s.debtPaid / 100,
    'Kept in checking': Math.max(0, s.income - s.essentials - s.discretionary - s.purchases - s.recurring - s.debtPaid - Object.values(s.contributions).reduce((a, b) => a + b, 0)) / 100,
  }));
  return (
    <div className="chart-wrap sm">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap="22%">
          <CartesianGrid vertical={false} stroke="var(--c-grid)" />
          <XAxis dataKey="month" tick={AXIS} tickLine={false} axisLine={false} tickFormatter={(m) => fmtMonth(m, { short: true })} interval="preserveStartEnd" minTickGap={12} />
          <YAxis tick={AXIS} tickLine={false} axisLine={false} tickFormatter={(v) => moneyShort(v * 100)} width={52} />
          <Tooltip cursor={{ fill: 'rgba(0,0,0,0.04)' }} content={<ChartTooltip formatter={(v: number) => money(v * 100)} labelFormatter={(m: string) => fmtMonth(m)} />} />
          <Bar dataKey="Essentials" stackId="a" fill="var(--c-essentials)" stroke="#fff" strokeWidth={1} />
          <Bar dataKey="Discretionary" stackId="a" fill="var(--c-discretionary)" stroke="#fff" strokeWidth={1} />
          <Bar dataKey="Goal savings" stackId="a" fill="var(--c-savings)" stroke="#fff" strokeWidth={1} />
          <Bar dataKey="Debt payments" stackId="a" fill="var(--c-debt)" stroke="#fff" strokeWidth={1} />
          <Bar dataKey="Kept in checking" stackId="a" fill="var(--c-unallocated)" stroke="#fff" strokeWidth={1} radius={[4, 4, 0, 0]} />
          <Legend iconType="square" iconSize={10} wrapperStyle={{ fontSize: 12, paddingTop: 6 }} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

type Series = 'savings' | 'cash' | 'debt';
const SERIES: Record<Series, { label: string; color: string; key: keyof ProjectionResult['snapshots'][number] }> = {
  savings: { label: 'Savings', color: 'var(--c-savings)', key: 'projectedSavings' },
  cash: { label: 'Checking', color: 'var(--c-essentials)', key: 'projectedCash' },
  debt: { label: 'Debt', color: 'var(--c-debt)', key: 'projectedDebt' },
};

/** Baseline (solid) vs scenario (dashed) projection, one shared dollar axis. */
export function ProjectionChart({ baseline, scenario, months, buffer, height = 300, initial = ['savings', 'cash'] }: { baseline: ProjectionResult; scenario?: ProjectionResult | null; months: number; buffer?: number; height?: number; initial?: Series[] }) {
  const [shown, setShown] = useState<Series[]>(initial);
  const data = baseline.snapshots.slice(0, months + 1).map((b, i) => {
    const row: Record<string, number | string> = { month: b.monthKey };
    for (const k of Object.keys(SERIES) as Series[]) {
      row[k] = (b[SERIES[k].key] as number) / 100;
      if (scenario) row[`${k}_s`] = (scenario.snapshots[i][SERIES[k].key] as number) / 100;
    }
    return row;
  });
  const toggle = (k: Series) => setShown(shown.includes(k) ? shown.filter((x) => x !== k) : [...shown, k]);
  return (
    <div>
      <div className="row wrap" style={{ gap: 8, marginBottom: 8 }}>
        {(Object.keys(SERIES) as Series[]).map((k) => (
          <button key={k} className="chip" aria-pressed={shown.includes(k)} onClick={() => toggle(k)} style={shown.includes(k) ? { background: 'var(--surface)', color: 'var(--text)', borderColor: SERIES[k].color, borderWidth: 2 } : undefined}>
            <span className="swatch" style={{ background: SERIES[k].color, marginRight: 6 }} />{SERIES[k].label}
          </button>
        ))}
        {scenario && <span className="legend small" style={{ marginLeft: 'auto' }}><span><span className="swatch line" style={{ background: 'var(--text-2)' }} />Current plan</span><span style={{ color: 'var(--text-2)' }}><span className="swatch dash" />With scenario</span></span>}
      </div>
      <div className="chart-wrap" style={{ height }}>
        <ResponsiveContainer>
          <ComposedChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--c-grid)" />
            <XAxis dataKey="month" tick={AXIS} tickLine={false} axisLine={false} tickFormatter={(m) => fmtMonth(m, { short: true })} minTickGap={16} />
            <YAxis tick={AXIS} tickLine={false} axisLine={false} tickFormatter={(v) => moneyShort(v * 100)} width={56} />
            <Tooltip content={<ChartTooltip formatter={(v: number) => money(v * 100)} labelFormatter={(m: string) => `End of ${fmtMonth(m)}`} />} />
            {buffer !== undefined && shown.includes('cash') && <ReferenceLine y={buffer / 100} stroke="#b9b6ab" strokeDasharray="2 4" label={{ value: 'Cash buffer', fontSize: 11, fill: '#868c86', position: 'insideTopLeft' }} />}
            <ReferenceLine y={0} stroke="#cfccc2" />
            {shown.map((k) => (
              <Area key={k} type="monotone" dataKey={k} name={`${SERIES[k].label}${scenario ? ' (current plan)' : ''}`} stroke={SERIES[k].color} strokeWidth={2} fill={SERIES[k].color} fillOpacity={0.06} dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: '#fff' }} isAnimationActive animationDuration={500} />
            ))}
            {scenario && shown.map((k) => (
              <Line key={`${k}_s`} type="monotone" dataKey={`${k}_s`} name={`${SERIES[k].label} (with scenario)`} stroke={SERIES[k].color} strokeWidth={2} strokeDasharray="6 4" dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: '#fff' }} isAnimationActive animationDuration={500} />
            ))}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
