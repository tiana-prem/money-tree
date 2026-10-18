import type { AppData } from '../state/schema';
import type { Derived } from '../state/derive';
import type { Cents, Transaction } from '../engine/types';
import { project } from '../engine/projection';
import { sortByPriority } from '../engine/plan';
import { describeDays, diffDays, fmtDate, fmtMonth, monthKey, addMonths, startOfMonth } from '../lib/dates';
import { money } from '../lib/money';

export type RecCategory = 'retirement' | 'spending' | 'goals' | 'debt' | 'cashflow';

export type RecAction =
  | { kind: 'set_retirement'; percent: number; netReduction: Cents }
  | { kind: 'trim_budget'; lineId: string; cut: Cents; goalId: string }
  | { kind: 'extend_goal'; goalId: string; date: string }
  | { kind: 'raise_goal'; goalId: string; amount: Cents }
  | { kind: 'increase_debt'; accountId: string; amount: Cents }
  | { kind: 'update_line'; lineId: string; amount: Cents }
  | { kind: 'navigate'; tab: 'goals' | 'money' | 'simulate' };

export interface Recommendation {
  id: string;
  category: RecCategory;
  title: string;
  issue: string;
  reasoning: string;
  impact: string;
  impactValue: Cents | null;
  affectedGoalIds: string[];
  actionLabel: string;
  action: RecAction | null;
  math: { label: string; value: string }[];
  formula: string[];
  weight: number;
}

/** Actual spending per budget line, per calendar month. */
function actualsByMonth(txns: Transaction[]): Record<string, { byLine: Record<string, Cents> }> {
  const out: Record<string, { byLine: Record<string, Cents> }> = {};
  for (const t of txns) {
    if (t.transactionType !== 'expense') continue;
    const m = (out[monthKey(t.date)] ??= { byLine: {} });
    m.byLine[t.category] = (m.byLine[t.category] ?? 0) + t.amount;
  }
  return out;
}

export const CATEGORY_LABEL: Record<RecCategory, string> = {
  retirement: 'Retirement', spending: 'Spending', goals: 'Goals', debt: 'Debt', cashflow: 'Cash flow',
};

