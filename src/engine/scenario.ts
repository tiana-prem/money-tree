import type { CashEvent, Cents, FinancialGoal, ISODate, Product, ProjectionResult, PurchaseScenario } from './types';
import { EngineInputs, SafeToSpend, recurringMonthlyEquivalent, safeToSpend, sortByPriority, summarizePlan } from './plan';
import { MILESTONE_HORIZON_MONTHS, expandPurchase, installmentPayment, project, totalPurchaseCost } from './projection';
import { nextPayDate } from './income';
import { addDays, addMonths, diffDays, endOfMonth, fmtDate, monthKey, startOfMonth } from '../lib/dates';
import { money, sum } from '../lib/money';

export type ImpactKind = 'no_change' | 'delayed' | 'earlier' | 'pushed_beyond' | 'not_reached' | 'already_complete';

export interface GoalImpact {
  goalId: string;
  name: string;
  baselineDate: ISODate | null;
  scenarioDate: ISODate | null;
  /** Scenario − baseline in calendar days (null when either date is missing). */
  delayDays: number | null;
  kind: ImpactKind;
}

export interface ScenarioComparison {
  baseline: ProjectionResult;
  scenario: ProjectionResult;
  events: CashEvent[];
  goalImpacts: GoalImpact[];
  debtImpacts: { id: string; baselineDate: ISODate | null; scenarioDate: ISODate | null; delayDays: number | null }[];
  safeBefore: SafeToSpend;
  safeAfter: SafeToSpend;
  /** Period index of the first scenario outflow (−1 if none within the projection). */
  firstEventPeriod: number;
  horizon: number;
  cashAtHorizon: { before: Cents; after: Cents };
  savingsAtHorizon: { before: Cents; after: Cents };
  minCash: { before: Cents; after: Cents; afterPeriod: number };
  emergency: { goalId: string; target: Cents; before: Cents; after: Cents; atMonth: string } | null;
  newShortfallPeriods: number[];
  totalCostInHorizon: Cents;
  /** Monthly-equivalent ongoing cost of recurring items (0 for one-time). */
  monthlyRecurringCost: Cents;
  savingsCapacity: { before: Cents; after: Cents };
}

export function scenarioEvents(items: PurchaseScenario[], today: ISODate, months = MILESTONE_HORIZON_MONTHS): CashEvent[] {
  const until = endOfMonth(addMonths(startOfMonth(today), months));
  return items.filter((i) => i.included).flatMap((i) => expandPurchase(i, until));
}

export interface CompareOptions {
  horizon: number;
  discretionaryDelta?: Cents;
  discretionaryDeltaMonths?: number;
  /** Reuse an existing baseline (avoids recomputation). */
  baseline?: ProjectionResult;
}

function impactKind(b: ISODate | null, s: ISODate | null, goal: FinancialGoal, today: ISODate): ImpactKind {
  if (b === today && s === today && goal.currentSavedAmount >= goal.targetAmount) return 'already_complete';
  if (b && s) {
    const d = diffDays(s, b);
    return d > 0 ? 'delayed' : d < 0 ? 'earlier' : 'no_change';
  }
  if (b && !s) return 'pushed_beyond';
  if (!b && s) return 'earlier';
  return 'not_reached';
}

/**
 * Run the baseline and the scenario through the same projection engine and diff the results.
 * Goal delay = scenario completion date − baseline completion date (calendar days).
 */
