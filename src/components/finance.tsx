import { Car, GraduationCap, Home as HomeIcon, Palmtree, PiggyBank, Sparkles, Umbrella } from 'lucide-react';
import type { FinancialGoal, GoalCategory } from '../engine/types';
import type { SafeToSpend } from '../engine/plan';
import type { GoalAnalysis } from '../engine/goals';
import { TRACK_LABEL } from '../engine/goals';
import { KV, MathToggle, Progress } from './ui';
import { fmtDate } from '../lib/dates';
import { money } from '../lib/money';

export const GOAL_ICON: Record<GoalCategory, typeof Car> = {
  emergency: Umbrella, car: Car, housing: HomeIcon, education: GraduationCap, travel: Palmtree, retirement: PiggyBank, custom: Sparkles,
};
export const GOAL_CATEGORY_LABEL: Record<GoalCategory, string> = {
  emergency: 'Emergency fund', car: 'Car', housing: 'Housing', education: 'Education / student loans', travel: 'Travel', retirement: 'Retirement', custom: 'Custom',
};

export function trackBadge(a: GoalAnalysis) {
  const tone = a.track === 'complete' || a.track === 'on_track' ? 'badge-success' : a.track === 'behind' || a.track === 'no_contribution' ? 'badge-warning' : a.track === 'overdue' ? 'badge-negative' : '';
  return <span className={`badge ${tone}`}>{TRACK_LABEL[a.track]}</span>;
}

export function GoalRow({ goal, a, onClick }: { goal: FinancialGoal; a: GoalAnalysis; onClick?: () => void }) {
  const Icon = GOAL_ICON[goal.category];
  return (
    <div className="list-item" style={{ cursor: onClick ? 'pointer' : undefined }} onClick={onClick} role={onClick ? 'button' : undefined} aria-label={onClick ? `Open ${goal.name}` : undefined} tabIndex={onClick ? 0 : undefined}
      onKeyDown={(e) => { if (onClick && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onClick(); } }}>
      <div className="icon-chip green"><Icon size={18} /></div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="row-between">
          <span className="strong">{goal.name}</span>
          <span className="small num"><strong>{money(goal.currentSavedAmount)}</strong> <span className="faint">/ {money(goal.targetAmount)}</span></span>
        </div>
        <div className="mt-8"><Progress value={a.percent} label={`${goal.name} progress`} /></div>
        <div className="row-between mt-8 small">
          <span className="muted">{a.track === 'complete' ? 'Complete' : `${money(a.remaining)} to go · est. ${a.projectedCompletionDate ? fmtDate(a.projectedCompletionDate) : 'no date yet'}`}</span>
          {trackBadge(a)}
        </div>
      </div>
    </div>
  );
}

export function SafeToSpendBreakdown({ s }: { s: SafeToSpend }) {
  return (
    <div className="stack">
      <div className="grid g-2">
        <div>
          <div className="eyebrow">Budget limit</div>
          <KV k="Discretionary budget" v={money(s.discretionaryBudget)} />
          {s.unallocatedAvailable > 0 && <KV k="Unassigned savings capacity" v={money(s.unallocatedAvailable)} />}
          <KV k="Already spent this month" v={`−${money(s.discretionarySpent)}`} />
          {s.plannedPurchasesReserved > 0 && <KV k="Planned purchases still due" v={`−${money(s.plannedPurchasesReserved)}`} />}
          <KV k="Remaining" v={money(s.budgetRemaining)} total />
        </div>
        <div>
          <div className="eyebrow">Cash limit</div>
          <KV k="Checking now" v={money(s.checking)} />
          <KV k={`Paychecks still expected${s.incomeExpectedDates.length ? ` (${s.incomeExpectedDates.map((d) => fmtDate(d, { year: false })).join(', ')})` : ''}`} v={`+${money(s.incomeExpected)}`} />
          <KV k="Essential bills still due" v={`−${money(s.essentialsReserved)}`} />
          <KV k="Debt payments still due" v={`−${money(s.debtReserved)}`} />
          <KV k="Savings transfers still due" v={`−${money(s.savingsReserved)}`} />
          {s.plannedPurchasesReserved > 0 && <KV k="Planned purchases still due" v={`−${money(s.plannedPurchasesReserved)}`} />}
          <KV k="Cash buffer kept aside" v={`−${money(s.buffer)}`} />
          <KV k="Remaining" v={money(s.cashBased)} total />
        </div>
      </div>
      <div className={`callout ${s.shortfall ? 'neg' : 'good'}`}>
        <div>
          Safe to spend through {fmtDate(s.periodEnd, { year: false })} is the smaller of the two: <strong>{money(s.safeToSpend)}</strong> ({s.binding === 'budget' ? 'your budget' : 'your cash'} is the binding limit).
          {s.shortfall && ' This is a shortfall: planned commitments exceed what is available.'}
        </div>
      </div>
      <MathToggle>
        <h4>Formula</h4>
        <div className="formula">{`Budget limit = discretionary budget − discretionary spent this month${s.unallocatedAvailable ? ' + unassigned capacity' : ''} − planned purchases due
Cash limit   = checking + paychecks expected before month end
               − Σ max(0, planned − already paid) for bills, debt and savings
               − planned purchases due − cash buffer
Safe to spend = min(budget limit, cash limit)`}</div>
        <h4>Why "still due"</h4>
        <p className="muted">Anything already paid this month is already reflected in your checking balance, so only the unpaid remainder of each bill, debt payment and savings transfer is reserved. Nothing is counted twice.</p>
        <h4>Your numbers</h4>
        <div className="formula">{`Budget: ${money(s.discretionaryBudget)}${s.unallocatedAvailable ? ` + ${money(s.unallocatedAvailable)}` : ''} − ${money(s.discretionarySpent)}${s.plannedPurchasesReserved ? ` − ${money(s.plannedPurchasesReserved)}` : ''} = ${money(s.budgetRemaining)}
Cash:   ${money(s.checking)} + ${money(s.incomeExpected)} − ${money(s.essentialsReserved)} − ${money(s.debtReserved)} − ${money(s.savingsReserved)}${s.plannedPurchasesReserved ? ` − ${money(s.plannedPurchasesReserved)}` : ''} − ${money(s.buffer)} = ${money(s.cashBased)}`}</div>
      </MathToggle>
    </div>
  );
}

