import { useMemo, useState } from 'react';
import { CheckCircle2, FileText, Link2, Plus, Trash2, X } from 'lucide-react';
import { useStore } from '../state/store';
import { useData, useDerived } from '../state/hooks';
import { Callout, Card, KV, MathToggle, MoneyInput, Segmented, Switch } from '../components/ui';
import { AllocationBar, CashFlowChart, ProjectionChart } from '../components/charts';
import { AuditList, GOAL_ICON, auditSummary } from '../components/finance';
import { buildAudit } from '../insights/audit';
import { FREQUENCY_LABEL, PAYCHECKS_PER_YEAR, annualize, toMonthly } from '../engine/income';
import type { BudgetLine, PayFrequency } from '../engine/types';
import { fmtDate, fmtMonth } from '../lib/dates';
import { money } from '../lib/money';
import { matchPercent } from '../engine/match';
import { project } from '../engine/projection';

export function PlanPage() {
  const d = useData();
  const x = useDerived();
  const st = useStore();
  const prefs = d.profile.planningPreferences;
  const audit = useMemo(() => buildAudit(d, x), [d, x]);
  const auditSum = auditSummary(audit);
  const inc = d.plan.income;

  const milestones = useMemo(() => {
    const out: { date: string | null; title: string; sub: string; kind: 'goal' | 'debt' | 'purchase'; done?: boolean; late?: boolean; icon?: any }[] = [];
    for (const id of x.sortedGoalIds) {
      const g = d.goals.find((gg) => gg.id === id)!;
      const a = x.goalAnalyses[id];
      out.push({ date: a.projectedCompletionDate, title: `${g.name} reaches ${money(g.targetAmount)}`, sub: a.track === 'complete' ? 'Complete' : g.targetDate ? `Target ${fmtDate(g.targetDate)} · ${a.track === 'on_track' ? 'on track' : a.track === 'behind' ? 'behind target' : a.track.replace('_', ' ')}` : 'No target date', kind: 'goal', done: a.track === 'complete', late: a.track === 'behind', icon: GOAL_ICON[g.category] });
    }
    for (const a of d.accounts.filter((acc) => acc.accountRole === 'liability')) {
      out.push({ date: x.baseline.debtPayoffDates[a.id], title: `${a.name} paid off`, sub: `${money(a.balance)} at ${((a.apr ?? 0) * 100).toFixed(2)}% APR, ${money(a.plannedPayment ?? 0)}/mo`, kind: 'debt' });
    }
    for (const p of d.plan.plannedPurchases) out.push({ date: p.date, title: `Planned purchase: ${p.label}`, sub: money(p.amount), kind: 'purchase' });
    return out.sort((a, b) => (a.date ?? '9999').localeCompare(b.date ?? '9999'));
  }, [d, x]);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Your plan</h1>
          <p>Income, spending, savings and debt — and where they take you. Every change here updates the whole app immediately.</p>
        </div>
        <span className="small muted">Last updated {fmtDate(d.plan.lastUpdated)}</span>
      </div>

      {/* B. Cash-flow allocation */}
      <Card title="Where each month's take-home goes" subtitle={`${money(x.summary.monthlyNet)} per month on a ${inc.mode === 'estimate' ? 'monthly estimate' : 'annualized ÷ 12'} basis`}>
        <AllocationBar s={x.summary} />
        <div className="mt-16"><CashFlowChart proj={x.baseline} months={12} /></div>
        <MathToggle>
          <h4>Monthly planning basis</h4>
          {inc.mode === 'paycheck' ? (
            <div className="formula">{`Annual net = ${money(inc.netPerPaycheck, { exact: true })} × ${PAYCHECKS_PER_YEAR[inc.payFrequency]} paychecks = ${money(annualize(inc.netPerPaycheck, inc.payFrequency), { exact: true })}
Monthly net = annual ÷ 12 = ${money(x.summary.monthlyNet, { exact: true })}`}</div>
          ) : <div className="formula">{`Monthly net = your estimate = ${money(inc.monthlyEstimate)} (irregular income)`}</div>}
          <h4>Savings capacity</h4>
          <div className="formula">{`Capacity = net − essentials − discretionary − debt − recurring
         = ${money(x.summary.monthlyNet)} − ${money(x.summary.essentials)} − ${money(x.summary.discretionary)} − ${money(x.summary.debtPayments)} − ${money(x.summary.recurringCommitments)} = ${money(x.summary.savingsCapacity)}
Assigned to goals = ${money(x.summary.plannedSavings)}   Unassigned = ${money(x.summary.unallocated)}`}</div>
          <h4>Monthly bars</h4>
          <p className="muted">Each bar is a future month from the projection engine: discretionary includes planned purchases and recurring commitments; goal savings includes scheduled contributions plus any surplus swept to goals.</p>
        </MathToggle>
      </Card>

      {/* C. Projection */}
      <Card className="mt-16" title="Projected balances" subtitle="Deterministic month-by-month projection. No investment returns or savings interest assumed."
        action={<Segmented label="Time horizon" value={prefs.horizonMonths} onChange={(v) => st.setPrefs({ horizonMonths: v })} options={[{ value: 12, label: '12 mo' }, { value: 24, label: '24 mo' }]} />}>
        <ProjectionChart baseline={x.baseline} scenario={x.comparison?.scenario} months={prefs.horizonMonths} buffer={d.plan.cashBuffer} />
        {x.comparison && <div className="small muted mt-8">Dashed lines include the {d.scenario.items.filter((i) => i.included && i.scenarioStatus === 'draft').length} purchase(s) in your Simulate scenario. The plan itself is unchanged until you apply them.</div>}
        <div className="grid g-3 mt-16">
          <KV k={`Checking, ${fmtMonth(x.baseline.snapshots[prefs.horizonMonths].monthKey)}`} v={money(x.baseline.snapshots[prefs.horizonMonths].projectedCash)} />
          <KV k={`Savings, ${fmtMonth(x.baseline.snapshots[prefs.horizonMonths].monthKey)}`} v={money(x.baseline.snapshots[prefs.horizonMonths].projectedSavings)} />
          <KV k={`Debt, ${fmtMonth(x.baseline.snapshots[prefs.horizonMonths].monthKey)}`} v={money(x.baseline.snapshots[prefs.horizonMonths].projectedDebt)} />
        </div>
        <ScenarioRange />
      </Card>

      <div className="grid g-2 mt-16">
        {/* D. Milestones */}
        <Card title="Financial milestones" subtitle="Dates from the projection engine">
          <div className="timeline">
            {milestones.map((m, i) => (
              <div className="tl-item" key={i}>
                <span className={`tl-dot ${m.done ? 'done' : m.kind === 'purchase' ? 'purchase' : m.late ? 'warn' : !m.date ? 'muted' : ''}`} />
                <div className="row-between"><span className="strong">{m.title}</span><span className="small num strong">{m.date ? fmtDate(m.date) : 'Not within 5 years'}</span></div>
                <div className="small muted">{m.sub}</div>
              </div>
            ))}
            {milestones.length === 0 && <div className="small muted">Add goals to see milestones.</div>}
          </div>
        </Card>

        {/* E. Assumptions */}
        <Card title="Planning assumptions" subtitle="Change how the projection treats your money">
          <div className="stack">
            <Switch checked={prefs.sweepSurplusToGoals} onChange={(v) => st.setPrefs({ sweepSurplusToGoals: v })} label={<span><strong>Send leftover cash to goals.</strong> <span className="muted small">Cash above your buffer at month end goes to goals in priority order.</span></span>} />
            <Switch checked={prefs.protectCashBuffer} onChange={(v) => st.setPrefs({ protectCashBuffer: v })} label={<span><strong>Protect my cash buffer.</strong> <span className="muted small">If checking would dip below the buffer, pause lowest-priority contributions first.</span></span>} />
            <MoneyInput label="Cash buffer to keep in checking" value={d.plan.cashBuffer} onChange={st.setCashBuffer} hint="Never counted as safe to spend." />
            <Callout tone="plain">Projection order each month: income → essentials → discretionary → debt (interest first) → goal contributions → purchases → recurring → buffer protection → surplus sweep. Dates assume contributions accrue evenly within a month and are rounded up to the whole day.</Callout>
          </div>
        </Card>
      </div>

      {/* A. Income & expenses */}
      <div className="grid g-2 mt-16">
        <Card title="Income" subtitle="Take-home pay drives everything else">
          <div className="stack">
            <Switch checked={inc.mode === 'estimate'} onChange={(v) => st.updateIncome({ mode: v ? 'estimate' : 'paycheck', monthlyEstimate: inc.monthlyEstimate || x.summary.monthlyNet })} label="My income is irregular — use a monthly estimate" />
            {inc.mode === 'estimate' ? (
              <MoneyInput label="Estimated monthly take-home (estimate)" value={inc.monthlyEstimate} onChange={(v) => st.updateIncome({ monthlyEstimate: v })} hint="Shown as an estimate everywhere it is used." />
            ) : (
              <div className="form-grid">
                <div className="field full"><label htmlFor="pf">Pay frequency</label>
                  <select id="pf" className="select" value={inc.payFrequency} onChange={(e) => st.updateIncome({ payFrequency: e.target.value as PayFrequency })}>
                    {(Object.keys(FREQUENCY_LABEL) as PayFrequency[]).map((k) => <option key={k} value={k}>{FREQUENCY_LABEL[k]}</option>)}
                  </select>
                </div>
                <MoneyInput label="Net pay per paycheck" value={inc.netPerPaycheck} onChange={(v) => st.updateIncome({ netPerPaycheck: v })} hint={`${money(toMonthly(inc.netPerPaycheck, inc.payFrequency))}/mo`} />
                <MoneyInput label="Gross pay per paycheck" value={inc.grossPerPaycheck} onChange={(v) => st.updateIncome({ grossPerPaycheck: v })} hint={`${money(annualize(inc.grossPerPaycheck, inc.payFrequency))}/yr`} />
              </div>
            )}
          </div>
        </Card>
        <PaystubCard />
      </div>

      <div className="grid g-2 mt-16">
        <LinesCard kind="essential" lines={d.plan.essentialExpenses} />
        <LinesCard kind="discretionary" lines={d.plan.discretionaryBudgets} />
      </div>

      <div className="grid g-2 mt-16">
        <Card title="Savings contributions" subtitle={`${money(x.summary.plannedSavings)}/mo assigned · ${money(x.summary.unallocated)} unassigned`}>
          {d.goals.length === 0 && <div className="small muted">No goals yet. Add one on the Goals tab.</div>}
          {x.sortedGoalIds.map((id) => {
            const g = d.goals.find((gg) => gg.id === id)!;
            const alloc = x.allocation.find((a) => a.goalId === id);
            return (
              <div className="list-item" key={id}>
                <div style={{ flex: 1 }}><div className="strong">{g.priority}. {g.name}</div><div className="tiny muted">{g.status === 'paused' ? 'Paused' : alloc && alloc.shortfall > 0 ? `Only ${money(alloc.funded)} fundable at this priority` : g.contributionFrequency === 'per_paycheck' ? `per paycheck · ${money(x.goalAnalyses[id].monthlyContribution)}/mo` : 'per month'}</div></div>
                <div style={{ width: 140 }}><MoneyInput compact value={g.contributionAmount} onChange={(v) => st.updateGoal(g.id, { contributionAmount: v })} /></div>
              </div>
            );
          })}
          {x.summary.overAllocated && <Callout tone="warn">Contributions exceed your savings capacity by {money(-x.summary.unallocated)}/mo. Lower-priority goals are funded last.</Callout>}
        </Card>
        <Card title="Debt & retirement" subtitle="Payments and pre-tax contributions">
          {d.accounts.filter((a) => a.accountRole === 'liability').map((a) => (
            <div className="list-item" key={a.id}>
              <div style={{ flex: 1 }}><div className="strong">{a.name}</div><div className="tiny muted">{money(a.balance)} at {((a.apr ?? 0) * 100).toFixed(2)}% · minimum {money(a.minimumPayment ?? 0)}</div></div>
              <div style={{ width: 140 }}><MoneyInput compact value={a.plannedPayment ?? 0} min={a.minimumPayment ?? 0} onChange={(v) => st.updateAccount(a.id, { plannedPayment: v })} /></div>
            </div>
          ))}
          {d.paystub && (
            <div className="list-item">
              <div style={{ flex: 1 }}><div className="strong">401(k) contribution</div><div className="tiny muted">{d.paystub.employeeRetirementPercent}% of pay = {money(d.paystub.employeeRetirementContribution, { exact: true })} per paycheck (pre-tax){x.match ? ` · employer adds ${x.match.matchPercentNow}%` : ''}</div></div>
            </div>
          )}
          <div className="sep" />
          <div className="eyebrow">Planned from simulations</div>
          {d.plan.plannedPurchases.length + d.plan.recurringCommitments.length === 0 && <div className="small muted mt-8">Nothing applied yet. Purchases you apply from Simulate appear here as planned spending.</div>}
          {d.plan.plannedPurchases.map((p) => (
            <div className="list-item" key={p.id}><div style={{ flex: 1 }}><div className="strong">{p.label}</div><div className="tiny muted">One-time · {fmtDate(p.date)} · planned, not yet spent</div></div><span className="num strong">{money(p.amount)}</span><button className="btn btn-ghost btn-icon" aria-label={`Remove ${p.label} from plan`} onClick={() => st.removePlanned('purchase', p.id)}><X size={16} /></button></div>
          ))}
          {d.plan.recurringCommitments.map((p) => (
            <div className="list-item" key={p.id}><div style={{ flex: 1 }}><div className="strong">{p.label}</div><div className="tiny muted">{p.interval} from {fmtDate(p.startDate)}{p.occurrences ? ` · ${p.occurrences} payments` : ' · ongoing'}</div></div><span className="num strong">{money(p.amount)}</span><button className="btn btn-ghost btn-icon" aria-label={`Remove ${p.label} from plan`} onClick={() => st.removePlanned('recurring', p.id)}><X size={16} /></button></div>
          ))}
        </Card>
      </div>

      {/* F. Audit */}
      <Card className="mt-16" title="Financial audit" subtitle={`${auditSum.done} of ${auditSum.total} requirements complete — like a degree audit for your money`}>
        <AuditList items={audit} />
      </Card>
    </div>
  );
}

