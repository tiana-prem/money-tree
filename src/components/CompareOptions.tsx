import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Award, Check, X } from 'lucide-react';
import type { FinancialGoal } from '../engine/types';
import { OptionResult, bestOption } from '../engine/scenario';
import { installmentPayment } from '../engine/projection';
import { ChartTooltip, MathToggle } from './ui';
import { describeDays, diffDays, fmtDate, fmtMonth } from '../lib/dates';
import { money } from '../lib/money';

/** Validated categorical order (see dataviz palette check) — options keep their color as the list changes. */
const OPTION_COLORS = ['#3987e5', '#d95926', '#199e70', '#9085e9'];

type Better = 'lower' | 'higher';
interface Row { label: string; values: number[]; fmt: (v: number, i: number) => string; better: Better; note?: string }

export function CompareOptions({ options, goals, horizon, onChoose, onRemove }: {
  options: OptionResult[]; goals: FinancialGoal[]; horizon: number; onChoose: (id: string) => void; onRemove: (id: string) => void;
}) {
  const shown = options.slice(0, 4);
  const best = bestOption(shown)!;
  const color = (i: number) => OPTION_COLORS[i % OPTION_COLORS.length];
  const goalOrder = shown[0].cmp.goalImpacts.map((g) => g.goalId);
  const goalName = (id: string) => goals.find((g) => g.id === id)?.name ?? 'Goal';

  const monthlyCost = (o: OptionResult) =>
    o.item.recurrence ? o.cmp.monthlyRecurringCost
      : o.item.payment.type === 'installments' ? installmentPayment(o.item.price, o.item.payment.months, o.item.payment.aprPercent) : 0;

  const rows: Row[] = [
    { label: 'Price', values: shown.map((o) => o.item.price), fmt: (v, i) => `${money(v)}${shown[i].item.recurrence ? ` / ${shown[i].item.recurrence!.interval.replace('ly', '')}` : ''}`, better: 'lower' },
    { label: `Total paid in ${horizon} months`, values: shown.map((o) => o.cmp.totalCostInHorizon), fmt: (v) => money(v), better: 'lower' },
    ...(shown.some((o) => monthlyCost(o) > 0) ? [{ label: 'Monthly payment', values: shown.map(monthlyCost), fmt: (v: number) => (v ? money(v) : '—'), better: 'lower' as Better }] : []),
    { label: 'Safe to spend this month', values: shown.map((o) => o.cmp.safeAfter.safeToSpend), fmt: (v) => money(v), better: 'higher' },
    ...(shown[0].cmp.emergency ? [{ label: `Emergency fund, end of ${fmtMonth(shown[0].cmp.emergency.atMonth, { short: true })}`, values: shown.map((o) => o.cmp.emergency!.after), fmt: (v: number) => `${money(v)} (${Math.round((v / shown[0].cmp.emergency!.target) * 100)}%)`, better: 'higher' as Better }] : []),
    { label: `Total saved in ${horizon} months`, values: shown.map((o) => o.cmp.savingsAtHorizon.after), fmt: (v) => money(v), better: 'higher' },
    { label: 'Total goal delay', values: shown.map((o) => o.totalDelayDays), fmt: (v, i) => (shown[i].goalsPushedBeyond ? `${v} days + ${shown[i].goalsPushedBeyond} beyond 5 yrs` : v === 0 ? 'None' : `${v} days`), better: 'lower' },
  ];

  // Chart: delay in days for each goal, one bar per option.
  const chartData = goalOrder.map((gid) => {
    const row: Record<string, string | number> = { goal: goalName(gid) };
    shown.forEach((o) => { row[o.item.id] = Math.max(0, o.cmp.goalImpacts.find((g) => g.goalId === gid)?.delayDays ?? 0); });
    return row;
  });
  const anyDelay = chartData.some((r) => shown.some((o) => (r[o.item.id] as number) > 0));

  return (
    <div className="stack">
      <Differences shown={shown} best={best} goalName={goalName} />

      <div className="table-wrap">
        <table className="table compare-table">
          <thead>
            <tr>
              <th />
              {shown.map((o, i) => (
                <th key={o.item.id} className="r">
                  <div className="row" style={{ justifyContent: 'flex-end', gap: 6 }}>
                    <span className="swatch" style={{ background: color(i) }} />
                    <span style={{ color: 'var(--text)', whiteSpace: 'normal' }}>{o.item.customName}</span>
                  </div>
                  <div className="tiny faint" style={{ fontWeight: 500 }}>{fmtDate(o.item.plannedDate, { year: false })}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const target = r.better === 'lower' ? Math.min(...r.values) : Math.max(...r.values);
              const allSame = r.values.every((v) => v === r.values[0]);
              return (
                <tr key={r.label}>
                  <td className="muted">{r.label}</td>
                  {r.values.map((v, i) => (
                    <td key={i} className={`r ${!allSame && v === target ? 'win' : ''}`}>{r.fmt(v, i)}</td>
                  ))}
                </tr>
              );
            })}
            {goalOrder.map((gid) => (
              <tr key={gid}>
                <td className="muted">{goalName(gid)} done</td>
                {shown.map((o) => {
                  const g = o.cmp.goalImpacts.find((x) => x.goalId === gid)!;
                  const dates = shown.map((s) => s.cmp.goalImpacts.find((x) => x.goalId === gid)!.scenarioDate ?? '9999');
                  const earliest = dates.reduce((a, b) => (a < b ? a : b));
                  const win = !dates.every((dd) => dd === dates[0]) && (g.scenarioDate ?? '9999') === earliest;
                  return (
                    <td key={o.item.id} className={`r ${win ? 'win' : ''}`}>
                      {g.scenarioDate ? fmtDate(g.scenarioDate) : 'Beyond 5 yrs'}
                      <div className="tiny faint">{g.kind === 'delayed' ? `${describeDays(g.delayDays!)} later` : g.kind === 'pushed_beyond' ? 'pushed out' : 'no change'}</div>
                    </td>
                  );
                })}
              </tr>
            ))}
            <tr>
              <td />
              {shown.map((o) => (
                <td key={o.item.id} className="r">
                  <div className="row" style={{ justifyContent: 'flex-end', gap: 4 }}>
                    {o.item.included && shown.filter((s) => s.item.included).length === 1
                      ? <span className="badge badge-primary"><Check size={12} /> Chosen</span>
                      : <button className="btn btn-soft btn-sm" onClick={() => onChoose(o.item.id)}>Choose</button>}
                    <button className="btn btn-ghost btn-icon btn-sm" aria-label={`Remove ${o.item.customName}`} onClick={() => onRemove(o.item.id)}><X size={14} /></button>
                  </div>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      <div className="tiny muted">Green marks the better value in each row. Each option is projected on its own, as if it were the only purchase.</div>

      {anyDelay ? (
        <div>
          <div className="small strong">How long each option delays your goals</div>
          <div className="chart-wrap" style={{ height: 70 + chartData.length * 26 * Math.max(2, shown.length) }}>
            <ResponsiveContainer>
              <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }} barGap={2} barCategoryGap="22%">
                <CartesianGrid horizontal={false} stroke="var(--c-grid)" />
                <XAxis type="number" tick={{ fontSize: 12, fill: '#7c8697' }} tickLine={false} axisLine={false} unit=" d" allowDecimals={false} />
                <YAxis type="category" dataKey="goal" tick={{ fontSize: 12, fill: '#aab2be' }} tickLine={false} axisLine={false} width={130} />
                <Tooltip cursor={{ fill: 'rgba(0,0,0,0.04)' }} content={<ChartTooltip formatter={(v: number) => (v === 0 ? 'No delay' : `${v} days later`)} />} />
                <Legend iconType="square" iconSize={10} wrapperStyle={{ fontSize: 12 }} />
                {shown.map((o, i) => <Bar key={o.item.id} dataKey={o.item.id} name={o.item.customName} fill={color(i)} radius={[0, 4, 4, 0]} />)}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : <div className="callout good"><div>None of these options delays any of your goals.</div></div>}

      <MathToggle label="How options are compared">
        <p>Each option runs through the same month-by-month projection on its own, against your current plan. A goal's delay is the option's completion date minus the date without any purchase.</p>
        <div className="formula">{`Best overall = fewest goals pushed past 5 years, then least total delay, then lowest cost
Total goal delay = sum of each goal's delay in days`}</div>
      </MathToggle>
    </div>
  );
}

/** Plain-language differences between the best option and each of the others. */
function Differences({ shown, best, goalName }: { shown: OptionResult[]; best: OptionResult; goalName: (id: string) => string }) {
  const others = shown.filter((o) => o !== best);
  return (
    <div className="callout good" style={{ alignItems: 'flex-start' }}>
      <Award size={17} />
      <div className="stack-sm">
        <div><strong>{best.item.customName}</strong> is easiest on your goals{best.totalDelayDays === 0 && !best.goalsPushedBeyond ? ': it delays none of them.' : '.'}</div>
        {others.map((o) => {
          const costDiff = o.cmp.totalCostInHorizon - best.cmp.totalCostInHorizon;
          // The goal where the two options differ most.
          let top: { name: string; days: number } | null = null;
          for (const g of best.cmp.goalImpacts) {
            const og = o.cmp.goalImpacts.find((x) => x.goalId === g.goalId)!;
            if (!g.scenarioDate || !og.scenarioDate) continue;
            const days = diffDays(og.scenarioDate, g.scenarioDate);
            if (!top || days > top.days) top = { name: goalName(g.goalId), days };
          }
          const safeDiff = best.cmp.safeAfter.safeToSpend - o.cmp.safeAfter.safeToSpend;
          const parts = [
            costDiff > 0 ? `costs ${money(costDiff)} less` : costDiff < 0 ? `costs ${money(-costDiff)} more` : 'costs the same',
            top && top.days > 0 ? `finishes your ${top.name.toLowerCase()} ${describeDays(top.days)} sooner` : null,
            safeDiff > 0 ? `leaves ${money(safeDiff)} more to spend this month` : null,
          ].filter(Boolean);
          return <div key={o.item.id} className="small">Compared with {o.item.customName}, it {parts.join(', ')}.</div>;
        })}
      </div>
    </div>
  );
}
