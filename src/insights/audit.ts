import type { AppData } from '../state/schema';
import type { Derived } from '../state/derive';
import type { Cents } from '../engine/types';
import { fmtDate, fmtMonth } from '../lib/dates';
import { money } from '../lib/money';

export type AuditStatus = 'done' | 'progress' | 'todo' | 'na';

export interface AuditItem {
  id: string;
  title: string;
  target: string;
  current: string;
  remaining: string;
  progress: number;
  status: AuditStatus;
  action: string;
  /** If true, the user may mark it not applicable. */
  canNA: boolean;
  remainingCents?: Cents;
}

/** DegreeWorks-style checklist. Every value is read from the plan and the engine. */
export function buildAudit(d: AppData, x: Derived): AuditItem[] {
  const items: AuditItem[] = [];
  const na = new Set(d.auditNotApplicable);

  // 1. Emergency fund = 3 months of essential expenses
  const target = 3 * x.summary.essentials;
  const ef = d.goals.find((g) => g.category === 'emergency');
  const saved = ef ? ef.currentSavedAmount : d.accounts.filter((a) => a.type === 'savings').reduce((s, a) => s + a.balance, 0);
  const efDate = ef ? x.goalAnalyses[ef.id]?.projectedCompletionDate : null;
  items.push({
    id: 'emergency', title: 'Emergency fund: 3 months of essentials',
    target: money(target), current: money(saved), remaining: money(Math.max(0, target - saved)), remainingCents: Math.max(0, target - saved),
    progress: target > 0 ? Math.min(1, saved / target) : 0,
    status: saved >= target ? 'done' : saved > 0 ? 'progress' : 'todo',
    action: saved >= target ? 'Complete. Keep it in a separate, accessible savings account.' : ef ? `Projected to finish ${fmtDate(efDate)} at the current plan.` : 'Create an emergency fund goal on the Goals tab.',
    canNA: false,
  });

  // 2. Employer match
  if (x.match) {
    const m = x.match;
    items.push({
      id: 'match', title: 'Capture the full employer 401(k) match',
      target: `${m.fullMatchAt}% of pay`, current: `${m.employeePercent}% of pay`,
      remaining: m.capturingFull ? '—' : `${money(m.missedAnnual)}/yr unclaimed`,
      progress: m.maxMatch > 0 ? m.matchPercentNow / m.maxMatch : 1,
      status: na.has('match') ? 'na' : m.capturingFull ? 'done' : 'progress',
      action: m.capturingFull ? 'You are receiving the maximum match.' : `Raise your contribution by ${m.fullMatchAt - m.employeePercent} percentage point(s) — see Insights.`,
      canNA: true,
    });
  } else {
    items.push({ id: 'match', title: 'Capture the full employer 401(k) match', target: 'Depends on your employer', current: 'No match policy on file', remaining: '—', progress: 0, status: na.has('match') ? 'na' : 'todo', action: 'Add your paystub or employer match policy on the Plan tab, or mark this not applicable.', canNA: true });
  }

  // 3. High-interest debt strategy (APR ≥ 8%)
  const high = d.accounts.filter((a) => a.accountRole === 'liability' && (a.apr ?? 0) >= 0.08 && a.balance > 0);
  if (high.length === 0) {
    items.push({ id: 'debt', title: 'Plan to pay off high-interest debt', target: 'No balances above 8% APR', current: 'None', remaining: '—', progress: 1, status: na.has('debt') ? 'na' : 'done', action: 'No high-interest debt. Keep card balances paid in full.', canNA: true });
  } else {
    const total = high.reduce((s, a) => s + a.balance, 0);
    const dates = high.map((a) => x.baseline.debtPayoffDates[a.id]);
    const allPaidIn24 = dates.every((dt) => dt && dt <= x.baseline.snapshots[Math.min(24, x.baseline.snapshots.length - 1)].periodEnd);
    items.push({
      id: 'debt', title: 'Plan to pay off high-interest debt',
      target: '$0 above 8% APR', current: `${money(total)} across ${high.length} account${high.length > 1 ? 's' : ''}`,
      remaining: money(total), remainingCents: total, progress: allPaidIn24 ? 0.5 : 0.15,
      status: na.has('debt') ? 'na' : allPaidIn24 ? 'progress' : 'todo',
      action: allPaidIn24 ? `On track: paid off by ${fmtMonth(dates.sort().at(-1)!)}. Extra payments save interest.` : 'Current payments do not clear it within 2 years. Increase the planned payment.',
      canNA: true,
    });
  }

  // 4. Contributions to active goals
  const active = d.goals.filter((g) => g.status === 'active' && x.goalAnalyses[g.id]?.track !== 'complete');
  const funded = active.filter((g) => x.goalAnalyses[g.id].monthlyContribution > 0);
  items.push({
    id: 'goals', title: 'Contribute to every active savings goal',
    target: `${active.length} active goal${active.length === 1 ? '' : 's'} funded`, current: `${funded.length} with a contribution`,
    remaining: x.summary.overAllocated ? `${money(-x.summary.unallocated)}/mo over-allocated` : `${active.length - funded.length} without a contribution`,
    progress: active.length ? funded.length / active.length : 0,
    status: active.length === 0 ? 'todo' : funded.length === active.length && !x.summary.overAllocated ? 'done' : 'progress',
    action: active.length === 0 ? 'Add a goal to start saving toward something specific.' : x.summary.overAllocated ? 'Contributions exceed what the plan can fund. Adjust priorities.' : funded.length < active.length ? 'Add a contribution to each active goal.' : `${money(x.summary.plannedSavings)}/month across your goals.`,
    canNA: false,
  });

  // 5. Sustainable cash flow
  const h = d.profile.planningPreferences.horizonMonths;
  const shortfalls = x.baseline.shortfallPeriods.filter((p) => p <= h);
  const below = x.baseline.snapshots.slice(0, h + 1).filter((s) => s.belowBuffer).length;
  const ok = x.summary.savingsCapacity >= 0 && shortfalls.length === 0;
  items.push({
    id: 'cashflow', title: 'Maintain a sustainable cash-flow plan',
    target: 'No projected shortfalls; spending ≤ income', current: ok ? (below ? `Dips below buffer in ${below} month${below > 1 ? 's' : ''}` : 'Stable for the next ' + h + ' months') : shortfalls.length ? `Shortfall projected in ${fmtMonth(x.baseline.snapshots[shortfalls[0]].monthKey)}` : 'Spending exceeds income',
    remaining: ok ? '—' : money(Math.max(-x.summary.savingsCapacity, shortfalls.length ? x.baseline.snapshots[shortfalls[0]].cashFlowShortfall : 0)),
    progress: ok ? (below ? 0.7 : 1) : 0.2,
    status: ok ? (below ? 'progress' : 'done') : 'todo',
    action: ok ? `Monthly savings capacity ${money(x.summary.savingsCapacity)}.` : 'Reduce planned spending or remove a planned purchase on the Plan tab.',
    canNA: false,
  });
  return items;
}
