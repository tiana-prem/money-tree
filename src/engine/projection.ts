import type {
  CashEvent, Cents, FinancialGoal, ISODate, PaymentPlan, ProjectionResult, ProjectionSnapshot, PurchaseScenario, RecurrenceInterval, RecurringCommitment,
} from './types';
import { monthlyNetIncome, payDatesBetween } from './income';
import { EngineInputs, goalMonthlyContribution, isGoalComplete, liabilities, monthToDate, savingsBalance, sortByPriority } from './plan';
import { DAY_MS, addDays, addMonths, diffDays, endOfMonth, monthKey, parseISO, startOfMonth, toISO } from '../lib/dates';
import { sum } from '../lib/money';

/** Months simulated internally so milestone dates beyond the chart horizon can still be found. */
export const MILESTONE_HORIZON_MONTHS = 60;

/** Standard amortized payment: P·r / (1 − (1+r)^−n); zero-interest plans split evenly. */
export function installmentPayment(principal: Cents, months: number, aprPercent: number): Cents {
  if (months <= 0) return principal;
  const r = aprPercent / 100 / 12;
  if (r === 0) return Math.ceil(principal / months);
  return Math.round((principal * r) / (1 - Math.pow(1 + r, -months)));
}

function stepDate(d: ISODate, interval: RecurrenceInterval, k: number): ISODate {
  if (interval === 'weekly') return addDays(d, 7 * k);
  if (interval === 'monthly') return addMonths(d, k);
  return addMonths(d, 12 * k);
}

/** Expand a recurring series into dated events up to `until`. */
function expandSeries(start: ISODate, interval: RecurrenceInterval, occurrences: number | null, amount: Cents, until: ISODate, base: Omit<CashEvent, 'date' | 'amount'>): CashEvent[] {
  const out: CashEvent[] = [];
  for (let k = 0; ; k++) {
    if (occurrences !== null && k >= occurrences) break;
    const d = stepDate(start, interval, k);
    if (d > until) break;
    out.push({ ...base, date: d, amount });
  }
  return out;
}

export function expandCommitment(r: RecurringCommitment, until: ISODate): CashEvent[] {
  return expandSeries(r.startDate, r.interval, r.occurrences, r.amount, until, { label: r.label, source: 'planned', refId: r.id });
}

/** Cash outflows for a purchase scenario item, honoring recurrence and installment plans. */
export function expandPurchase(p: Pick<PurchaseScenario, 'id' | 'customName' | 'price' | 'plannedDate' | 'recurrence' | 'payment'>, until: ISODate, source: CashEvent['source'] = 'scenario'): CashEvent[] {
  const base = { label: p.customName, source, refId: p.id };
  if (p.recurrence) return expandSeries(p.plannedDate, p.recurrence.interval, p.recurrence.occurrences, p.price, until, base);
  const pay: PaymentPlan = p.payment;
  if (pay.type === 'installments' && pay.months > 1) {
    const amt = installmentPayment(p.price, pay.months, pay.aprPercent);
    const events = expandSeries(p.plannedDate, 'monthly', pay.months, amt, until, base);
    // Make the final zero-APR installment absorb rounding so the total equals the price exactly.
    if (pay.aprPercent === 0 && events.length === pay.months) events[events.length - 1].amount = p.price - amt * (pay.months - 1);
    return events;
  }
  return p.plannedDate <= until ? [{ ...base, date: p.plannedDate, amount: p.price }] : [];
}

export function totalPurchaseCost(p: Pick<PurchaseScenario, 'price' | 'recurrence' | 'payment' | 'plannedDate'>, horizonMonths = 12): Cents {
  if (p.recurrence) {
    const until = addDays(addMonths(p.plannedDate, horizonMonths), -1);
    return sum(expandSeries(p.plannedDate, p.recurrence.interval, p.recurrence.occurrences, p.price, until, { label: '', source: 'scenario', refId: '' }).map((e) => e.amount));
  }
  if (p.payment.type === 'installments' && p.payment.months > 1) {
    if (p.payment.aprPercent === 0) return p.price;
    return installmentPayment(p.price, p.payment.months, p.payment.aprPercent) * p.payment.months;
  }
  return p.price;
}

export interface ProjectionOptions {
  scenarioId: string;
  months?: number;
  /** Extra outflows layered on top of the baseline plan (simulated purchases). */
  extraEvents?: CashEvent[];
  /** Optional overrides applied to inputs before projecting (used to evaluate alternatives). */
  discretionaryDelta?: Cents;
  /** Number of full months the discretionary delta applies to (default: all). */
  discretionaryDeltaMonths?: number;
  goalContributionOverrides?: Record<string, Cents>;
}

/**
 * Deterministic month-by-month projection.
 *
 * Period 0 is the rest of the current month (today → month end); periods 1..N are full calendar months.
 * Ordering inside every period, identical for all scenarios:
 *   1. income              2. essential spending         3. discretionary budget
 *   4. debt payments (interest accrues first)            5. scheduled goal contributions (priority order)
 *   6. one-time purchases  7. recurring purchases/commitments
 *   8. buffer protection — if checking < buffer, pause this period's contributions, lowest priority first
 *   9. surplus sweep     — if enabled, cash above the buffer goes to goals in priority order
 *  10. record balances, completion dates and any shortfall (negative checking is never hidden)
 *
 * Period 0 only counts what is still due this month (planned − already paid), so nothing is double-counted.
 * Full months use the monthly planning basis (annualized pay ÷ 12). No investment returns or savings interest are assumed.
 */
