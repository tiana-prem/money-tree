import type {
  BudgetPlan, Cents, FinancialAccount, FinancialGoal, ISODate, PlanningPreferences, RecurringCommitment, Transaction,
} from './types';
import { monthlyNetIncome, nextPayDate, payDatesBetween, toMonthly } from './income';
import { addDays, addMonths, endOfMonth, startOfMonth } from '../lib/dates';
import { sum } from '../lib/money';

/** Everything the engine needs. Built from app state by the store; never mutated by the engine. */
export interface EngineInputs {
  today: ISODate;
  plan: BudgetPlan;
  accounts: FinancialAccount[];
  goals: FinancialGoal[];
  transactions: Transaction[];
  prefs: PlanningPreferences;
}

export const liabilities = (accts: FinancialAccount[]) => accts.filter((a) => a.accountRole === 'liability');
export const cashAccounts = (accts: FinancialAccount[]) => accts.filter((a) => a.accountRole === 'cash');

export function checkingBalance(accts: FinancialAccount[]): Cents {
  return sum(accts.filter((a) => a.type === 'checking').map((a) => a.balance));
}
export function savingsBalance(accts: FinancialAccount[]): Cents {
  return sum(accts.filter((a) => a.type === 'savings').map((a) => a.balance));
}

export function isGoalComplete(g: FinancialGoal): boolean {
  return g.status === 'completed' || g.currentSavedAmount >= g.targetAmount;
}

/** Monthly-equivalent contribution for a goal (per-paycheck contributions are normalized). */
export function goalMonthlyContribution(g: FinancialGoal, plan: BudgetPlan): Cents {
  if (g.status !== 'active' || isGoalComplete(g)) return 0;
  return g.contributionFrequency === 'per_paycheck' ? toMonthly(g.contributionAmount, plan.income.payFrequency) : g.contributionAmount;
}

export function recurringMonthlyEquivalent(r: RecurringCommitment): Cents {
  if (r.interval === 'weekly') return Math.round((r.amount * 52) / 12);
  if (r.interval === 'yearly') return Math.round(r.amount / 12);
  return r.amount;
}

export function sortByPriority<T extends { priority: number; createdAt?: string; id: string }>(xs: T[]): T[] {
  return [...xs].sort((a, b) => a.priority - b.priority || (a.createdAt ?? '').localeCompare(b.createdAt ?? '') || a.id.localeCompare(b.id));
}

/** Number of occurrences of a recurring commitment dated within [from, to]. */
export function occurrencesBetween(r: RecurringCommitment, from: ISODate, to: ISODate): number {
  let n = 0;
  for (let k = 0; r.occurrences === null || k < r.occurrences; k++) {
    const d = r.interval === 'weekly' ? addDays(r.startDate, 7 * k) : addMonths(r.startDate, r.interval === 'monthly' ? k : 12 * k);
    if (d > to) break;
    if (d >= from) n++;
  }
  return n;
}

export interface PlanSummary {
  monthlyNet: Cents;
  essentials: Cents;
  discretionary: Cents;
  debtPayments: Cents;
  recurringCommitments: Cents;
  plannedSavings: Cents;
  /** Net − essentials − discretionary − debt − recurring: what is available for goals. */
  savingsCapacity: Cents;
  /** Savings capacity not assigned to any goal (negative = over-allocated). */
  unallocated: Cents;
  /** Spec formula: net − essentials − debt − savings − other committed. */
  discretionaryCapacity: Cents;
  overAllocated: boolean;
  savingsRate: number;
}

export function summarizePlan(inp: Pick<EngineInputs, 'plan' | 'accounts' | 'goals'>): PlanSummary {
  const { plan } = inp;
  const monthlyNet = monthlyNetIncome(plan.income);
  const essentials = sum(plan.essentialExpenses.map((l) => l.amount));
  const discretionary = sum(plan.discretionaryBudgets.map((l) => l.amount));
  const debtPayments = sum(liabilities(inp.accounts).filter((a) => a.balance > 0).map((a) => a.plannedPayment ?? 0));
  const recurringCommitments = sum(plan.recurringCommitments.map(recurringMonthlyEquivalent));
  const plannedSavings = sum(inp.goals.map((g) => goalMonthlyContribution(g, plan)));
  const savingsCapacity = monthlyNet - essentials - discretionary - debtPayments - recurringCommitments;
  const unallocated = savingsCapacity - plannedSavings;
  return {
    monthlyNet, essentials, discretionary, debtPayments, recurringCommitments, plannedSavings,
    savingsCapacity, unallocated,
    discretionaryCapacity: monthlyNet - essentials - debtPayments - plannedSavings - recurringCommitments,
    overAllocated: unallocated < 0,
    savingsRate: monthlyNet > 0 ? plannedSavings / monthlyNet : 0,
  };
}

/** Funding of each goal's requested contribution, in priority order, from limited capacity. */
export interface AllocationRow { goalId: string; requested: Cents; funded: Cents; shortfall: Cents }

export function allocateByPriority(goals: FinancialGoal[], plan: BudgetPlan, capacity: Cents): AllocationRow[] {
  let left = Math.max(0, capacity);
  return sortByPriority(goals.filter((g) => g.status === 'active' && !isGoalComplete(g))).map((g) => {
    const requested = goalMonthlyContribution(g, plan);
    const funded = Math.min(requested, left);
    left -= funded;
    return { goalId: g.id, requested, funded, shortfall: requested - funded };
  });
}

/** Month-to-date activity in the current calendar month, through `today`. */
export interface MonthToDate {
  monthStart: ISODate;
  spentByLine: Record<string, Cents>;
  debtPaidByAccount: Record<string, Cents>;
  transferredByGoal: Record<string, Cents>;
  incomeReceived: Cents;
  essentialSpent: Cents;
  discretionarySpent: Cents;
}