/** Explicit lower / expected / higher expense scenarios — a range from defined assumptions, not a statistical interval. */
function ScenarioRange() {
  const x = useDerived();
  const h = useData().profile.planningPreferences.horizonMonths;
  const rows = useMemo(() => {
    return [-0.1, 0, 0.1].map((pct) => {
      const plan = { ...x.inputs.plan, essentialExpenses: x.inputs.plan.essentialExpenses.map((l) => ({ ...l, amount: Math.round(l.amount * (1 + pct)) })), discretionaryBudgets: x.inputs.plan.discretionaryBudgets.map((l) => ({ ...l, amount: Math.round(l.amount * (1 + pct)) })) };
      const r = project({ ...x.inputs, plan }, { scenarioId: `range${pct}` });
      return { pct, savings: r.snapshots[h].projectedSavings, cash: r.snapshots[h].projectedCash };
    });
  }, [x, h]);
  return (
    <details className="mt-16">
      <summary className="link-btn">What if spending runs 10% higher or lower?</summary>
      <div className="table-wrap mt-8">
        <table className="table">
          <thead><tr><th>Assumption</th><th className="r">Savings in {h} mo</th><th className="r">Checking in {h} mo</th></tr></thead>
          <tbody>{rows.map((r) => <tr key={r.pct}><td>{r.pct === 0 ? 'Expected (your plan)' : r.pct < 0 ? 'Spending 10% lower' : 'Spending 10% higher'}</td><td className="r">{money(r.savings)}</td><td className="r">{money(r.cash)}</td></tr>)}</tbody>
        </table>
      </div>
      <p className="tiny muted mt-8">Each row reruns the same projection with essential and discretionary spending scaled by the stated amount. This is a sensitivity range, not a probability.</p>
    </details>
  );
}