export function project(inp: EngineInputs, opts: ProjectionOptions): ProjectionResult {
  const months = opts.months ?? MILESTONE_HORIZON_MONTHS;
  const { today, plan, prefs } = inp;
  const mtd = monthToDate(inp.transactions, today);
  const horizonEnd = endOfMonth(addMonths(startOfMonth(today), months));

  const events: CashEvent[] = [
    ...plan.plannedPurchases.filter((p) => p.date >= today).map((p): CashEvent => ({ date: p.date, amount: p.amount, label: p.label, source: 'planned', refId: p.id })),
    ...plan.recurringCommitments.flatMap((r) => expandCommitment(r, horizonEnd)).filter((e) => e.date >= today),
    ...(opts.extraEvents ?? []).filter((e) => e.date >= today),
  ];

  const goals: FinancialGoal[] = sortByPriority(inp.goals);
  const goalBal: Record<string, Cents> = {};
  const completion: Record<string, ISODate | null> = {};
  for (const g of goals) {
    goalBal[g.id] = g.currentSavedAmount;
    completion[g.id] = isGoalComplete(g) ? today : null;
  }
  const monthlyContrib = (g: FinancialGoal): Cents => opts.goalContributionOverrides?.[g.id] ?? goalMonthlyContribution(g, plan);
  const fundable = (g: FinancialGoal) => g.status === 'active' && completion[g.id] === null;

  const debts = liabilities(inp.accounts).map((a) => ({ id: a.id, bal: a.balance, apr: a.apr ?? 0, payment: a.plannedPayment ?? 0 }));
  const payoff: Record<string, ISODate | null> = {};
  for (const d of debts) payoff[d.id] = d.bal <= 0 ? today : null;

  // Savings not assigned to any goal stays constant (no interest assumed).
  const unassignedSavings = Math.max(0, savingsBalance(inp.accounts) - sum(goals.map((g) => g.currentSavedAmount)));

  let cash = sum(inp.accounts.filter((a) => a.type === 'checking').map((a) => a.balance));
  const essentialsMonthly = sum(plan.essentialExpenses.map((l) => l.amount));
  const discretionaryBase = sum(plan.discretionaryBudgets.map((l) => l.amount));
  const discretionaryFor = (p: number) =>
    Math.max(0, discretionaryBase + (opts.discretionaryDeltaMonths === undefined || p <= opts.discretionaryDeltaMonths ? opts.discretionaryDelta ?? 0 : 0));
  const netMonthly = monthlyNetIncome(plan.income);
  const snapshots: ProjectionSnapshot[] = [];
  let totalInterest = 0;
  const shortfallPeriods: number[] = [];

  for (let p = 0; p <= months; p++) {
    const periodStart = p === 0 ? today : startOfMonth(addMonths(startOfMonth(today), p));
    const periodEnd = endOfMonth(periodStart);
    const periodDays = diffDays(periodEnd, periodStart) + 1;
    const first = p === 0;

    // 1. income
    let income: Cents;
    if (first) {
      income = plan.income.mode === 'paycheck'
        ? payDatesBetween(plan.income, addDays(today, 1), periodEnd).length * plan.income.netPerPaycheck
        : Math.max(0, plan.income.monthlyEstimate - mtd.incomeReceived);
    } else income = netMonthly;
    cash += income;

    // 2–3. planned spending (period 0: only the unspent remainder of each budget line)
    const essentials = first ? sum(plan.essentialExpenses.map((l) => Math.max(0, l.amount - (mtd.spentByLine[l.id] ?? 0)))) : essentialsMonthly;
    // A discretionary adjustment (used by alternatives) starts with the first full month.
    const discretionary = first
      ? sum(plan.discretionaryBudgets.map((l) => Math.max(0, l.amount - (mtd.spentByLine[l.id] ?? 0))))
      : discretionaryFor(p);
    cash -= essentials + discretionary;

    // 4. debts: interest accrues, then the planned payment is made
    let debtPaid = 0;
    let interestCharged = 0;
    const debtBalances: Record<string, Cents> = {};
    for (const d of debts) {
      if (d.bal > 0) {
        const interestFrac = first ? periodDays / 30 : 1;
        const interest = Math.round(d.bal * (d.apr / 12) * interestFrac);
        const due = first ? Math.max(0, d.payment - (mtd.debtPaidByAccount[d.id] ?? 0)) : d.payment;
        const owed = d.bal + interest;
        const pay = Math.min(due, owed);
        d.bal = owed - pay;
        cash -= pay;
        debtPaid += pay;
        interestCharged += interest;
        if (d.bal <= 0 && payoff[d.id] === null) {
          const frac = pay > 0 ? Math.min(1, owed / pay) : 1;
          payoff[d.id] = addDays(periodStart, Math.max(0, Math.round(frac * periodDays) - 1));
        }
      }
      debtBalances[d.id] = d.bal;
    }
    totalInterest += interestCharged;

    // 5. scheduled goal contributions
    const scheduled: Record<string, Cents> = {};
    const funded: Record<string, Cents> = {};
    // Money offered to each goal this period before capping at its target; used to place the completion day.
    const offered: Record<string, Cents> = {};
    for (const g of goals) {
      if (!fundable(g)) continue;
      const planned = first ? Math.max(0, monthlyContrib(g) - (mtd.transferredByGoal[g.id] ?? 0)) : monthlyContrib(g);
      const c = Math.min(planned, inp.goals.find((x) => x.id === g.id)!.targetAmount - goalBal[g.id]);
      scheduled[g.id] = Math.max(0, c);
      offered[g.id] = Math.max(0, planned);
      funded[g.id] = scheduled[g.id];
      cash -= funded[g.id];
    }

    // 6–7. purchases and recurring outflows dated in this period
    const periodEvents = events.filter((e) => e.date >= periodStart && e.date <= periodEnd);
    const purchases = sum(periodEvents.filter((e) => !isRecurringEvent(e, plan.recurringCommitments, opts)).map((e) => e.amount));
    const recurring = sum(periodEvents.map((e) => e.amount)) - purchases;
    cash -= purchases + recurring;

    // 8. buffer protection: pause contributions, lowest priority first
    const paused: Record<string, Cents> = {};
    if (prefs.protectCashBuffer && cash < plan.cashBuffer) {
      let need = plan.cashBuffer - cash;
      for (const g of [...goals].reverse()) {
        if (need <= 0) break;
        const take = Math.min(funded[g.id] ?? 0, need);
        if (take > 0) {
          funded[g.id] -= take;
          offered[g.id] = funded[g.id];
          paused[g.id] = take;
          cash += take;
          need -= take;
        }
      }
    }

    // 9. sweep surplus above the buffer into goals by priority
    const swept: Record<string, Cents> = {};
    if (prefs.sweepSurplusToGoals && cash > plan.cashBuffer) {
      let extra = cash - plan.cashBuffer;
      for (const g of goals) {
        if (extra <= 0) break;
        if (!fundable(g)) continue;
        const room = inp.goals.find((x) => x.id === g.id)!.targetAmount - goalBal[g.id] - (funded[g.id] ?? 0);
        // Already filled by its scheduled transfer: the surplus still counts toward how fast it filled.
        if (room <= 0) { offered[g.id] = (offered[g.id] ?? 0) + extra; continue; }
        const add = Math.max(0, Math.min(extra, room));
        if (add > 0) {
          offered[g.id] = (offered[g.id] ?? 0) + extra;
          swept[g.id] = add;
          funded[g.id] = (funded[g.id] ?? 0) + add;
          cash -= add;
          extra -= add;
        }
      }
    }

    // 10. apply contributions and detect completion (contributions assumed to accrue evenly through the period)
    for (const g of goals) {
      const c = funded[g.id] ?? 0;
      if (c <= 0) continue;
      const target = inp.goals.find((x) => x.id === g.id)!.targetAmount;
      const before = goalBal[g.id];
      goalBal[g.id] = before + c;
      if (completion[g.id] === null && goalBal[g.id] >= target) {
        const frac = (target - before) / Math.max(c, offered[g.id] ?? 0);
        completion[g.id] = toISO(new Date(parseISO(periodStart).getTime() + Math.max(0, Math.ceil(frac * periodDays) - 1) * DAY_MS));
      }
    }

    const shortfall = cash < 0 ? -cash : 0;
    if (shortfall > 0) shortfallPeriods.push(p);

    snapshots.push({
      id: `${opts.scenarioId}-${p}`,
      scenarioId: opts.scenarioId,
      period: p,
      monthKey: monthKey(periodStart),
      periodStart, periodEnd,
      income, essentials, discretionary, debtPaid, interestCharged, purchases, recurring,
      contributions: { ...funded },
      scheduledContributions: scheduled,
      pausedContributions: paused,
      sweptContributions: swept,
      projectedCash: cash,
      projectedSavings: sum(Object.values(goalBal)) + unassignedSavings,
      projectedDebt: sum(Object.values(debtBalances)),
      goalBalances: { ...goalBal },
      debtBalances,
      cashFlowShortfall: shortfall,
      belowBuffer: cash < plan.cashBuffer,
      events: periodEvents,
    });
  }

  return { scenarioId: opts.scenarioId, startDate: today, snapshots, goalCompletionDates: completion, debtPayoffDates: payoff, totalInterest, shortfallPeriods, horizonMonths: months };
}

/** Recurring commitments and recurring/installment scenario items are reported as "recurring". */
function isRecurringEvent(e: CashEvent, commitments: RecurringCommitment[], opts: ProjectionOptions): boolean {
  if (e.source === 'planned') return commitments.some((c) => c.id === e.refId);
  const same = (opts.extraEvents ?? []).filter((x) => x.refId === e.refId);
  return same.length > 1;
}
