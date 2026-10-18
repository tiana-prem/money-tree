import { useMemo, useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowUp, Pause, Pencil, Play, Plus, ShoppingBag, Trash2 } from 'lucide-react';
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useStore } from '../state/store';
import { useData, useDerived } from '../state/hooks';
import { Callout, Card, ChartTooltip, ConfirmDialog, KV, MathToggle, Modal, MoneyInput, Progress, Segmented } from '../components/ui';
import { GOAL_CATEGORY_LABEL, GOAL_ICON, GoalRow, trackBadge } from '../components/finance';
import type { FinancialGoal, GoalCategory } from '../engine/types';
import { AVG_DAYS_PER_MONTH, addDays, describeDays, diffDays, fmtDate, isValidISO, monthsBetween } from '../lib/dates';
import { money, moneyShort } from '../lib/money';
import { toMonthly } from '../engine/income';

export function GoalsPage() {
  const d = useData();
  const x = useDerived();
  const st = useStore();
  const [adding, setAdding] = useState(false);
  const detail = d.goals.find((g) => g.id === st.goalDetailId);
  if (detail) return <GoalDetail goal={detail} />;

  const goals = x.sortedGoalIds.map((id) => d.goals.find((g) => g.id === id)!);
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Goals</h1>
          <p>What you're saving for, and what it takes to get there. Goals are funded in priority order.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setAdding(true)}><Plus size={17} /> Add goal</button>
      </div>

      <div className="grid g-4">
        <Stat label="Saved toward goals" value={money(d.goals.reduce((a, g) => a + g.currentSavedAmount, 0))} />
        <Stat label="Still to save" value={money(d.goals.reduce((a, g) => a + x.goalAnalyses[g.id].remaining, 0))} />
        <Stat label="Contributions / month" value={money(x.summary.plannedSavings)} />
        <Stat label="Savings capacity / month" value={money(x.summary.savingsCapacity)} sub={x.summary.overAllocated ? `${money(-x.summary.unallocated)} over-allocated` : `${money(x.summary.unallocated)} unassigned`} neg={x.summary.overAllocated} />
      </div>

      {x.summary.overAllocated && (
        <div className="mt-16">
          <Callout tone="warn">
            <strong>Your goals ask for {money(x.summary.plannedSavings)}/month, but your plan can fund {money(Math.max(0, x.summary.savingsCapacity))}.</strong> Clover funds the highest priorities first:{' '}
            {x.allocation.filter((a) => a.shortfall > 0).map((a) => `${d.goals.find((g) => g.id === a.goalId)?.name} gets ${money(a.funded)} of ${money(a.requested)}`).join('; ')}. Reorder priorities, lower a contribution, or extend a target date.
          </Callout>
        </div>
      )}

      <Card className="mt-16" title="Your goals" subtitle="Use the arrows to change priority. Select a goal for details.">
        {goals.length === 0 ? (
          <div className="empty">
            <div className="icon-chip green"><Plus size={18} /></div>
            <div className="strong">No goals yet</div>
            <p className="small muted mt-8">Start with an emergency fund of three months of essentials ({money(3 * x.summary.essentials)}).</p>
            <button className="btn btn-primary mt-16" onClick={() => setAdding(true)}>Add your first goal</button>
          </div>
        ) : (
          <div className="list">
            {goals.map((g, i) => (
              <div key={g.id} className="row" style={{ alignItems: 'stretch' }}>
                <div className="stack-sm" style={{ justifyContent: 'center', gap: 2 }}>
                  <button className="btn btn-ghost btn-icon btn-sm" disabled={i === 0} onClick={() => st.moveGoal(g.id, -1)} aria-label={`Raise priority of ${g.name}`}><ArrowUp size={15} /></button>
                  <button className="btn btn-ghost btn-icon btn-sm" disabled={i === goals.length - 1} onClick={() => st.moveGoal(g.id, 1)} aria-label={`Lower priority of ${g.name}`}><ArrowDown size={15} /></button>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}><GoalRow goal={g} a={x.goalAnalyses[g.id]} onClick={() => st.openGoal(g.id)} /></div>
              </div>
            ))}
          </div>
        )}
      </Card>
      <GoalForm open={adding} onClose={() => setAdding(false)} />
    </div>
  );
}