export function compareScenario(inp: EngineInputs, items: PurchaseScenario[], opts: CompareOptions): ScenarioComparison {
  const baseline = opts.baseline ?? project(inp, { scenarioId: 'baseline' });
  const events = scenarioEvents(items, inp.today);
  const scenario = project(inp, {
    scenarioId: 'scenario', extraEvents: events,
    discretionaryDelta: opts.discretionaryDelta, discretionaryDeltaMonths: opts.discretionaryDeltaMonths,
  });

  const goalImpacts: GoalImpact[] = sortByPriority(inp.goals).map((g) => {
    const b = baseline.goalCompletionDates[g.id] ?? null;
    const s = scenario.goalCompletionDates[g.id] ?? null;
    return { goalId: g.id, name: g.name, baselineDate: b, scenarioDate: s, delayDays: b && s ? diffDays(s, b) : null, kind: impactKind(b, s, g, inp.today) };
  });
  const debtImpacts = Object.keys(baseline.debtPayoffDates).map((id) => {
    const b = baseline.debtPayoffDates[id];
    const s = scenario.debtPayoffDates[id];
    return { id, baselineDate: b, scenarioDate: s, delayDays: b && s ? diffDays(s, b) : null };
  });

  const h = Math.min(opts.horizon, baseline.snapshots.length - 1);
  const firstEventPeriod = events.length ? scenario.snapshots.findIndex((s) => s.events.some((e) => e.source === 'scenario')) : -1;
  const minOf = (r: ProjectionResult) => r.snapshots.slice(0, h + 1).reduce((m, s) => (s.projectedCash < m.v ? { v: s.projectedCash, p: s.period } : m), { v: Infinity, p: 0 });
  const minB = minOf(baseline);
  const minS = minOf(scenario);

  const ef = sortByPriority(inp.goals).find((g) => g.category === 'emergency');
  let emergency: ScenarioComparison['emergency'] = null;
  if (ef) {
    const at = Math.max(0, firstEventPeriod);
    emergency = {
      goalId: ef.id, target: ef.targetAmount,
      before: baseline.snapshots[at].goalBalances[ef.id],
      after: scenario.snapshots[at].goalBalances[ef.id],
      atMonth: baseline.snapshots[at].monthKey,
    };
  }

  const recurringItems = items.filter((i) => i.included && i.recurrence);
  const monthlyRecurringCost = sum(recurringItems.map((i) => recurringMonthlyEquivalent({ id: i.id, label: '', amount: i.price, interval: i.recurrence!.interval, startDate: i.plannedDate, occurrences: i.recurrence!.occurrences, source: 'manual' })));
  const installmentMonthly = sum(items.filter((i) => i.included && !i.recurrence && i.payment.type === 'installments').map((i) => i.payment.type === 'installments' ? installmentPayment(i.price, i.payment.months, i.payment.aprPercent) : 0));
  const capacityBefore = summarizePlan(inp).savingsCapacity;

  const horizonEnd = endOfMonth(addMonths(startOfMonth(inp.today), opts.horizon));
  return {
    baseline, scenario, events, goalImpacts, debtImpacts,
    safeBefore: safeToSpend(inp),
    safeAfter: safeToSpend(inp, events),
    firstEventPeriod, horizon: h,
    cashAtHorizon: { before: baseline.snapshots[h].projectedCash, after: scenario.snapshots[h].projectedCash },
    savingsAtHorizon: { before: baseline.snapshots[h].projectedSavings, after: scenario.snapshots[h].projectedSavings },
    minCash: { before: minB.v, after: minS.v, afterPeriod: minS.p },
    emergency,
    newShortfallPeriods: scenario.shortfallPeriods.filter((p) => p <= h && !baseline.shortfallPeriods.includes(p)),
    totalCostInHorizon: sum(events.filter((e) => e.date <= horizonEnd).map((e) => e.amount)),
    monthlyRecurringCost,
    savingsCapacity: { before: capacityBefore, after: capacityBefore - monthlyRecurringCost - installmentMonthly },
  };
}

/* ------------------------------------------------------------------ */
/* Alternatives: each is a modified copy of the scenario, run independently. */

export interface Alternative {
  id: string;
  title: string;
  description: string;
  items: PurchaseScenario[];
  discretionaryDelta?: Cents;
  discretionaryDeltaMonths?: number;
  comparison: ScenarioComparison;
  /** Days the top affected goal moves vs. the current scenario (negative = sooner). */
  vsCurrent: { goalName: string; days: number } | null;
  costInHorizon: Cents;
}