function LinesCard({ kind, lines }: { kind: 'essential' | 'discretionary'; lines: BudgetLine[] }) {
  const st = useStore();
  const [label, setLabel] = useState('');
  const [amount, setAmount] = useState(0);
  const total = lines.reduce((a, l) => a + l.amount, 0);
  return (
    <Card title={kind === 'essential' ? 'Essential expenses' : 'Discretionary budget'} subtitle={`${money(total)} per month`}>
      {lines.map((l) => (
        <div className="list-item" key={l.id}>
          <div style={{ flex: 1 }}><div className="strong">{l.label}</div>{l.dueDay && <div className="tiny muted">Due on day {l.dueDay}</div>}</div>
          <div style={{ width: 130 }}><MoneyInput compact value={l.amount} onChange={(v) => st.setBudgetLine(kind, l.id, { amount: v })} /></div>
          <button className="btn btn-ghost btn-icon" aria-label={`Remove ${l.label}`} onClick={() => st.removeBudgetLine(kind, l.id)}><Trash2 size={15} /></button>
        </div>
      ))}
      <form className="row mt-12" style={{ alignItems: 'flex-end' }} onSubmit={(e) => { e.preventDefault(); if (label.trim() && amount > 0) { st.addBudgetLine(kind, label.trim(), amount); setLabel(''); setAmount(0); } }}>
        <div className="field" style={{ flex: 1 }}><label htmlFor={`new-${kind}`} className="sr-only">New category name</label><input id={`new-${kind}`} className="input" placeholder="New category" value={label} onChange={(e) => setLabel(e.target.value)} maxLength={40} /></div>
        <div style={{ width: 130 }}><MoneyInput value={amount} onChange={setAmount} /></div>
        <button className="btn btn-secondary btn-icon" style={{ height: 40, width: 40 }} type="submit" disabled={!label.trim() || amount <= 0} aria-label="Add category"><Plus size={16} /></button>
      </form>
    </Card>
  );
}