function Stat({ label, value, sub, neg }: { label: string; value: string; sub?: string; neg?: boolean }) {
  return <div className="card"><div className="metric-label">{label}</div><div className={`metric mt-8 ${neg ? 'neg' : ''}`}>{value}</div>{sub && <div className={`tiny mt-8 ${neg ? 'neg' : 'muted'}`}>{sub}</div>}</div>;
}

const CATEGORIES = Object.keys(GOAL_CATEGORY_LABEL) as GoalCategory[];

export function GoalForm({ open, onClose, goal }: { open: boolean; onClose: () => void; goal?: FinancialGoal }) {
  const d = useData();
  const x = useDerived();
  const st = useStore();
  const [f, setF] = useState(() => ({
    name: goal?.name ?? '', category: goal?.category ?? ('car' as GoalCategory), targetAmount: goal?.targetAmount ?? 0, currentSavedAmount: goal?.currentSavedAmount ?? 0,
    targetDate: goal?.targetDate ?? '', contributionAmount: goal?.contributionAmount ?? 0, contributionFrequency: goal?.contributionFrequency ?? ('monthly' as const),
    priority: goal?.priority ?? d.goals.length + 1, notes: goal?.notes ?? '',
  }));
  const [touched, setTouched] = useState(false);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF({ ...f, [k]: v });

  const errors: Partial<Record<keyof typeof f, string>> = {};
  if (!f.name.trim()) errors.name = 'Give the goal a name.';
  if (f.targetAmount <= 0) errors.targetAmount = 'Target must be greater than $0.';
  if (f.targetDate && !isValidISO(f.targetDate)) errors.targetDate = 'Enter a valid date.';
  else if (f.targetDate && diffDays(f.targetDate, x.today) <= 0) errors.targetDate = 'That date has passed — choose a future date or leave it blank.';
  const ok = Object.keys(errors).length === 0;

  // Live feasibility preview (same formulas as the engine's goal analysis).
  const remaining = Math.max(0, f.targetAmount - f.currentSavedAmount);
  const monthly = f.contributionFrequency === 'per_paycheck' ? toMonthly(f.contributionAmount, d.plan.income.payFrequency) : f.contributionAmount;
  const existing = goal ? x.goalAnalyses[goal.id].monthlyContribution : 0;
  const available = Math.max(0, x.summary.unallocated + existing);
  const months = f.targetDate && !errors.targetDate ? monthsBetween(x.today, f.targetDate) : null;
  const required = months ? Math.ceil(remaining / months) : null;
  const simpleDate = monthly > 0 ? addDays(x.today, Math.ceil((remaining / monthly) * AVG_DAYS_PER_MONTH)) : null;
  const feasible = required === null ? null : required <= available;
  const overCapacity = monthly > available;

  const save = () => {
    setTouched(true);
    if (!ok) return;
    const payload = { ...f, name: f.name.trim(), targetDate: f.targetDate || null };
    if (goal) { st.updateGoal(goal.id, payload); st.toast('Goal updated.'); }
    else { const id = st.addGoal(payload); st.toast(`Goal “${payload.name}” created.`); st.openGoal(id); }
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} wide title={goal ? 'Edit goal' : 'Add a goal'} subtitle="Clover calculates what it takes and whether your plan can fund it."
      footer={<><button className="btn btn-secondary" onClick={onClose}>Cancel</button><button className="btn btn-primary" onClick={save} disabled={touched && !ok}>{goal ? 'Save changes' : 'Create goal'}</button></>}>
      <div className="form-grid">
        <div className="field"><label htmlFor="g-name">Goal name</label><input id="g-name" className="input" value={f.name} maxLength={50} onChange={(e) => set('name', e.target.value)} aria-invalid={touched && !!errors.name} placeholder="e.g. Car down payment" />{touched && errors.name && <span className="error">{errors.name}</span>}</div>
        <div className="field"><label htmlFor="g-cat">Category</label>
          <select id="g-cat" className="select" value={f.category} onChange={(e) => set('category', e.target.value as GoalCategory)}>{CATEGORIES.map((c) => <option key={c} value={c}>{GOAL_CATEGORY_LABEL[c]}</option>)}</select>
        </div>
        <div><MoneyInput label="Target amount" value={f.targetAmount} onChange={(v) => set('targetAmount', v)} />{touched && errors.targetAmount && <span className="error small" style={{ color: 'var(--negative)' }}>{errors.targetAmount}</span>}</div>
        <MoneyInput label="Already saved" value={f.currentSavedAmount} onChange={(v) => set('currentSavedAmount', v)} />
        <div className="field"><label htmlFor="g-date">Target date (optional)</label><input id="g-date" type="date" className="input" value={f.targetDate} min={addDays(x.today, 1)} onChange={(e) => set('targetDate', e.target.value)} aria-invalid={!!errors.targetDate} />{errors.targetDate && <span className="error">{errors.targetDate}</span>}</div>
        <div className="field"><span className="label">Contribution</span>
          <div className="row"><div style={{ flex: 1 }}><MoneyInput value={f.contributionAmount} onChange={(v) => set('contributionAmount', v)} /></div>
            <Segmented label="Contribution frequency" value={f.contributionFrequency} onChange={(v) => set('contributionFrequency', v)} options={[{ value: 'monthly', label: '/ month' }, { value: 'per_paycheck', label: '/ paycheck' }]} /></div>
        </div>
        <div className="field"><label htmlFor="g-prio">Priority</label>
          <select id="g-prio" className="select" value={f.priority} onChange={(e) => set('priority', Number(e.target.value))}>
            {Array.from({ length: Math.max(d.goals.length + (goal ? 0 : 1), 1) }, (_, i) => i + 1).map((p) => <option key={p} value={p}>{p === 1 ? '1 — highest' : p}</option>)}
          </select>
        </div>
        <div className="field full"><label htmlFor="g-notes">Notes (optional)</label><textarea id="g-notes" className="textarea" maxLength={200} value={f.notes} onChange={(e) => set('notes', e.target.value)} /></div>
      </div>

      {f.targetAmount > 0 && (
        <div className="card tint mt-16">
          <div className="eyebrow">Feasibility</div>
          <div className="grid g-3 mt-8">
            <KV k="Remaining" v={money(remaining)} />
            <KV k="Required / mo" v={required !== null ? money(required) : '—'} />
            <KV k="Available / mo" v={money(available)} />
          </div>
          <div className="mt-12 small">
            {required !== null && feasible && <span className="pos strong">Feasible.</span>}
            {required !== null && !feasible && <span className="neg strong">Shortfall of {money(required - available)}/month. </span>}
            {required !== null && !feasible && simpleDate && <span>Options: extend the date to around {fmtDate(simpleDate)}, lower the target, or free up {money(required - available)}/month elsewhere.</span>}
            {required !== null && !feasible && !simpleDate && <span>Options: add a contribution, extend the date, or lower the target.</span>}
            {required !== null && feasible && monthly < required && <span> Set the contribution to at least {money(required)}/month to hit {fmtDate(f.targetDate)}.</span>}
            {required === null && (monthly > 0 ? <span>At {money(monthly)}/month this completes around {fmtDate(simpleDate)} (contribution only).</span> : <span className="muted">Add a contribution or a target date to get a completion estimate.</span>)}
            {overCapacity && <div className="mt-8" style={{ color: 'var(--warning)' }}>This contribution is more than your unassigned capacity ({money(available)}). Lower-priority goals would be funded less.</div>}
          </div>
          <MathToggle>
            <div className="formula">{`Remaining = max(0, ${money(f.targetAmount)} − ${money(f.currentSavedAmount)}) = ${money(remaining)}${months ? `
Months until target = ${diffDays(f.targetDate, x.today)} days ÷ 30.4375 = ${months.toFixed(2)}
Required monthly = ${money(remaining)} ÷ ${months.toFixed(2)} = ${money(required!)}` : ''}${monthly > 0 ? `
Months to complete = ${money(remaining)} ÷ ${money(monthly)} = ${(remaining / monthly).toFixed(2)}` : ''}
Available = unassigned savings capacity${goal ? ' + this goal’s current contribution' : ''} = ${money(available)}`}</div>
          </MathToggle>
        </div>
      )}
    </Modal>
  );
}