export function buildAlternatives(inp: EngineInputs, items: PurchaseScenario[], selectedId: string, products: Product[], horizon: number, baseline: ProjectionResult, current: ScenarioComparison): Alternative[] {
  const sel = items.find((i) => i.id === selectedId);
  if (!sel || !sel.included) return [];
  const swap = (patch: Partial<PurchaseScenario>) => items.map((i) => (i.id === sel.id ? { ...i, ...patch } : i));
  const out: Omit<Alternative, 'comparison' | 'vsCurrent' | 'costInHorizon'>[] = [];

  const product = sel.productId ? products.find((p) => p.id === sel.productId) : undefined;
  const cheaper = product?.alternativeId ? products.find((p) => p.id === product.alternativeId) : undefined;
  if (cheaper) {
    out.push({ id: 'cheaper', title: `Choose ${cheaper.name}`, description: `A lower-cost option at ${money(cheaper.price)}${cheaper.recurring ? ' per occurrence' : ''} instead of ${money(sel.price)}.`, items: swap({ price: cheaper.price, customName: cheaper.name, productId: cheaper.id }) });
  } else if (!sel.recurrence && sel.price >= 20000) {
    const lower = Math.round((sel.price * 0.6) / 1000) * 1000;
    out.push({ id: 'cheaper', title: 'Spend 40% less on this purchase', description: `A lower-cost version at ${money(lower)} instead of ${money(sel.price)}.`, items: swap({ price: lower }) });
  }

  const payday = nextPayDate(inp.plan.income, sel.plannedDate > inp.today ? addDays(sel.plannedDate, -1) : inp.today);
  if (payday && payday !== sel.plannedDate) {
    out.push({ id: 'payday', title: `Wait until payday (${fmtDate(payday, { year: false })})`, description: 'Buy right after your next paycheck lands instead.', items: swap({ plannedDate: payday }) });
  }

  if (!sel.recurrence) {
    const later = addMonths(sel.plannedDate, 3);
    out.push({ id: 'later', title: `Save first, buy in 3 months (${fmtDate(later, { year: false })})`, description: 'Give your plan three more months of contributions before the purchase.', items: swap({ plannedDate: later }) });
  }

  const biggest = [...inp.plan.discretionaryBudgets].sort((a, b) => b.amount - a.amount)[0];
  if (biggest && biggest.amount >= 5000) {
    const cut = Math.max(2000, Math.round((biggest.amount * 0.25) / 1000) * 1000);
    const totalCost = totalPurchaseCost(sel, 12);
    const months = Math.min(12, Math.max(1, Math.ceil(totalCost / cut)));
    out.push({
      id: 'reduce', title: `Trim ${biggest.label.toLowerCase()} by ${money(cut)}/mo for ${months} month${months === 1 ? '' : 's'}`,
      description: `Temporarily lower your ${biggest.label.toLowerCase()} budget from ${money(biggest.amount)} to ${money(biggest.amount - cut)} to offset the purchase. Nothing changes unless you apply it.`,
      items, discretionaryDelta: -cut, discretionaryDeltaMonths: months,
    });
  }

  if (!sel.recurrence && sel.payment.type === 'full' && sel.price >= 30000) {
    const n = sel.price >= 500000 ? 36 : 6;
    const apr = sel.price >= 500000 ? 7.5 : 0;
    const pmt = installmentPayment(sel.price, n, apr);
    out.push({ id: 'installments', title: `Spread over ${n} months${apr ? ` at ${apr}% APR` : ' at 0% APR'}`, description: `${money(pmt)}/mo for ${n} months${apr ? `; ${money(pmt * n - sel.price)} total interest` : ''}. Only if a plan like this is actually offered to you.`, items: swap({ payment: { type: 'installments', months: n, aprPercent: apr } }) });
  }

  if (sel.recurrence && sel.recurrence.occurrences === null) {
    const k = sel.recurrence.interval === 'weekly' ? 26 : sel.recurrence.interval === 'monthly' ? 6 : 1;
    out.push({ id: 'shorter', title: `Commit for a limited trial (${k} ${sel.recurrence.interval === 'weekly' ? 'weeks' : sel.recurrence.interval === 'monthly' ? 'months' : 'year'})`, description: 'Compare an ongoing cost with a fixed-length commitment.', items: swap({ recurrence: { ...sel.recurrence, occurrences: k } }) });
  }

  const topImpact = (c: ScenarioComparison) => c.goalImpacts.find((g) => g.kind === 'delayed' || g.kind === 'pushed_beyond') ?? null;
  const currentTop = topImpact(current);
  return out.map((a) => {
    const comparison = compareScenario(inp, a.items, { horizon, baseline, discretionaryDelta: a.discretionaryDelta, discretionaryDeltaMonths: a.discretionaryDeltaMonths });
    let vsCurrent: Alternative['vsCurrent'] = null;
    if (currentTop) {
      const mine = comparison.goalImpacts.find((g) => g.goalId === currentTop.goalId)!;
      if (mine.scenarioDate && currentTop.scenarioDate) vsCurrent = { goalName: mine.name, days: diffDays(mine.scenarioDate, currentTop.scenarioDate) };
    }
    return { ...a, comparison, vsCurrent, costInHorizon: comparison.totalCostInHorizon };
  });
}