/** All recommendations are computed from engine outputs; nothing here is a fixed claim. */
export function buildRecommendations(d: AppData, x: Derived): Recommendation[] {
  const recs: Recommendation[] = [];
  const goals = sortByPriority(d.goals);
  const name = (id: string) => d.goals.find((g) => g.id === id)?.name ?? 'goal';

  // 1. Employer match
  if (x.match && !x.match.capturingFull && d.paystub) {
    const m = x.match;
    recs.push({
      id: 'match-gap', category: 'retirement', weight: 100,
      title: `Capture the full employer 401(k) match`,
      issue: `You contribute ${m.employeePercent}% of pay. Your employer's policy (${m.policy.description}) matches the maximum when you contribute ${m.fullMatchAt}%.`,
      reasoning: `At ${m.employeePercent}% you receive a ${m.matchPercentNow}% match; at ${m.fullMatchAt}% you would receive ${m.maxMatch}%. The difference is employer money you are not currently receiving.`,
      impact: `${money(m.missedAnnual)} per year in additional employer contributions`,
      impactValue: m.missedAnnual, affectedGoalIds: [],
      actionLabel: `Raise contribution to ${m.fullMatchAt}%`,
      action: { kind: 'set_retirement', percent: m.fullMatchAt, netReduction: m.extraPerPaycheck },
      math: [
        { label: 'Gross pay per paycheck', value: money(d.paystub.grossPay, { exact: true }) },
        { label: 'Annual gross (×24 for semimonthly)', value: money(m.annualGross) },
        { label: 'Match now', value: `${m.matchPercentNow}% × ${money(m.annualGross)} = ${money(m.annualMatchNow)}` },
        { label: 'Match at full contribution', value: `${m.maxMatch}% × ${money(m.annualGross)} = ${money(m.annualMatchMax)}` },
        { label: 'Extra pre-tax contribution per paycheck', value: money(m.extraPerPaycheck, { exact: true }) },
      ],
      formula: [
        'Match % = Σ over tiers of min(contribution left, tier width) × tier match rate',
        `Missed match = (${m.maxMatch}% − ${m.matchPercentNow}%) × annual gross = ${money(m.missedAnnual)}`,
        'Take-home falls by at most the extra contribution (less after the pre-tax benefit). Clover conservatively reduces net pay by the full amount if you accept.',
        '401(k) money is retirement savings with withdrawal restrictions and possible taxes or penalties; it is not spendable cash.',
      ],
    });
  }

  // 2. Trim the largest discretionary category toward a goal
  const target = goals.find((g) => x.goalAnalyses[g.id]?.track === 'behind') ?? goals.find((g) => g.category !== 'emergency' && x.goalAnalyses[g.id]?.track !== 'complete' && g.status === 'active');
  const actual = actualsByMonth(d.transactions);
  const recentMonths = [1, 2, 3].map((k) => monthKey(addMonths(startOfMonth(x.today), -k))).filter((k) => actual[k]);
  const lineAvg = (id: string) => (recentMonths.length ? Math.round(recentMonths.reduce((a, k) => a + (actual[k].byLine[id] ?? 0), 0) / recentMonths.length) : null);
  const ranked = [...d.plan.discretionaryBudgets].sort((a, b) => (lineAvg(b.id) ?? b.amount) - (lineAvg(a.id) ?? a.amount));
  const line = ranked[0];
  if (target && line && line.amount >= 4000) {
    const cut = Math.max(2000, Math.round((line.amount * 0.18) / 1000) * 1000);
    const contrib = x.goalAnalyses[target.id].monthlyContribution;
    const alt = project(x.inputs, { scenarioId: 'rec-trim', discretionaryDelta: -cut, goalContributionOverrides: { [target.id]: contrib + cut } });
    const b = x.baseline.goalCompletionDates[target.id];
    const s = alt.goalCompletionDates[target.id];
    const days = b && s ? diffDays(b, s) : null;
    const avg = lineAvg(line.id);
    recs.push({
      id: `trim-${line.id}-${target.id}`, category: 'spending', weight: 70,
      title: `Redirect ${money(cut)}/month from ${line.label.toLowerCase()} to ${target.name}`,
      issue: `${line.label} is your largest flexible category (${money(line.amount)} budgeted${avg !== null ? `, ${money(avg)} average actual over the last ${recentMonths.length} months` : ''}).`,
      reasoning: `Moving ${money(cut)} a month into ${target.name} adds ${money(cut * 12)} per year to that goal.`,
      impact: days !== null && days > 0 ? `${target.name} completes ${describeDays(days)} sooner (${fmtDate(s)} instead of ${fmtDate(b)})` : `${money(cut * 12)} more per year toward ${target.name}`,
      impactValue: cut * 12, affectedGoalIds: [target.id],
      actionLabel: `Lower ${line.label.toLowerCase()} to ${money(line.amount - cut)} and add ${money(cut)} to ${target.name}`,
      action: { kind: 'trim_budget', lineId: line.id, cut, goalId: target.id },
      math: [
        { label: `${line.label} budget`, value: `${money(line.amount)} → ${money(line.amount - cut)}` },
        { label: `${target.name} contribution`, value: `${money(contrib)} → ${money(contrib + cut)} per month` },
        { label: 'Baseline completion', value: fmtDate(b) },
        { label: 'With change', value: fmtDate(s) },
      ],
      formula: [`Annual impact = ${money(cut)} × 12 = ${money(cut * 12)}`, 'Completion dates come from re-running the full monthly projection with the adjusted budget and contribution.'],
    });
  }

  // 3. Over-allocation
  if (x.summary.overAllocated) {
    const short = x.allocation.filter((a) => a.shortfall > 0);
    recs.push({
      id: 'over-allocation', category: 'goals', weight: 95,
      title: 'Your goals ask for more than your plan can fund',
      issue: `Goal contributions total ${money(x.summary.plannedSavings)}/month, but only ${money(Math.max(0, x.summary.savingsCapacity))} is available after essentials, discretionary spending and debt payments.`,
      reasoning: 'Clover funds goals in priority order. Lower-priority goals will receive less than requested.',
      impact: `${money(-x.summary.unallocated)}/month over-allocated`,
      impactValue: -x.summary.unallocated, affectedGoalIds: short.map((s) => s.goalId),
      actionLabel: 'Review goal priorities', action: { kind: 'navigate', tab: 'goals' },
      math: short.map((s) => ({ label: name(s.goalId), value: `requests ${money(s.requested)}, funded ${money(s.funded)}` })),
      formula: ['Savings capacity = net income − essentials − discretionary − debt payments − recurring commitments', 'Over-allocation = total requested contributions − savings capacity'],
    });
  }

  // 4. Goals behind their target date
  for (const g of goals) {
    const a = x.goalAnalyses[g.id];
    if (a.track !== 'behind' || !g.targetDate) continue;
    const proj = a.projectedCompletionDate;
    const canRaise = a.gapMonthly !== null && a.gapMonthly > 0 && a.feasibleWithCapacity;
    recs.push({
      id: `behind-${g.id}`, category: 'goals', weight: 85,
      title: `${g.name} is projected to miss its target date`,
      issue: `Target ${fmtDate(g.targetDate)}; projected ${proj ? fmtDate(proj) : 'not within 5 years'}.`,
      reasoning: a.requiredMonthly !== null ? `Meeting the date requires about ${money(a.requiredMonthly)}/month; the plan currently contributes ${money(a.monthlyContribution)}/month.` : 'The target date is too close for the remaining amount.',
      impact: canRaise ? `Add ${money(a.gapMonthly!)}/month to stay on schedule` : proj ? `Moving the target to ${fmtDate(proj)} matches the projection` : 'Needs a larger contribution or later date',
      impactValue: a.gapMonthly, affectedGoalIds: [g.id],
      actionLabel: canRaise ? `Raise contribution to ${money(a.requiredMonthly!)}/month` : proj ? `Move target date to ${fmtDate(proj)}` : 'Open goal',
      action: canRaise ? { kind: 'raise_goal', goalId: g.id, amount: a.requiredMonthly! } : proj ? { kind: 'extend_goal', goalId: g.id, date: proj } : { kind: 'navigate', tab: 'goals' },
      math: [
        { label: 'Remaining', value: money(a.remaining) },
        { label: 'Months until target', value: a.monthsUntilTarget?.toFixed(1) ?? '—' },
        { label: 'Required per month', value: a.requiredMonthly !== null ? money(a.requiredMonthly) : '—' },
        { label: 'Unassigned capacity', value: money(Math.max(0, x.summary.unallocated)) },
      ],
      formula: ['Required monthly = remaining ÷ months until target (days ÷ 30.4375)'],
    });
  }

  // 5. High-interest debt
  const card = d.accounts.find((a) => a.accountRole === 'liability' && (a.apr ?? 0) >= 0.1 && a.balance > 0);
  if (card && x.summary.unallocated + x.summary.plannedSavings > 5000) {
    const extra = 5000;
    const alt = project({ ...x.inputs, accounts: d.accounts.map((a) => (a.id === card.id ? { ...a, plannedPayment: (a.plannedPayment ?? 0) + extra } : a)) }, { scenarioId: 'rec-debt' });
    const b = x.baseline.debtPayoffDates[card.id];
    const s = alt.debtPayoffDates[card.id];
    const saved = x.baseline.totalInterest - alt.totalInterest;
    recs.push({
      id: `debt-${card.id}`, category: 'debt', weight: 80,
      title: `Pay ${money(extra)} more per month on your ${card.name}`,
      issue: `${money(card.balance)} balance at ${(card.apr! * 100).toFixed(2)}% APR — higher than any guaranteed return on savings.`,
      reasoning: `At ${money(card.plannedPayment ?? 0)}/month the card is paid off ${b ? fmtMonth(b) : 'beyond the projection'}. An extra ${money(extra)} shortens that and reduces interest.`,
      impact: `${saved > 0 ? `${money(saved)} less interest` : 'Less interest'}${b && s ? `; paid off ${describeDays(diffDays(b, s))} sooner (${fmtMonth(s)})` : ''}`,
      impactValue: saved, affectedGoalIds: [],
      actionLabel: `Increase payment to ${money((card.plannedPayment ?? 0) + extra)}`,
      action: { kind: 'increase_debt', accountId: card.id, amount: (card.plannedPayment ?? 0) + extra },
      math: [
        { label: 'Balance', value: money(card.balance) },
        { label: 'Monthly interest now', value: `${money(card.balance)} × ${(card.apr! * 100).toFixed(2)}% ÷ 12 ≈ ${money(Math.round((card.balance * card.apr!) / 12), { exact: true })}` },
        { label: 'Payoff now', value: fmtDate(b) },
        { label: 'Payoff with extra', value: fmtDate(s) },
      ],
      formula: ['Each month: balance = balance + balance × APR ÷ 12 − payment', 'Interest saved = total projected interest (baseline) − total projected interest (with extra payment), across all debts'],
    });
  }

  // 7. Emergency-fund status (informational)
  const ef = goals.find((g) => g.category === 'emergency');
  if (ef && x.goalAnalyses[ef.id].track !== 'complete') {
    const date = x.goalAnalyses[ef.id].projectedCompletionDate;
    const months = date ? diffDays(date, x.today) / 30.4375 : null;
    recs.push({
      id: 'ef-status', category: 'goals', weight: 40,
      title: date ? `Your emergency fund is about ${months! < 1 ? 'less than a month' : `${Math.round(months!)} month${Math.round(months!) === 1 ? '' : 's'}`} from its target` : 'Your emergency fund has no projected completion date',
      issue: `${money(ef.currentSavedAmount)} of ${money(ef.targetAmount)} saved (3 months of essential expenses).`,
      reasoning: x.inputs.prefs.sweepSurplusToGoals ? `Your scheduled ${money(x.goalAnalyses[ef.id].monthlyContribution)}/month plus unassigned surplus (swept by priority) go here first.` : `Your scheduled contribution is ${money(x.goalAnalyses[ef.id].monthlyContribution)}/month.`,
      impact: date ? `Projected completion: ${fmtDate(date)}` : 'Add a contribution to get a date',
      impactValue: null, affectedGoalIds: [ef.id],
      actionLabel: 'Test a purchase against it', action: { kind: 'navigate', tab: 'simulate' },
      math: [{ label: 'Remaining', value: money(x.goalAnalyses[ef.id].remaining) }, { label: 'Projected completion', value: fmtDate(date) }],
      formula: ['Completion = first day the projected balance reaches the target (contributions assumed to accrue evenly within each month)'],
    });
  }

  // 7b. No emergency fund goal yet
  if (!ef) {
    const target = 3 * x.summary.essentials;
    recs.push({
      id: 'ef-missing', category: 'goals', weight: 90,
      title: 'Start an emergency fund',
      issue: `There's no emergency fund goal in your plan. Three months of essential expenses is ${money(target)}.`,
      reasoning: 'An emergency fund covers job changes, medical bills or car repairs without new debt. It is usually the first savings milestone.',
      impact: x.summary.unallocated > 0 ? `At your unassigned ${money(x.summary.unallocated)}/month, about ${Math.ceil(target / x.summary.unallocated)} months to fund` : 'Free up savings capacity to begin',
      impactValue: target, affectedGoalIds: [],
      actionLabel: 'Create the goal', action: { kind: 'navigate', tab: 'goals' },
      math: [{ label: 'Monthly essentials', value: money(x.summary.essentials) }, { label: 'Target (× 3)', value: money(target) }],
      formula: ['Emergency fund target = 3 × monthly essential expenses'],
    });
  }

  // 8. Projected cash shortfall
  const h = d.profile.planningPreferences.horizonMonths;
  const shortfalls = x.baseline.shortfallPeriods.filter((p) => p <= h);
  if (shortfalls.length) {
    const first = x.baseline.snapshots[shortfalls[0]];
    recs.push({
      id: 'shortfall', category: 'cashflow', weight: 98,
      title: `Projected cash shortfall in ${fmtMonth(first.monthKey)}`,
      issue: `Checking is projected to fall to ${money(first.projectedCash)} in ${fmtMonth(first.monthKey)}.`,
      reasoning: 'Planned obligations and purchases exceed the cash available that month.',
      impact: `${money(first.cashFlowShortfall)} short`, impactValue: first.cashFlowShortfall, affectedGoalIds: [],
      actionLabel: 'Review planned spending', action: { kind: 'navigate', tab: 'money' },
      math: [{ label: 'Income', value: money(first.income) }, { label: 'Essentials + discretionary', value: money(first.essentials + first.discretionary) }, { label: 'Debt', value: money(first.debtPaid) }, { label: 'Purchases + recurring', value: money(first.purchases + first.recurring) }],
      formula: ['Cash = previous cash + income − spending − debt − contributions − purchases'],
    });
  }

  // Preference-based personalization: categories the user has dismissed twice or more are ranked lower.
  const dismissedByCat: Record<string, number> = {};
  for (const fb of Object.values(d.recommendationFeedback)) if (fb.status === 'dismissed') dismissedByCat[fb.category] = (dismissedByCat[fb.category] ?? 0) + 1;
  return recs
    .map((r) => ({ ...r, weight: r.weight - (dismissedByCat[r.category] >= 2 ? 50 : 0) }))
    .sort((a, b) => b.weight - a.weight);
}

export function deprioritizedCategories(d: AppData): RecCategory[] {
  const c: Record<string, number> = {};
  for (const fb of Object.values(d.recommendationFeedback)) if (fb.status === 'dismissed') c[fb.category] = (c[fb.category] ?? 0) + 1;
  return Object.entries(c).filter(([, n]) => n >= 2).map(([k]) => k as RecCategory);
}