function GoalDetail({ goal }: { goal: FinancialGoal }) {
  const d = useData();
  const x = useDerived();
  const st = useStore();
  const a = x.goalAnalyses[goal.id];
  const [edit, setEdit] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const Icon = GOAL_ICON[goal.category];
  const impact = x.comparison?.goalImpacts.find((g) => g.goalId === goal.id);

  const chart = useMemo(() => {
    const hist = goal.history.map((h) => ({ date: h.date, actual: h.balance / 100 }));
    const proj = x.baseline.snapshots.slice(0, 13).map((s) => ({ date: s.periodEnd, projected: s.goalBalances[goal.id] / 100 }));
    if (hist.length) proj.unshift({ date: hist[hist.length - 1].date, projected: hist[hist.length - 1].actual });
    return [...hist.map((h) => ({ ...h, projected: undefined as number | undefined })), ...proj.map((p) => ({ date: p.date, actual: undefined as number | undefined, projected: p.projected }))];
  }, [goal, x]);

  return (
    <div className="page">
      <button className="link-btn" onClick={() => st.openGoal(null)}><ArrowLeft size={15} /> All goals</button>
      <div className="page-head mt-12">
        <div className="row"><div className="icon-chip green" style={{ width: 44, height: 44 }}><Icon size={22} /></div>
          <div><h1>{goal.name}</h1><p>{GOAL_CATEGORY_LABEL[goal.category]} · priority {goal.priority}{goal.notes ? ` · ${goal.notes}` : ''}</p></div></div>
        <div className="row wrap">
          {trackBadge(a)}
          <button className="btn btn-secondary btn-sm" onClick={() => setEdit(true)}><Pencil size={14} /> Edit</button>
          {goal.status !== 'completed' && <button className="btn btn-secondary btn-sm" onClick={() => { st.updateGoal(goal.id, { status: goal.status === 'paused' ? 'active' : 'paused' }); st.toast(goal.status === 'paused' ? 'Goal resumed.' : 'Goal paused. Its contribution is freed up.', 'info'); }}>{goal.status === 'paused' ? <><Play size={14} /> Resume</> : <><Pause size={14} /> Pause</>}</button>}
          <button className="btn btn-danger btn-sm" onClick={() => setConfirmDelete(true)}><Trash2 size={14} /> Delete</button>
        </div>
      </div>

      <div className="grid g-main">
        <Card>
          <div className="row-between wrap">
            <div><div className="metric-label">Saved</div><div className="metric-xl">{money(goal.currentSavedAmount)}</div><div className="small muted">of {money(goal.targetAmount)} · {Math.round(a.percent * 100)}% complete</div></div>
            <div className="right"><div className="metric-label">Projected completion</div><div className="metric">{a.projectedCompletionDate ? fmtDate(a.projectedCompletionDate) : 'Not projected'}</div>{goal.targetDate && <div className="small muted">Target {fmtDate(goal.targetDate)}</div>}</div>
          </div>
          <div className="mt-16"><Progress value={a.percent} label={`${goal.name} progress`} /></div>
          <div className="chart-wrap mt-16" style={{ height: 230 }}>
            <ResponsiveContainer>
              <AreaChart data={chart} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--c-grid)" />
                <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#868c86' }} tickLine={false} axisLine={false} tickFormatter={(v) => fmtDate(v, { year: false }).split(' ')[0]} minTickGap={18} />
                <YAxis tick={{ fontSize: 12, fill: '#868c86' }} tickLine={false} axisLine={false} tickFormatter={(v) => moneyShort(v * 100)} width={52} />
                <Tooltip content={<ChartTooltip formatter={(v: number) => money(v * 100)} labelFormatter={(v: string) => fmtDate(v)} />} />
                <ReferenceLine y={goal.targetAmount / 100} stroke="var(--primary)" strokeDasharray="4 4" label={{ value: 'Target', fontSize: 11, fill: '#1f5c3f', position: 'insideTopLeft' }} />
                <Area dataKey="actual" name="Saved (history)" stroke="var(--c-savings)" fill="var(--c-savings)" fillOpacity={0.12} strokeWidth={2} connectNulls={false} />
                <Area dataKey="projected" name="Projected" stroke="var(--c-savings)" strokeDasharray="5 4" fill="none" strokeWidth={2} connectNulls={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="legend"><span><span className="swatch line" style={{ background: 'var(--c-savings)' }} />Saved (history)</span><span style={{ color: 'var(--c-savings)' }}><span className="swatch dash" /> <span className="muted">Projected</span></span></div>
        </Card>

        <div className="stack">
          <Card title="Schedule">
            <KV k="Remaining" v={money(a.remaining)} />
            <KV k="Contribution" v={`${money(goal.contributionAmount)} ${goal.contributionFrequency === 'per_paycheck' ? `per paycheck (${money(a.monthlyContribution)}/mo)` : 'per month'}`} />
            <KV k="Contribution-only estimate" v={a.simpleCompletionDate ? fmtDate(a.simpleCompletionDate) : 'No contribution'} />
            <KV k="Full projection" v={a.projectedCompletionDate ? fmtDate(a.projectedCompletionDate) : 'Not within 5 years'} />
            {goal.targetDate && <KV k="Required to hit target" v={a.requiredMonthly !== null ? `${money(a.requiredMonthly)}/mo` : 'Date passed'} />}
            {a.track === 'overdue' && <Callout tone="neg">The target date has passed. Choose a new date to get a required contribution.</Callout>}
            {a.track === 'no_contribution' && <Callout tone="warn">No contribution and no surplus reaches this goal, so there is no projected completion date yet. Add a contribution.</Callout>}
            {a.track === 'behind' && a.gapMonthly !== null && (
              <Callout tone="warn">
                Behind by {money(a.gapMonthly)}/month. {a.feasibleWithCapacity ? 'Your unassigned capacity can cover it.' : 'That exceeds your unassigned capacity — consider extending the date.'}
                <div className="row wrap mt-8">
                  {a.feasibleWithCapacity && a.requiredMonthly && <button className="btn btn-sm btn-secondary" onClick={() => { st.setGoalContribution(goal.id, a.requiredMonthly!); st.toast('Contribution raised.'); }}>Raise to {money(a.requiredMonthly)}/mo</button>}
                  {a.projectedCompletionDate && <button className="btn btn-sm btn-secondary" onClick={() => { st.updateGoal(goal.id, { targetDate: a.projectedCompletionDate }); st.toast('Target date updated.'); }}>Move date to {fmtDate(a.projectedCompletionDate)}</button>}
                </div>
              </Callout>
            )}
            <MathToggle>
              <div className="formula">{`Remaining = max(0, ${money(goal.targetAmount)} − ${money(goal.currentSavedAmount)}) = ${money(a.remaining)}
Contribution-only months = ${money(a.remaining)} ÷ ${money(a.monthlyContribution)} = ${a.simpleMonths?.toFixed(2) ?? '∞'}${a.monthsUntilTarget ? `
Required monthly = ${money(a.remaining)} ÷ ${a.monthsUntilTarget.toFixed(2)} months = ${money(a.requiredMonthly ?? 0)}` : ''}`}</div>
              <p className="muted">The full projection can finish earlier than the contribution-only estimate because {d.profile.planningPreferences.sweepSurplusToGoals ? 'leftover cash is swept to goals in priority order' : 'it accounts for timing'}, or later if contributions are paused to protect your cash buffer.</p>
            </MathToggle>
          </Card>

          <Card title="Purchase impact">
            {impact ? (
              <div className="stack-sm">
                <div className="small muted">Your current Simulate scenario:</div>
                <div className="strong">{impact.kind === 'delayed' ? `Delays this goal by ${describeDays(impact.delayDays!)}` : impact.kind === 'pushed_beyond' ? 'Pushes this goal beyond the projection' : impact.kind === 'earlier' ? 'Moves this goal earlier' : 'No material change projected'}</div>
                <div className="small muted">{fmtDate(impact.baselineDate)} → {fmtDate(impact.scenarioDate)}</div>
                <button className="btn btn-soft btn-sm mt-8" onClick={() => st.setTab('simulate')}><ShoppingBag size={14} /> Open simulation</button>
              </div>
            ) : (
              <div className="stack-sm">
                <div className="small muted">No purchase is being simulated. Test one to see how it would move this goal.</div>
                <button className="btn btn-soft btn-sm" onClick={() => st.setTab('simulate')}><ShoppingBag size={14} /> Test a purchase</button>
              </div>
            )}
          </Card>
        </div>
      </div>

      {edit && <GoalForm open={edit} onClose={() => setEdit(false)} goal={goal} />}
      <ConfirmDialog open={confirmDelete} title={`Delete “${goal.name}”?`} body={`This removes the goal and its ${money(goal.currentSavedAmount)} tracked balance from your plan. Your savings account balance is not changed.`} confirmLabel="Delete goal" tone="danger" onCancel={() => setConfirmDelete(false)} onConfirm={() => { setConfirmDelete(false); st.deleteGoal(goal.id); }} />
    </div>
  );
}