function PaystubCard() {
  const d = useData();
  const x = useDerived();
  const st = useStore();
  const s = d.paystub;
  if (!s) {
    return (
      <Card title="Paystub" subtitle="Optional — enables employer match guidance">
        <div className="empty"><div className="icon-chip amber"><FileText size={18} /></div>No paystub on file.</div>
        <button className="btn btn-secondary btn-block" onClick={() => st.connectMock('payroll')} disabled={d.connections.payroll}><Link2 size={15} /> {d.connections.payroll ? 'Simulated payroll connected' : 'Connect ADP (simulated)'}</button>
        <p className="tiny muted mt-8">A simulated connection only marks the demo as linked. Clover never asks for payroll credentials.</p>
      </Card>
    );
  }
  const totalTax = s.taxWithholding.federal + s.taxWithholding.state + s.taxWithholding.socialSecurity + s.taxWithholding.medicare;
  const other = s.otherDeductions.reduce((a, o) => a + o.amount, 0);
  const reconciles = s.grossPay - totalTax - other - s.employeeRetirementContribution;
  const synced = d.plan.income.netPerPaycheck === s.netPay && d.plan.income.grossPerPaycheck === s.grossPay && d.plan.income.payFrequency === s.payFrequency;
  return (
    <Card title="Paystub" subtitle={`${s.employer} · paid ${fmtDate(s.payDate)}`} action={s.isMock ? <span className="badge badge-outline">Simulated</span> : undefined}>
      <div className="form-grid">
        <MoneyInput label="Gross pay" value={s.grossPay} onChange={(v) => st.updatePaystub({ grossPay: v, employeeRetirementContribution: Math.round((v * s.employeeRetirementPercent) / 100) })} />
        <MoneyInput label="Net pay" value={s.netPay} onChange={(v) => st.updatePaystub({ netPay: v })} />
        <div className="field"><label htmlFor="ret">401(k) contribution</label>
          <div className="input-suffix"><input id="ret" className="input" type="number" min={0} max={75} step={0.5} value={s.employeeRetirementPercent}
            onChange={(e) => { const v = Number(e.target.value); if (Number.isFinite(v) && v >= 0 && v <= 75) st.updatePaystub({ employeeRetirementPercent: v, employeeRetirementContribution: Math.round((s.grossPay * v) / 100) }); }} /><span>% of pay</span></div>
        </div>
        <div className="field"><span className="label">Employer match</span><span className="small muted">{s.employerMatchPolicy?.description ?? 'None'}{s.employerMatchPolicy ? ` → ${matchPercent(s.employerMatchPolicy, s.employeeRetirementPercent)}% of pay at your rate` : ''}</span></div>
      </div>
      <div className="mt-12">
        <KV k="Federal / state withholding" v={`${money(s.taxWithholding.federal, { exact: true })} / ${money(s.taxWithholding.state, { exact: true })}`} />
        <KV k="Social Security + Medicare" v={money(s.taxWithholding.socialSecurity + s.taxWithholding.medicare, { exact: true })} />
        {s.otherDeductions.map((o) => <KV key={o.label} k={o.label} v={money(o.amount, { exact: true })} />)}
        <KV k="401(k) (pre-tax)" v={money(s.employeeRetirementContribution, { exact: true })} />
        <KV k="Gross − deductions" v={money(reconciles, { exact: true })} total />
      </div>
      {Math.abs(reconciles - s.netPay) > 100 && <Callout tone="warn">Deductions don't add up to net pay ({money(reconciles - s.netPay, { exact: true })} difference). Update the net pay from your latest paystub.</Callout>}
      {x.match && s.employerMatchPolicy?.vestingNote && <p className="tiny muted mt-8">{s.employerMatchPolicy.vestingNote}</p>}
      <div className="row mt-12 wrap">
        <button className="btn btn-secondary btn-sm" onClick={st.applyPaystubToPlan} disabled={synced}>{synced ? <><CheckCircle2 size={14} /> Plan matches paystub</> : 'Apply paystub to plan income'}</button>
      </div>
    </Card>
  );
}