export function monthToDate(txns: Transaction[], today: ISODate): MonthToDate {
  const monthStart = startOfMonth(today);
  const m: MonthToDate = { monthStart, spentByLine: {}, debtPaidByAccount: {}, transferredByGoal: {}, incomeReceived: 0, essentialSpent: 0, discretionarySpent: 0 };
  for (const t of txns) {
    if (t.date < monthStart || t.date > today) continue;
    if (t.transactionType === 'income') m.incomeReceived += t.amount;
    else if (t.transactionType === 'expense') {
      m.spentByLine[t.category] = (m.spentByLine[t.category] ?? 0) + t.amount;
      if (t.kind === 'essential') m.essentialSpent += t.amount;
      else m.discretionarySpent += t.amount;
    } else if (t.transactionType === 'debt_payment') m.debtPaidByAccount[t.category] = (m.debtPaidByAccount[t.category] ?? 0) + t.amount;
    else if (t.transactionType === 'transfer_to_savings') m.transferredByGoal[t.category] = (m.transferredByGoal[t.category] ?? 0) + t.amount;
  }
  return m;
}

export interface SafeToSpend {
  periodStart: ISODate;
  periodEnd: ISODate;
  checking: Cents;
  incomeReceived: Cents;
  incomeExpected: Cents;
  incomeExpectedDates: ISODate[];
  essentialsReserved: Cents;
  debtReserved: Cents;
  savingsReserved: Cents;
  plannedPurchasesReserved: Cents;
  buffer: Cents;
  discretionaryBudget: Cents;
  discretionarySpent: Cents;
  /** Unassigned savings capacity added to the budget when surplus is not swept to goals. */
  unallocatedAvailable: Cents;
  budgetRemaining: Cents;
  cashBased: Cents;
  safeToSpend: Cents;
  binding: 'budget' | 'cash';
  shortfall: boolean;
  nextPayDate: ISODate | null;
}

/**
 * Safe-to-spend for the current calendar month. Two independent limits; the smaller wins:
 *
 *   Budget limit = discretionary budget − discretionary already spent this month
 *                  (+ unassigned capacity when surplus is not swept to goals)
 *                  − planned one-time purchases still due this month
 *
 *   Cash limit   = checking now + paychecks still expected this month
 *                  − essential bills still due − debt payments still due
 *                  − savings transfers still due − planned purchases still due − cash buffer
 *
 * "Still due" is max(0, planned − already paid this month), so nothing is double-counted.
 */
export function safeToSpend(inp: EngineInputs, extraEvents: { date: ISODate; amount: Cents }[] = []): SafeToSpend {
  const { today, plan, accounts, goals, transactions, prefs } = inp;
  const mtd = monthToDate(transactions, today);
  const periodEnd = endOfMonth(today);
  const summary = summarizePlan(inp);
  const checking = checkingBalance(accounts);

  const expectedDates = plan.income.mode === 'paycheck' ? payDatesBetween(plan.income, addDays(today, 1), periodEnd) : [];
  let incomeExpected = expectedDates.length * plan.income.netPerPaycheck;
  if (plan.income.mode === 'estimate') incomeExpected = Math.max(0, plan.income.monthlyEstimate - mtd.incomeReceived);

  const essentialsReserved = sum(plan.essentialExpenses.map((l) => Math.max(0, l.amount - (mtd.spentByLine[l.id] ?? 0))));
  const debtReserved = sum(liabilities(accounts).filter((a) => a.balance > 0).map((a) => Math.max(0, Math.min(a.balance, a.plannedPayment ?? 0) - (mtd.debtPaidByAccount[a.id] ?? 0))));
  const savingsReserved = sum(goals.map((g) => Math.max(0, goalMonthlyContribution(g, plan) - (mtd.transferredByGoal[g.id] ?? 0))));
  // Planned purchases are not transactions yet, so anything dated today through month end is still due.
  const dueThisMonth = (d: ISODate) => d >= today && d <= periodEnd;
  const plannedPurchasesReserved =
    sum(plan.plannedPurchases.filter((p) => dueThisMonth(p.date)).map((p) => p.amount)) +
    sum(extraEvents.filter((e) => dueThisMonth(e.date)).map((e) => e.amount)) +
    sum(plan.recurringCommitments.map((r) => r.amount * occurrencesBetween(r, today, periodEnd)));

  const discretionaryBudget = summary.discretionary;
  const unallocatedAvailable = prefs.sweepSurplusToGoals ? 0 : Math.max(0, summary.unallocated);
  const budgetRemaining = discretionaryBudget + unallocatedAvailable - mtd.discretionarySpent - plannedPurchasesReserved;
  const cashBased = checking + incomeExpected - essentialsReserved - debtReserved - savingsReserved - plannedPurchasesReserved - plan.cashBuffer;
  const safe = Math.min(budgetRemaining, cashBased);

  return {
    periodStart: mtd.monthStart, periodEnd, checking,
    incomeReceived: mtd.incomeReceived, incomeExpected, incomeExpectedDates: expectedDates,
    essentialsReserved, debtReserved, savingsReserved, plannedPurchasesReserved,
    buffer: plan.cashBuffer, discretionaryBudget, discretionarySpent: mtd.discretionarySpent, unallocatedAvailable,
    budgetRemaining, cashBased, safeToSpend: safe,
    binding: budgetRemaining <= cashBased ? 'budget' : 'cash',
    shortfall: safe < 0,
    nextPayDate: nextPayDate(plan.income, today),
  };
}
