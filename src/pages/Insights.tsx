import { useMemo, useState } from 'react';
import { AlertTriangle, ArrowDownRight, ArrowUpRight, Check, Lightbulb, PiggyBank, RotateCcw, Target, X } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useStore } from '../state/store';
import { useData, useDerived } from '../state/hooks';
import { Callout, Card, ChartTooltip, ConfirmDialog, KV, MathToggle, Progress } from '../components/ui';
import { CATEGORY_LABEL, Recommendation, buildRecommendations, deprioritizedCategories } from '../insights/recommendations';
import { applyRecommendation } from '../insights/applyRec';
import { actualsByMonth, buildReportCard } from '../engine/forecast';
import { addDays, addMonths, fmtDate, fmtMonth, monthKey, startOfMonth } from '../lib/dates';
import { money, moneyShort } from '../lib/money';
import { matchPercent } from '../engine/match';

const AXIS = { fontSize: 12, fill: '#868c86' };

export function InsightsPage() {
  const d = useData();
  const x = useDerived();
  const st = useStore();
  const [showClosed, setShowClosed] = useState(false);
  const [confirm, setConfirm] = useState<Recommendation | null>(null);
  const recs = useMemo(() => buildRecommendations(d, x), [d, x]);
  const open = recs.filter((r) => !d.recommendationFeedback[r.id]);
  const closed = recs.filter((r) => d.recommendationFeedback[r.id]);
  const lowered = deprioritizedCategories(d);
  const lines = [...d.plan.essentialExpenses, ...d.plan.discretionaryBudgets];
  const rc = useMemo(() => buildReportCard(d.forecastSnapshots, d.transactions, lines, monthKey(x.today)), [d, x]); // eslint-disable-line react-hooks/exhaustive-deps

  const actual = useMemo(() => actualsByMonth(d.transactions), [d.transactions]);
  const lastMonth = monthKey(addMonths(startOfMonth(x.today), -1));
  const prevMonth = monthKey(addMonths(startOfMonth(x.today), -2));
  const hasHistory = !!actual[lastMonth];
  const plannedVsActual = lines.map((l) => ({ name: l.label, Planned: l.amount / 100, Actual: (actual[lastMonth]?.byLine[l.id] ?? 0) / 100, over: (actual[lastMonth]?.byLine[l.id] ?? 0) > l.amount }));
  const mom = lines.map((l) => {
    const a = actual[lastMonth]?.byLine[l.id] ?? 0;
    const b = actual[prevMonth]?.byLine[l.id] ?? 0;
    return { label: l.label, last: a, prev: b, delta: a - b };
  }).sort((p, q) => Math.abs(q.delta) - Math.abs(p.delta));
  const income = (k: string) => d.transactions.filter((t) => t.transactionType === 'income' && monthKey(t.date) === k).reduce((s, t) => s + t.amount, 0);
  const actualSavingsRate = hasHistory && income(lastMonth) > 0 ? actual[lastMonth].savings / income(lastMonth) : null;

  const upcoming = useMemo(() => {
    const out: { date: string; label: string; amount: number }[] = [];
    for (let i = 1; i <= 14; i++) {
      const dt = addDays(x.today, i);
      const day = Number(dt.slice(8));
      for (const l of d.plan.essentialExpenses) if (l.dueDay === day) out.push({ date: dt, label: l.label, amount: l.amount });
      for (const a of d.accounts) if (a.accountRole === 'liability' && a.dueDay === day && a.balance > 0) out.push({ date: dt, label: `${a.name} payment`, amount: a.plannedPayment ?? 0 });
      for (const p of d.plan.plannedPurchases) if (p.date === dt) out.push({ date: dt, label: p.label, amount: p.amount });
    }
    return out;
  }, [d, x.today]);
  const bufferMonths = x.baseline.snapshots.slice(0, d.profile.planningPreferences.horizonMonths + 1).filter((s) => s.belowBuffer);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Insights</h1>
          <p>Guidance calculated from your own numbers. Every recommendation shows its reasoning and math.</p>
        </div>
      </div>

      {/* B. Recommendations */}
      <Card title="Recommendations" subtitle={`${open.length} open · sorted by estimated importance`} action={closed.length > 0 && <button className="link-btn" onClick={() => setShowClosed(!showClosed)}>{showClosed ? 'Hide' : 'Show'} reviewed ({closed.length})</button>}>
        {lowered.length > 0 && <Callout tone="plain"><strong>Preference-based personalization:</strong> you dismissed several {lowered.map((c) => CATEGORY_LABEL[c].toLowerCase()).join(' and ')} suggestions, so those now rank lower. This is a simple rule based on your choices, not a learning model.</Callout>}
        <div className="stack mt-12">
          {open.map((r) => <RecCard key={r.id} r={r} onAccept={() => r.action?.kind === 'navigate' ? applyRecommendation(r) : setConfirm(r)} onDismiss={() => { st.setRecFeedback(r.id, { status: 'dismissed', category: r.category }); st.toast('Dismissed. Clover will rank similar suggestions lower if you keep dismissing them.', 'info'); }} />)}
          {open.length === 0 && <div className="empty"><div className="icon-chip green"><Check size={18} /></div>No open recommendations right now.</div>}
          {showClosed && closed.map((r) => (
            <div key={r.id} className="row-between" style={{ padding: '10px 0', borderTop: '1px solid var(--border)' }}>
              <div><div className="strong" style={{ opacity: 0.7 }}>{r.title}</div><div className="tiny muted">{d.recommendationFeedback[r.id].status === 'accepted' ? 'Accepted' : 'Dismissed'} on {fmtDate(d.recommendationFeedback[r.id].updatedAt)}</div></div>
              <button className="btn btn-ghost btn-sm" onClick={() => st.clearRecFeedback(r.id)}><RotateCcw size={13} /> Reopen</button>
            </div>
          ))}
        </div>
      </Card>

      {/* A. Spending insights */}
      <div className="grid g-main mt-16">
        <Card title={`Planned vs. actual — ${fmtMonth(lastMonth)}`} subtitle={d.profile.dataSource !== 'manual' ? 'Actuals from simulated demo transactions' : 'Actuals from recorded transactions'}>
          {hasHistory ? (
            <>
              <div className="chart-wrap" style={{ height: 300 }}>
                <ResponsiveContainer>
                  <BarChart data={plannedVsActual} layout="vertical" margin={{ top: 0, right: 12, left: 8, bottom: 0 }} barGap={2} barCategoryGap="28%">
                    <CartesianGrid horizontal={false} stroke="var(--c-grid)" />
                    <XAxis type="number" tick={AXIS} tickLine={false} axisLine={false} tickFormatter={(v) => moneyShort(v * 100)} />
                    <YAxis type="category" dataKey="name" tick={AXIS} tickLine={false} axisLine={false} width={150} />
                    <Tooltip cursor={{ fill: 'rgba(0,0,0,0.04)' }} content={<ChartTooltip formatter={(v: number) => money(v * 100)} />} />
                    <Legend iconType="square" iconSize={10} wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="Planned" fill="#cfccc2" radius={[0, 4, 4, 0]} />
                    <Bar dataKey="Actual" radius={[0, 4, 4, 0]}>
                      {plannedVsActual.map((p) => <Cell key={p.name} fill={p.over ? 'var(--c-discretionary)' : 'var(--c-essentials)'} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="legend"><span><span className="swatch" style={{ background: 'var(--c-essentials)' }} />Actual within plan</span><span><span className="swatch" style={{ background: 'var(--c-discretionary)' }} />Actual over plan</span></div>
            </>
          ) : <div className="empty">No transaction history yet. Planned vs. actual appears once transactions are available.</div>}
        </Card>
        <div className="stack">
          <Card title="Savings rate">
            <div className="grid g-2">
              <div><div className="metric-label">Planned</div><div className="metric">{Math.round(x.summary.savingsRate * 100)}%</div><div className="tiny muted">{money(x.summary.plannedSavings)} of {money(x.summary.monthlyNet)}</div></div>
              <div><div className="metric-label">Actual, {fmtMonth(lastMonth, { short: true })}</div><div className="metric">{actualSavingsRate !== null ? `${Math.round(actualSavingsRate * 100)}%` : '—'}</div><div className="tiny muted">transfers ÷ take-home</div></div>
            </div>
            <p className="tiny muted mt-8">Excludes pre-tax 401(k) contributions{x.match ? `, which add ${d.paystub!.employeeRetirementPercent}% of gross pay plus a ${x.match.matchPercentNow}% employer match` : ''}.</p>
          </Card>
          <Card title="Goal progress">
            {x.sortedGoalIds.map((id) => { const g = d.goals.find((gg) => gg.id === id)!; const a = x.goalAnalyses[id]; return (
              <div key={id} className="mt-8"><div className="row-between small"><span className="strong">{g.name}</span><span className="muted">{Math.round(a.percent * 100)}%</span></div><div className="mt-8"><Progress value={a.percent} label={g.name} /></div></div>
            ); })}
            {d.goals.length === 0 && <div className="small muted">No goals yet.</div>}
          </Card>
        </div>
      </div>

      <div className="grid g-2 mt-16">
        <Card title="Changes from the prior month" subtitle={`${fmtMonth(prevMonth)} → ${fmtMonth(lastMonth)}`}>
          {hasHistory ? (
            <div className="table-wrap"><table className="table">
              <thead><tr><th>Category</th><th className="r">{fmtMonth(prevMonth, { short: true })}</th><th className="r">{fmtMonth(lastMonth, { short: true })}</th><th className="r">Change</th></tr></thead>
              <tbody>{mom.slice(0, 7).map((m) => (
                <tr key={m.label}><td>{m.label}</td><td className="r">{money(m.prev)}</td><td className="r">{money(m.last)}</td>
                  <td className={`r strong ${m.delta > 0 ? 'neg' : m.delta < 0 ? 'pos' : ''}`}>{m.delta > 0 ? <ArrowUpRight size={12} /> : m.delta < 0 ? <ArrowDownRight size={12} /> : null} {money(Math.abs(m.delta))}</td></tr>
              ))}</tbody>
            </table></div>
          ) : <div className="small muted">Needs two months of transactions.</div>}
        </Card>
        <Card title="Upcoming cash-flow constraints" subtitle="Next 14 days, plus months the projection dips below your buffer">
          {upcoming.length === 0 ? <div className="small muted">Nothing scheduled in the next two weeks.</div> : upcoming.map((u, i) => <KV key={i} k={`${fmtDate(u.date, { year: false })} · ${u.label}`} v={money(u.amount)} />)}
          <div className="mt-12">
            {bufferMonths.length === 0
              ? <Callout tone="good">Checking stays at or above your {money(d.plan.cashBuffer)} buffer in every projected month.</Callout>
              : <Callout tone="warn" icon={<AlertTriangle size={17} />}>Checking is projected below your buffer in {bufferMonths.map((s) => fmtMonth(s.monthKey, { short: true })).join(', ')}.</Callout>}
          </div>
        </Card>
      </div>

      {/* C. Employer match */}
      <Card className="mt-16" title="Employer 401(k) match" subtitle="Based on the match policy on your paystub">
        {x.match && d.paystub ? (
          <div className="grid g-2">
            <div>
              <KV k="Your contribution" v={`${x.match.employeePercent}% of pay`} />
              <KV k="Match policy" v={x.match.policy.description} />
              <KV k="Employer match now" v={`${x.match.matchPercentNow}% · ${money(x.match.annualMatchNow)}/yr`} />
              <KV k="Maximum available" v={`${x.match.maxMatch}% · ${money(x.match.annualMatchMax)}/yr`} />
              <KV k="Unclaimed per year" v={<span className={x.match.missedAnnual > 0 ? 'neg' : 'pos'}>{money(x.match.missedAnnual)}</span>} total />
            </div>
            <div className="stack-sm">
              <div className="small strong">Match at each contribution level</div>
              <div className="table-wrap"><table className="table">
                <thead><tr><th>You contribute</th><th className="r">Employer adds</th><th className="r">Per year</th></tr></thead>
                <tbody>{[2, 3, 4, 5, 6].map((p) => { const m = matchPercent(x.match!.policy, p); return <tr key={p} className={p === x.match!.employeePercent ? 'hl' : ''}><td>{p}%{p === x.match!.employeePercent ? ' (you)' : ''}</td><td className="r">{m}%</td><td className="r">{money(Math.round((x.match!.annualGross * m) / 100))}</td></tr>; })}</tbody>
              </table></div>
              <Callout tone="plain" icon={<PiggyBank size={17} />}>401(k) money is for retirement. It is not available cash — early withdrawals can trigger taxes and penalties{d.paystub.employerMatchPolicy?.vestingNote ? `, and ${d.paystub.employerMatchPolicy.vestingNote.charAt(0).toLowerCase()}${d.paystub.employerMatchPolicy.vestingNote.slice(1)}` : '.'}</Callout>
            </div>
          </div>
        ) : <div className="small muted">No employer match policy on file. Add a paystub on the Plan tab to see match guidance. Clover doesn't assume every employer offers the same match.</div>}
      </Card>

      {/* D. Forecast report card */}
      <Card className="mt-16" title="Forecast report card" subtitle="How well past plans predicted what actually happened" action={<span className="badge badge-outline">Synthetic history</span>}>
        {rc.rows.length === 0 ? <div className="small muted">Forecast history builds up after your first full month with Clover.</div> : (
          <>
            <div className="grid g-4">
              <div><div className="metric-label">Spending MAE</div><div className="metric">{money(rc.maeSpending)}</div><div className="tiny muted">per month, {rc.rows.length} months</div></div>
              <div><div className="metric-label">Spending MAPE</div><div className="metric">{(rc.mapeSpending * 100).toFixed(1)}%</div><div className="tiny muted">mean absolute % error</div></div>
              <div><div className="metric-label">Savings MAE</div><div className="metric">{money(rc.maeSavings)}</div><div className="tiny muted">per month</div></div>
              <div><div className="metric-label">Latest month</div><div className="metric">{rc.latest ? money(rc.latest.spendingError, { sign: true }) : '—'}</div><div className="tiny muted">actual − predicted spending</div></div>
            </div>
            <div className="grid g-2 mt-16">
              <div>
                <div className="small strong">Forecast error by month (absolute, spending and savings)</div>
                <div className="chart-wrap sm mt-8">
                  <ResponsiveContainer>
                    <BarChart data={rc.rows.map((r) => ({ m: r.monthKey, Spending: Math.abs(r.spendingError) / 100, Savings: Math.abs(r.savingsError) / 100 }))} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={2}>
                      <CartesianGrid vertical={false} stroke="var(--c-grid)" />
                      <XAxis dataKey="m" tick={AXIS} tickLine={false} axisLine={false} tickFormatter={(m) => fmtMonth(m, { short: true })} />
                      <YAxis tick={AXIS} tickLine={false} axisLine={false} tickFormatter={(v) => moneyShort(v * 100)} width={48} />
                      <Tooltip cursor={{ fill: 'rgba(0,0,0,0.04)' }} content={<ChartTooltip formatter={(v: number) => money(v * 100)} labelFormatter={(m: string) => fmtMonth(m)} />} />
                      <Legend iconType="square" iconSize={10} wrapperStyle={{ fontSize: 12 }} />
                      <Bar dataKey="Spending" fill="var(--c-essentials)" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Savings" fill="var(--c-savings)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div>
                <div className="small strong">Biggest differences in {rc.latest ? fmtMonth(rc.latest.monthKey) : ''}</div>
                {rc.latestDiffs.map((l) => (
                  <div key={l.lineId} className="kv"><span className="k">{l.label}<div className="tiny faint">{explainDiff(l)}</div></span><span className={`v ${l.diff > 0 ? 'neg' : 'pos'}`}>{money(l.diff, { sign: true })}</span></div>
                ))}
                {rc.suggestions.length > 0 && <Callout tone="info">Updated assumption suggested: {rc.suggestions.map((s) => `${s.label} ${money(s.current)} → ${money(s.suggested)}`).join(', ')}. See Recommendations above to accept it.</Callout>}
              </div>
            </div>
            <details className="mt-16">
              <summary className="link-btn">Month-by-month table</summary>
              <div className="table-wrap mt-8"><table className="table">
                <thead><tr><th>Month</th><th className="r">Predicted spend</th><th className="r">Actual spend</th><th className="r">Error</th><th className="r">Predicted saved</th><th className="r">Actual saved</th><th className="r">Error</th></tr></thead>
                <tbody>{rc.rows.map((r) => <tr key={r.monthKey}><td>{fmtMonth(r.monthKey)}</td><td className="r">{money(r.predictedSpending)}</td><td className="r">{money(r.actualSpending)}</td><td className="r">{money(r.spendingError, { sign: true })}</td><td className="r">{money(r.predictedSavings)}</td><td className="r">{money(r.actualSavings)}</td><td className="r">{money(r.savingsError, { sign: true })}</td></tr>)}</tbody>
              </table></div>
            </details>
            <MathToggle label="How accuracy is measured">
              <div className="formula">{`Error (month) = actual − predicted, compared for the same calendar month and quantity
MAE = mean(|error|) over ${rc.rows.length} completed months
MAPE = mean(|error| ÷ actual)`}</div>
              <p className="muted">Predicted values are the plan in effect at the start of each month (the groceries budget was raised three months ago). Spending = essential + discretionary expenses; savings = transfers to savings. The current partial month is excluded. History is synthetic demo data, and past accuracy does not guarantee future accuracy.</p>
            </MathToggle>
          </>
        )}
      </Card>

      <ConfirmDialog open={!!confirm} title="Apply this recommendation?"
        body={confirm && <div className="stack-sm"><div className="strong" style={{ color: 'var(--text)' }}>{confirm.actionLabel}</div><div>{confirm.impact}.</div><div className="small">This updates your plan inputs. Projections, goals and safe-to-spend recalculate immediately. You can change it back on the Plan tab.</div></div>}
        confirmLabel="Apply" onCancel={() => setConfirm(null)} onConfirm={() => { if (confirm) applyRecommendation(confirm); setConfirm(null); }} />
    </div>
  );
}

function explainDiff(l: { diff: number; count: number; largest: number; predicted: number }) {
  if (l.diff > 0) return `${l.count} transactions; largest ${money(l.largest)}. Ran over the ${money(l.predicted)} estimate.`;
  if (l.diff < 0) return `Came in under the ${money(l.predicted)} estimate.`;
  return 'Matched the plan.';
}

function RecCard({ r, onAccept, onDismiss }: { r: Recommendation; onAccept: () => void; onDismiss: () => void }) {
  const d = useData();
  const goals = r.affectedGoalIds.map((id) => d.goals.find((g) => g.id === id)?.name).filter(Boolean);
  return (
    <div className="card" style={{ padding: 18 }}>
      <div className="row-between wrap" style={{ alignItems: 'flex-start' }}>
        <div className="row" style={{ alignItems: 'flex-start' }}>
          <div className={`icon-chip ${r.category === 'cashflow' ? 'red' : r.category === 'retirement' || r.category === 'debt' ? 'amber' : 'green'}`}>{r.category === 'goals' ? <Target size={17} /> : <Lightbulb size={17} />}</div>
          <div>
            <div className="row wrap" style={{ gap: 8 }}><span className="strong">{r.title}</span><span className="badge">{CATEGORY_LABEL[r.category]}</span></div>
            <div className="small mt-8"><span className="muted">Issue: </span>{r.issue}</div>
            <div className="small mt-8"><span className="muted">Why: </span>{r.reasoning}</div>
            <div className="small mt-8 row wrap" style={{ gap: 8 }}><span className="badge badge-success">{r.impact}</span>{goals.length > 0 && <span className="tiny muted">Affects: {goals.join(', ')}</span>}</div>
          </div>
        </div>
        <div className="row">
          <button className="btn btn-ghost btn-sm" onClick={onDismiss}><X size={14} /> Dismiss</button>
          {r.action && <button className="btn btn-primary btn-sm" onClick={onAccept}><Check size={14} /> {r.action.kind === 'navigate' ? 'Open' : 'Review & apply'}</button>}
        </div>
      </div>
      <div style={{ paddingLeft: 48 }}>
        {r.action && r.action.kind !== 'navigate' && <div className="tiny muted mt-8">Recommended action: {r.actionLabel}</div>}
        <MathToggle>
          {r.math.map((m) => <KV key={m.label} k={m.label} v={m.value} />)}
          <h4>Formula</h4>
          {r.formula.map((f) => <div key={f} className="formula">{f}</div>)}
        </MathToggle>
      </div>
    </div>
  );
}