/* ------------------------------------------------------------------ */
/* "Show the math" — built only from the projection snapshots that produced the result. */

export interface MathLedgerRow {
  month: string;
  baselineContribution: Cents;
  scenarioContribution: Cents;
  baselineBalance: Cents;
  scenarioBalance: Cents;
  scenarioPurchases: Cents;
  paused: Cents;
}

export interface GoalMath {
  goal: FinancialGoal;
  startingCash: Cents;
  buffer: Cents;
  purchaseLines: { label: string; date: ISODate; amount: Cents }[];
  monthly: { net: Cents; essentials: Cents; discretionary: Cents; debt: Cents; recurring: Cents; scheduledContribution: Cents; unallocated: Cents };
  ledger: MathLedgerRow[];
  baselineDate: ISODate | null;
  scenarioDate: ISODate | null;
  delayDays: number | null;
  sweep: boolean;
  protect: boolean;
}

export function goalMath(inp: EngineInputs, cmp: ScenarioComparison, goalId: string): GoalMath {
  const goal = inp.goals.find((g) => g.id === goalId)!;
  const s = summarizePlan(inp);
  const impact = cmp.goalImpacts.find((g) => g.goalId === goalId)!;
  const lastRelevant = Math.min(
    cmp.baseline.snapshots.length - 1,
    Math.max(
      ...[impact.baselineDate, impact.scenarioDate].filter(Boolean).map((d) => cmp.baseline.snapshots.findIndex((x) => x.monthKey === monthKey(d!))),
      Math.max(0, cmp.firstEventPeriod) + 2,
    ),
  );
  const ledger: MathLedgerRow[] = [];
  for (let p = 0; p <= lastRelevant; p++) {
    const b = cmp.baseline.snapshots[p];
    const sc = cmp.scenario.snapshots[p];
    ledger.push({
      month: b.monthKey,
      baselineContribution: b.contributions[goalId] ?? 0,
      scenarioContribution: sc.contributions[goalId] ?? 0,
      baselineBalance: b.goalBalances[goalId],
      scenarioBalance: sc.goalBalances[goalId],
      scenarioPurchases: sum(sc.events.filter((e) => e.source === 'scenario').map((e) => e.amount)),
      paused: sc.pausedContributions[goalId] ?? 0,
    });
  }
  return {
    goal,
    startingCash: sum(inp.accounts.filter((a) => a.type === 'checking').map((a) => a.balance)),
    buffer: inp.plan.cashBuffer,
    purchaseLines: cmp.events.map((e) => ({ label: e.label, date: e.date, amount: e.amount })),
    monthly: { net: s.monthlyNet, essentials: s.essentials, discretionary: s.discretionary, debt: s.debtPayments, recurring: s.recurringCommitments, scheduledContribution: s.plannedSavings, unallocated: s.unallocated },
    ledger,
    baselineDate: impact.baselineDate,
    scenarioDate: impact.scenarioDate,
    delayDays: impact.delayDays,
    sweep: inp.prefs.sweepSurplusToGoals,
    protect: inp.prefs.protectCashBuffer,
  };
}

/* ------------------------------------------------------------------ */
/* Side-by-side options: each purchase evaluated alone against the same baseline. */

export interface OptionResult {
  item: PurchaseScenario;
  cmp: ScenarioComparison;
  /** Sum of positive goal delays in days (goals pushed beyond the projection are counted separately). */
  totalDelayDays: number;
  goalsPushedBeyond: number;
}

export function compareOptions(inp: EngineInputs, items: PurchaseScenario[], horizon: number, baseline: ProjectionResult): OptionResult[] {
  return items.map((item) => {
    const cmp = compareScenario(inp, [{ ...item, included: true }], { horizon, baseline });
    return {
      item, cmp,
      totalDelayDays: sum(cmp.goalImpacts.map((g) => Math.max(0, g.delayDays ?? 0))),
      goalsPushedBeyond: cmp.goalImpacts.filter((g) => g.kind === 'pushed_beyond').length,
    };
  });
}

/** Lower is better: goals pushed past the projection, then total delay, then cost. */
export function bestOption(options: OptionResult[]): OptionResult | null {
  return [...options].sort((a, b) => a.goalsPushedBeyond - b.goalsPushedBeyond || a.totalDelayDays - b.totalDelayDays || a.cmp.totalCostInHorizon - b.cmp.totalCostInHorizon)[0] ?? null;
}
