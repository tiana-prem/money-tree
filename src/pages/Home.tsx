import { useMemo, useState } from 'react';
import { ArrowDownLeft, ArrowRight, ArrowUpRight, CalendarDays, CreditCard, Flame, Flower2, Landmark, Lightbulb, PiggyBank, ShoppingBag, Sparkles, TrendingUp, Wallet } from 'lucide-react';
import { useStore } from '../state/store';
import { useData, useDerived } from '../state/hooks';
import { Card, Modal, Progress } from '../components/ui';
import { AuditList, GoalRow, SafeToSpendBreakdown, auditSummary } from '../components/finance';
import { buildAudit } from '../insights/audit';
import { buildRecommendations } from '../insights/recommendations';
import { emergencyPercent } from '../state/derive';
import { fmtDate } from '../lib/dates';
import { money } from '../lib/money';
import { POINTS } from '../garden/rules';

export function HomePage() {
  const d = useData();
  const x = useDerived();
  const setTab = useStore((s) => s.setTab);
  const openGoal = useStore((s) => s.openGoal);
  const [breakdown, setBreakdown] = useState(false);
  const audit = useMemo(() => buildAudit(d, x), [d, x]);
  const recs = useMemo(() => buildRecommendations(d, x).filter((r) => !d.recommendationFeedback[r.id]), [d, x]);
  const s = x.safe;

  const cash = d.accounts.filter((a) => a.accountRole === 'cash');
  const liabilities = d.accounts.filter((a) => a.accountRole === 'liability');
  const investments = d.accounts.filter((a) => a.accountRole === 'investment');
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const topGoals = x.sortedGoalIds.slice(0, 3).map((id) => d.goals.find((g) => g.id === id)!);
  const efPct = emergencyPercent(d);
  const auditSum = auditSummary(audit);
  const week = x.currentWeek;
  const isDemo = d.profile.dataSource !== 'manual';

  const status = s.shortfall
    ? 'Your planned commitments exceed what is available this month. Review the breakdown below.'
    : x.summary.overAllocated
      ? 'Your goals ask for more than your plan can fund — worth a look on the Goals tab.'
      : `You are on plan this month with ${money(s.safeToSpend)} safe to spend and ${auditSum.done} of ${auditSum.total} financial milestones complete.`;

  // Recent activity: real transactions plus simulations and plan updates (clearly labeled).
  const recentTx = [...d.transactions].filter((t) => t.date <= x.today).sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id)).slice(0, 6);
  const feed = [
    ...recentTx.map((t) => ({ key: t.id, date: t.date, title: t.description, sub: t.transactionType === 'income' ? 'Income' : t.transactionType === 'transfer_to_savings' ? 'Transfer to savings' : t.transactionType === 'debt_payment' ? 'Debt payment' : t.kind === 'essential' ? 'Essential' : 'Discretionary', amount: t.transactionType === 'income' ? t.amount : -t.amount, kind: 'tx' as const, tag: isDemo ? 'Simulated data' : '' })),
    ...d.activity.slice(0, 6).map((a) => ({ key: a.id, date: a.date, title: a.title, sub: a.detail ?? '', amount: a.amount ?? null, kind: a.kind, tag: a.kind === 'simulation' ? 'What-if only' : a.kind === 'plan' ? 'Plan update' : a.kind === 'garden' ? 'Garden' : a.kind === 'goal' ? 'Goal' : 'Account' })),
  ].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="eyebrow">{fmtDate(x.today)}</div>
          <h1>{greeting}{d.profile.displayName ? `, ${d.profile.displayName}` : ''}</h1>
          <p style={{ maxWidth: 640 }}>{status}</p>
        </div>
        <button className="btn btn-primary btn-lg" onClick={() => setTab('simulate')}><ShoppingBag size={18} /> Test a purchase</button>
      </div>

      <div className="grid g-main">
        {/* B. Safe to spend */}
        <Card className="hero">
          <div className="row-between wrap">
            <div>
              <div className="metric-label">Safe to spend through {fmtDate(s.periodEnd, { year: false })}</div>
              <div className={`metric-xl mt-8 ${s.shortfall ? 'neg' : ''}`}>{money(s.safeToSpend)}</div>
              {s.shortfall && <span className="badge badge-negative mt-8">Shortfall</span>}
            </div>
            <div className="stack-sm" style={{ alignItems: 'flex-end' }}>
              {s.nextPayDate && <span className="badge badge-primary"><CalendarDays size={13} /> Next payday {fmtDate(s.nextPayDate, { year: false })}</span>}
              <span className="small muted">Not your account balance — this is what fits your plan.</span>
            </div>
          </div>
          <div className="mt-16">
            <Progress value={s.discretionaryBudget > 0 ? s.discretionarySpent / (s.discretionaryBudget + s.unallocatedAvailable) : 0} tone={s.budgetRemaining < 0 ? 'warn' : 'sage'} label="Discretionary budget used" />
            <div className="row-between small muted mt-8"><span>{money(s.discretionarySpent)} of {money(s.discretionaryBudget + s.unallocatedAvailable)} discretionary used</span><span>{money(Math.max(0, s.budgetRemaining))} left in budget</span></div>
          </div>
          <div className="grid g-4 mt-16" style={{ gap: 10 }}>
            <MiniStat icon={<ArrowDownLeft size={15} />} label="Net income this month" value={money(s.incomeReceived + s.incomeExpected)} sub={`${money(s.incomeReceived)} received`} />
            <MiniStat icon={<Landmark size={15} />} label="Essentials reserved" value={money(s.essentialsReserved + s.debtReserved)} sub="bills + debt still due" />
            <MiniStat icon={<PiggyBank size={15} />} label="Savings planned" value={money(x.summary.plannedSavings)} sub={`${money(s.savingsReserved)} still to transfer`} />
            <MiniStat icon={<Wallet size={15} />} label="Discretionary used" value={money(s.discretionarySpent)} sub="this month" />
          </div>
          <button className="link-btn mt-16" onClick={() => setBreakdown(true)}>View the breakdown <ArrowRight size={15} /></button>
        </Card>

        {/* H. Recommended next action */}
        <Card title="Recommended next" subtitle="Calculated from your plan" action={<Lightbulb size={18} color="var(--warning)" />}>
          <div className="stack">
            {recs.slice(0, 2).map((r) => (
              <div key={r.id} className="stack-sm" style={{ paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
                <div className="strong">{r.title}</div>
                <div className="small muted">{r.issue}</div>
                <div className="small"><span className="badge badge-success"><TrendingUp size={12} /> {r.impact}</span></div>
                <button className="link-btn small" onClick={() => setTab('insights')}>Review and decide <ArrowRight size={14} /></button>
              </div>
            ))}
            {recs.length === 0 && <div className="small muted">No open recommendations. Nice work.</div>}
            <button className="btn btn-soft" onClick={() => setTab('simulate')}><ShoppingBag size={16} /> Test an upcoming purchase</button>
          </div>
        </Card>
      </div>

      {/* C. Financial overview */}
      <div className="grid g-4 mt-16">
        <OverviewTile icon={<Wallet size={17} />} tone="green" label="Cash" value={money(cash.reduce((a, c) => a + c.balance, 0))} sub={cash.map((c) => `${c.name} ${money(c.balance)}`).join(' · ')} />
        <OverviewTile icon={<ArrowDownLeft size={17} />} tone="blue" label="Monthly take-home" value={money(x.summary.monthlyNet)} sub={d.plan.income.mode === 'estimate' ? 'Estimate (irregular income)' : `${money(d.plan.income.netPerPaycheck)} per paycheck`} />
        <OverviewTile icon={<Landmark size={17} />} tone="amber" label="Essentials + debt / mo" value={money(x.summary.essentials + x.summary.debtPayments)} sub={`${money(x.summary.essentials)} essentials · ${money(x.summary.debtPayments)} debt`} />
        <OverviewTile icon={<PiggyBank size={17} />} tone="green" label="Planned savings / mo" value={money(x.summary.plannedSavings)} sub={`${Math.round(x.summary.savingsRate * 100)}% of take-home`} />
      </div>
      <div className="grid g-2 mt-16">
        <Card title="Liabilities" subtitle="Owed — never counted as spendable cash">
          {liabilities.length === 0 ? <div className="small muted">No debts on file.</div> : liabilities.map((a) => (
            <div className="list-item" key={a.id}>
              <div className="icon-chip red"><CreditCard size={17} /></div>
              <div style={{ flex: 1 }}><div className="strong">{a.name}</div><div className="small muted">{((a.apr ?? 0) * 100).toFixed(2)}% APR · {money(a.plannedPayment ?? 0)}/mo · payoff {x.baseline.debtPayoffDates[a.id] ? fmtDate(x.baseline.debtPayoffDates[a.id]) : 'beyond 5 years'}</div></div>
              <div className="strong num neg">−{money(a.balance)}</div>
            </div>
          ))}
        </Card>
        <Card title="Investments" subtitle="Retirement assets — withdrawal restrictions and taxes may apply">
          {investments.length === 0 ? <div className="small muted">No investment accounts on file.</div> : investments.map((a) => (
            <div className="list-item" key={a.id}>
              <div className="icon-chip blue"><TrendingUp size={17} /></div>
              <div style={{ flex: 1 }}><div className="strong">{a.name}</div><div className="small muted">{a.institution}{x.match ? ` · employer adds ${x.match.matchPercentNow}% of pay` : ''}</div></div>
              <div className="strong num">{money(a.balance)}</div>
            </div>
          ))}
        </Card>
      </div>

      <div className="grid g-main mt-16">
        {/* D. Goals */}
        <Card title="Goal progress" action={<button className="link-btn" onClick={() => setTab('goals')}>View all goals <ArrowRight size={15} /></button>}>
          {topGoals.length === 0 ? (
            <div className="empty"><div className="icon-chip green"><Sparkles size={18} /></div>No goals yet.<div className="mt-12"><button className="btn btn-primary btn-sm" onClick={() => setTab('goals')}>Add a goal</button></div></div>
          ) : (
            <div className="list">{topGoals.map((g) => <GoalRow key={g.id} goal={g} a={x.goalAnalyses[g.id]} onClick={() => { openGoal(g.id); setTab('goals'); }} />)}</div>
          )}
        </Card>

        {/* F. Weekly consistency */}
        <Card title="Weekly consistency" action={<button className="link-btn" onClick={() => setTab('garden')}>Garden <ArrowRight size={15} /></button>}>
          <div className="grid g-3" style={{ gap: 10 }}>
            <div><div className="metric-label">Streak</div><div className="metric row" style={{ gap: 6 }}><Flame size={20} color="var(--warning)" />{d.garden.currentStreak} wk</div></div>
            <div><div className="metric-label">Points</div><div className="metric">{d.garden.pointsBalance}</div></div>
            <div><div className="metric-label">Successful</div><div className="metric">{d.garden.successfulWeeks}</div></div>
          </div>
          <div className="mt-16">
            <div className="row-between small"><span className="strong">This week</span><span className="muted num">{money(week.discretionarySpent)} / {money(week.allowance)}</span></div>
            <div className="mt-8"><Progress value={week.allowance ? week.discretionarySpent / week.allowance : 0} tone={week.withinAllowance ? 'sage' : 'warn'} label="Weekly discretionary spending" /></div>
            <p className="small muted mt-8">
              {week.withinAllowance ? `Stay under ${money(week.allowance)} in discretionary spending and pay essentials on time to earn ${POINTS.weeklyBase} points${d.garden.currentStreak > 0 ? ` plus a streak bonus` : ''}.` : 'This week ran over the allowance. A fresh week starts Monday — no penalty, just a new chance.'}
            </p>
          </div>
          <div className="row mt-12 small muted"><Flower2 size={15} /> Emergency fund {Math.round(efPct * 100)}% funded — unlocks new garden items at 75% and 100%.</div>
        </Card>
      </div>

      <div className="grid g-2 mt-16">
        {/* E. Audit */}
        <Card title="Financial health audit" subtitle={`${auditSum.done} of ${auditSum.total} milestones complete`} action={<button className="link-btn" onClick={() => setTab('plan')}>Full audit <ArrowRight size={15} /></button>}>
          <AuditList items={audit} compact />
        </Card>

        {/* G. Recent activity */}
        <Card title="Recent activity" subtitle={isDemo ? 'Transactions are simulated demo data' : undefined}>
          <div className="list">
            {feed.map((f) => (
              <div className="list-item" key={f.key}>
                <div className={`icon-chip ${f.kind === 'simulation' ? 'blue' : f.kind === 'tx' ? '' : 'green'}`}>
                  {f.kind === 'simulation' ? <ShoppingBag size={16} /> : f.kind === 'tx' ? (f.amount !== null && f.amount > 0 ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />) : <Sparkles size={16} />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="strong" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.title}</div>
                  <div className="tiny muted">{fmtDate(f.date, { year: false })} · {f.sub}{f.tag && f.kind !== 'tx' ? '' : ''}</div>
                </div>
                <div className="stack-sm" style={{ alignItems: 'flex-end', gap: 2 }}>
                  {f.amount !== null && <span className={`strong num small ${f.kind === 'tx' && f.amount > 0 ? 'pos' : ''}`}>{f.kind === 'tx' ? money(f.amount, { sign: true, exact: true }) : money(f.amount)}</span>}
                  {f.kind !== 'tx' && <span className={`badge ${f.kind === 'simulation' ? 'badge-info' : 'badge-primary'}`} style={{ height: 20, fontSize: 11 }}>{f.tag}</span>}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Modal open={breakdown} onClose={() => setBreakdown(false)} wide title="Safe-to-spend breakdown" subtitle={`For ${fmtDate(s.periodStart, { year: false })} – ${fmtDate(s.periodEnd)}`}>
        <SafeToSpendBreakdown s={s} />
      </Modal>
    </div>
  );
}

function MiniStat({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub: string }) {
  return (
    <div style={{ background: 'var(--surface-2)', borderRadius: 12, padding: '10px 12px' }}>
      <div className="row tiny muted" style={{ gap: 6 }}>{icon}{label}</div>
      <div className="metric-sm mt-8">{value}</div>
      <div className="tiny faint">{sub}</div>
    </div>
  );
}

function OverviewTile({ icon, label, value, sub, tone }: { icon: React.ReactNode; label: string; value: string; sub: string; tone: string }) {
  return (
    <div className="card">
      <div className="row"><div className={`icon-chip ${tone}`}>{icon}</div><span className="metric-label">{label}</span></div>
      <div className="metric mt-12">{value}</div>
      <div className="tiny muted mt-8">{sub}</div>
    </div>
  );
}
