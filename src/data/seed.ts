import type {
  BudgetLine, BudgetPlan, FinancialAccount, FinancialGoal, ForecastSnapshot, GardenState, ISODate, Paystub, Transaction, UserProfile,
} from '../engine/types';
import type { AppData } from '../state/schema';
import { addDays, addMonths, daysInMonth, endOfMonth, monthKey, parseISO, startOfMonth, startOfWeek, toISO } from '../lib/dates';
import { applyWeeklyRewards, evaluateWeeksSince } from '../garden/rules';
import { sum } from '../lib/money';

/** Deterministic PRNG (mulberry32) so the same "as of" date always produces the same demo data. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const ESSENTIALS: BudgetLine[] = [
  { id: 'rent', label: 'Rent', amount: 130000, kind: 'essential', dueDay: 1 },
  { id: 'insurance', label: 'Renters & health extras', amount: 3000, kind: 'essential', dueDay: 3 },
  { id: 'utilities', label: 'Utilities & internet', amount: 14000, kind: 'essential', dueDay: 5 },
  { id: 'phone', label: 'Phone', amount: 5000, kind: 'essential', dueDay: 8 },
  { id: 'groceries', label: 'Groceries', amount: 38000, kind: 'essential' },
  { id: 'transport', label: 'Transit & rideshare', amount: 15000, kind: 'essential' },
];

export const DISCRETIONARY: BudgetLine[] = [
  { id: 'dining', label: 'Dining out', amount: 22000, kind: 'discretionary' },
  { id: 'shopping', label: 'Shopping', amount: 16000, kind: 'discretionary' },
  { id: 'entertainment', label: 'Entertainment', amount: 11000, kind: 'discretionary' },
  { id: 'subscriptions', label: 'Subscriptions', amount: 6000, kind: 'discretionary' },
  { id: 'personal', label: 'Personal care', amount: 10000, kind: 'discretionary' },
];

const NET = 210000;
const GROSS = 283333;

export function demoPaystub(asOf: ISODate): Paystub {
  const d = parseISO(asOf);
  const dim = daysInMonth(d.getUTCFullYear(), d.getUTCMonth());
  const day = d.getUTCDate();
  const payDate = day >= 15 ? (day === dim ? asOf : asOf.slice(0, 8) + '15') : endOfMonth(addMonths(startOfMonth(asOf), -1));
  return {
    id: 'stub-demo',
    employer: 'Northwind Analytics (simulated)',
    grossPay: GROSS,
    netPay: NET,
    payFrequency: 'semimonthly',
    payDate,
    taxWithholding: { federal: 21825, state: 10000, socialSecurity: 17567, medicare: 4108 },
    otherDeductions: [{ label: 'Health insurance (pre-tax)', amount: 8500 }],
    employeeRetirementPercent: 4,
    employeeRetirementContribution: 11333,
    employerMatchPolicy: {
      tiers: [{ matchRate: 1, tierPercent: 3 }, { matchRate: 0.5, tierPercent: 2 }],
      description: '100% of the first 3% of pay, plus 50% of the next 2%',
      vestingNote: 'Employer contributions vest after 2 years of service (sample policy).',
    },
    isMock: true,
  };
}

function demoGoals(asOf: ISODate): FinancialGoal[] {
  const efTarget = 3 * sum(ESSENTIALS.map((l) => l.amount));
  return [
    { id: 'g-emergency', name: 'Emergency fund', category: 'emergency', targetAmount: efTarget, currentSavedAmount: 360000, targetDate: endOfMonth(addMonths(asOf, 6)), contributionAmount: 45000, contributionFrequency: 'monthly', priority: 1, status: 'active', notes: 'Three months of essential expenses.', createdAt: addMonths(asOf, -7), history: [] },
    { id: 'g-car', name: 'Car down payment', category: 'car', targetAmount: 900000, currentSavedAmount: 260000, targetDate: endOfMonth(addMonths(asOf, 14)), contributionAmount: 30000, contributionFrequency: 'monthly', priority: 2, status: 'active', notes: 'Down payment on a reliable used car.', createdAt: addMonths(asOf, -7), history: [] },
    { id: 'g-travel', name: 'Summer travel fund', category: 'travel', targetAmount: 300000, currentSavedAmount: 120000, targetDate: endOfMonth(addMonths(asOf, 9)), contributionAmount: 15000, contributionFrequency: 'monthly', priority: 3, status: 'active', notes: '', createdAt: addMonths(asOf, -7), history: [] },
  ];
}

const CHECKING_NOW = 178000;

/** Generate six months of internally consistent synthetic transactions ending on `asOf`. */
function demoTransactions(asOf: ISODate, goals: FinancialGoal[]): Transaction[] {
  const r = rng(Number(asOf.replace(/-/g, '')));
  const between = (lo: number, hi: number) => Math.round(lo + r() * (hi - lo));
  const tx: Transaction[] = [];
  let n = 0;
  const push = (t: Omit<Transaction, 'id' | 'isSimulated'>) => {
    if (t.date <= asOf) tx.push({ ...t, id: `t${++n}`, isSimulated: false });
  };
  const start = addMonths(startOfMonth(asOf), -6);
  const skipTravelMonth = monthKey(addMonths(start, 2));

  // Monthly bills, income, debt, transfers, groceries, transport
  for (let m = 0; m <= 6; m++) {
    const ms = addMonths(start, m);
    const mk = monthKey(ms);
    const p = parseISO(ms);
    const dim = daysInMonth(p.getUTCFullYear(), p.getUTCMonth());
    const day = (d: number) => toISO(new Date(Date.UTC(p.getUTCFullYear(), p.getUTCMonth(), Math.min(d, dim))));
    const recent = m >= 3;

    push({ accountId: 'acct-checking', date: day(15), amount: NET, category: 'salary', description: 'Payroll deposit — Northwind Analytics', transactionType: 'income' });
    push({ accountId: 'acct-checking', date: day(dim), amount: NET, category: 'salary', description: 'Payroll deposit — Northwind Analytics', transactionType: 'income' });
    push({ accountId: 'acct-checking', date: day(1), amount: 130000, category: 'rent', description: 'Rent — Parkview Apartments', transactionType: 'expense', kind: 'essential' });
    push({ accountId: 'acct-checking', date: day(3), amount: 3000, category: 'insurance', description: 'Renters insurance + HSA top-up', transactionType: 'expense', kind: 'essential' });
    push({ accountId: 'acct-checking', date: day(5), amount: between(12400, 15600), category: 'utilities', description: 'Power, water & internet', transactionType: 'expense', kind: 'essential' });
    push({ accountId: 'acct-checking', date: day(8), amount: 5000, category: 'phone', description: 'Mobile plan', transactionType: 'expense', kind: 'essential' });
    // Groceries ran a little over plan in recent months (drives a forecast suggestion).
    const groceryTotal = recent ? between(40500, 42500) : between(35500, 38500);
    const gDays = [2, 9, 16, 23, 29];
    gDays.forEach((d, i) => push({ accountId: 'acct-checking', date: day(d), amount: i < gDays.length - 1 ? Math.round(groceryTotal / 5) : groceryTotal - 4 * Math.round(groceryTotal / 5), category: 'groceries', description: ['Trader Joe’s', 'Kroger', 'Publix', 'Kroger', 'Farmers market'][i], transactionType: 'expense', kind: 'essential' }));
    const tDays = [4, 11, 14, 19, 25, 28];
    const tTotal = between(13000, 15500);
    tDays.forEach((d, i) => push({ accountId: 'acct-checking', date: day(d), amount: i < tDays.length - 1 ? Math.round(tTotal / 6) : tTotal - 5 * Math.round(tTotal / 6), category: 'transport', description: i % 2 ? 'Rideshare' : 'Transit card reload', transactionType: 'expense', kind: 'essential' }));

    push({ accountId: 'acct-checking', date: day(10), amount: 5000, category: 'acct-cc', description: 'Cashback Visa payment', transactionType: 'debt_payment' });
    push({ accountId: 'acct-checking', date: day(20), amount: 20000, category: 'acct-loan', description: 'Student loan payment', transactionType: 'debt_payment' });

    for (const g of goals) {
      if (g.id === 'g-travel') {
        if (mk !== skipTravelMonth) push({ accountId: 'acct-checking', date: day(dim), amount: g.contributionAmount, category: g.id, description: `Transfer to ${g.name}`, transactionType: 'transfer_to_savings' });
      } else push({ accountId: 'acct-checking', date: day(16), amount: g.contributionAmount, category: g.id, description: `Transfer to ${g.name}`, transactionType: 'transfer_to_savings' });
    }

    // Subscriptions (count toward weekly discretionary)
    push({ accountId: 'acct-checking', date: day(3), amount: 1199, category: 'subscriptions', description: 'Music streaming', transactionType: 'expense', kind: 'discretionary' });
    push({ accountId: 'acct-checking', date: day(12), amount: 1549, category: 'subscriptions', description: 'Video streaming', transactionType: 'expense', kind: 'discretionary' });
    push({ accountId: 'acct-checking', date: day(21), amount: 3252, category: 'subscriptions', description: 'Climbing gym', transactionType: 'expense', kind: 'discretionary' });
  }

  // Weekly discretionary spending. Two weeks deliberately run over the weekly allowance.
  const allowance = Math.round((sum(DISCRETIONARY.map((l) => l.amount)) * 12) / 52);
  const thisWeek = startOfWeek(asOf);
  const dining = ['Sweetgreen', 'Taqueria del Sol', 'Coffee shop', 'Ramen bar', 'Pizza night', 'Brunch with friends'];
  const shops = ['Target', 'Uniqlo', 'Amazon', 'Bookstore'];
  const fun = ['Movie tickets', 'Concert tickets', 'Trivia night', 'Bowling'];
  for (let w = startOfWeek(start); w <= asOf; w = addDays(w, 7)) {
    const weeksAgo = Math.round((parseISO(thisWeek).getTime() - parseISO(w).getTime()) / (7 * 86_400_000));
    const subsInWeek = sum(tx.filter((t) => t.category === 'subscriptions' && t.date >= w && t.date <= addDays(w, 6)).map((t) => t.amount));
    const over = weeksAgo === 3 || weeksAgo === 8 || weeksAgo === 17;
    const variable = over ? allowance - subsInWeek + between(2200, 3800) : Math.max(4000, allowance - subsInWeek - between(900, 4200));
    const parts = [
      { cat: 'dining', share: 0.24, dayOff: 1, desc: dining[between(0, 5)] },
      { cat: 'dining', share: 0.2, dayOff: 4, desc: dining[between(0, 5)] },
      { cat: 'shopping', share: 0.27, dayOff: 5, desc: shops[between(0, 3)] },
      { cat: 'entertainment', share: 0.17, dayOff: 5, desc: fun[between(0, 3)] },
      { cat: 'personal', share: 0.12, dayOff: 6, desc: 'Haircut & pharmacy' },
    ];
    let used = 0;
    parts.forEach((pt, i) => {
      const amt = i < parts.length - 1 ? Math.round(variable * pt.share) : variable - used;
      used += amt;
      const date = addDays(w, pt.dayOff);
      if (date >= start) push({ accountId: 'acct-checking', date, amount: amt, category: pt.cat, description: pt.desc, transactionType: 'expense', kind: 'discretionary' });
    });
  }
  return tx.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
}

/** Month-end goal balances reconstructed backwards from current balances and transfers. */
function goalHistory(g: FinancialGoal, txns: Transaction[], asOf: ISODate): FinancialGoal['history'] {
  const months: ISODate[] = [];
  for (let m = 6; m >= 1; m--) months.push(endOfMonth(addMonths(startOfMonth(asOf), -m)));
  const transfersAfter = (d: ISODate) => sum(txns.filter((t) => t.transactionType === 'transfer_to_savings' && t.category === g.id && t.date > d).map((t) => t.amount));
  return [...months.map((d) => ({ date: d, balance: g.currentSavedAmount - transfersAfter(d) })), { date: asOf, balance: g.currentSavedAmount }];
}

function forecastSnapshots(asOf: ISODate): ForecastSnapshot[] {
  const out: ForecastSnapshot[] = [];
  for (let m = 6; m >= 1; m--) {
    const mk = monthKey(addMonths(startOfMonth(asOf), -m));
    // The plan was updated three months ago: groceries were planned at $350 before that.
    const lines = [...ESSENTIALS, ...DISCRETIONARY].map((l) => (l.id === 'groceries' && m > 3 ? { ...l, amount: 35000 } : l));
    out.push({
      monthKey: mk,
      predictedSpending: sum(lines.map((l) => l.amount)),
      predictedSavings: 90000,
      predictedByLine: Object.fromEntries(lines.map((l) => [l.id, l.amount])),
      isSynthetic: true,
    });
  }
  return out;
}

export function emptyGarden(asOf: ISODate): GardenState {
  return {
    pointsBalance: 0, currentStreak: 0, longestStreak: 0, successfulWeeks: 0,
    ownedItemIds: ['clover', 'path-gravel', 'theme-spring'],
    placedItems: [{ slot: 5, itemId: 'clover', placedAt: asOf, placedAtQualifiedCount: 0 }],
    lastQualifiedWeek: null, evaluatedWeeks: [], rewardHistory: [{ id: 'starter', date: asOf, type: 'starter', points: 0, note: 'Starter garden: clover patch, gravel path, spring theme' }],
    activePath: 'path-gravel', activeTheme: 'theme-spring',
    trackingStartDate: startOfWeek(asOf),
  };
}

export function defaultPreferences(): UserProfile['planningPreferences'] {
  return { sweepSurplusToGoals: true, protectCashBuffer: true, horizonMonths: 24 };
}

export function createDemoData(asOf: ISODate): AppData {
  const goals = demoGoals(asOf);
  const transactions = demoTransactions(asOf, goals);
  for (const g of goals) g.history = goalHistory(g, transactions, asOf);
  const stub = demoPaystub(asOf);

  const accounts: FinancialAccount[] = [
    { id: 'acct-checking', name: 'Everyday Checking', institution: 'Evergreen Bank (simulated)', type: 'checking', balance: CHECKING_NOW, accountRole: 'cash', isMock: true, updatedAt: asOf },
    { id: 'acct-savings', name: 'High-Yield Savings', institution: 'Evergreen Bank (simulated)', type: 'savings', balance: sum(goals.map((g) => g.currentSavedAmount)), accountRole: 'cash', isMock: true, updatedAt: asOf },
    { id: 'acct-cc', name: 'Cashback Visa', institution: 'Evergreen Bank (simulated)', type: 'credit_card', balance: 64000, accountRole: 'liability', isMock: true, updatedAt: asOf, apr: 0.2399, minimumPayment: 2500, plannedPayment: 5000, dueDay: 10 },
    { id: 'acct-loan', name: 'Federal student loan', institution: 'Loan servicer (simulated)', type: 'loan', balance: 1850000, accountRole: 'liability', isMock: true, updatedAt: asOf, apr: 0.055, minimumPayment: 19800, plannedPayment: 20000, dueDay: 20 },
    { id: 'acct-401k', name: '401(k)', institution: 'Retirement plan (simulated)', type: 'investment', balance: 842000, accountRole: 'investment', isMock: true, updatedAt: asOf },
  ];

  const plan: BudgetPlan = {
    id: 'plan-1',
    income: { mode: 'paycheck', payFrequency: 'semimonthly', netPerPaycheck: NET, grossPerPaycheck: GROSS, anchorPayDate: stub.payDate, monthlyEstimate: 0 },
    essentialExpenses: ESSENTIALS.map((l) => ({ ...l })),
    discretionaryBudgets: DISCRETIONARY.map((l) => ({ ...l })),
    plannedPurchases: [],
    recurringCommitments: [],
    cashBuffer: 100000,
    lastUpdated: asOf,
  };

  const profile: UserProfile = {
    id: 'user-demo', displayName: 'Maya', onboardingCompleted: true, payFrequency: 'semimonthly', currency: 'USD',
    planningPreferences: defaultPreferences(), dataSource: 'demo', createdAt: asOf,
  };

  // Garden history is derived from the same transactions using the real weekly rules.
  let garden = emptyGarden(asOf);
  garden.trackingStartDate = addDays(startOfWeek(asOf), -7 * 10);
  garden.rewardHistory = garden.rewardHistory.map((r) => (r.type === 'starter' ? { ...r, date: garden.trackingStartDate } : r));
  garden = applyWeeklyRewards(garden, evaluateWeeksSince(garden.trackingStartDate, transactions, plan, asOf));
  garden = {
    ...garden,
    ownedItemIds: [...garden.ownedItemIds, 'tulip', 'pot-terracotta', 'lantern'],
    pointsBalance: garden.pointsBalance - 120 - 80 - 120,
    placedItems: [
      { slot: 5, itemId: 'clover', placedAt: garden.trackingStartDate, placedAtQualifiedCount: 0 },
      { slot: 2, itemId: 'tulip', placedAt: addDays(asOf, -40), placedAtQualifiedCount: 2 },
      { slot: 8, itemId: 'pot-terracotta', placedAt: addDays(asOf, -40), placedAtQualifiedCount: 2 },
      { slot: 0, itemId: 'lantern', placedAt: addDays(asOf, -20), placedAtQualifiedCount: 4 },
    ],
    rewardHistory: [
      ...garden.rewardHistory,
      { id: 'buy-tulip-seed', date: addDays(asOf, -40), type: 'purchase' as const, itemId: 'tulip', points: -120, note: 'Bought Tulips' },
      { id: 'buy-pot-seed', date: addDays(asOf, -40), type: 'purchase' as const, itemId: 'pot-terracotta', points: -80, note: 'Bought Terracotta pot' },
      { id: 'buy-lantern-seed', date: addDays(asOf, -20), type: 'purchase' as const, itemId: 'lantern', points: -120, note: 'Bought Lantern' },
    ].sort((a, b) => a.date.localeCompare(b.date)),
  };

  return {
    version: 1, asOf, profile, paystub: stub, accounts, transactions, plan, goals,
    scenario: { items: [], selectedId: null },
    recommendationFeedback: {},
    forecastSnapshots: forecastSnapshots(asOf),
    garden,
    activity: [
      { id: 'a-seed-1', date: addDays(asOf, -9), kind: 'plan', title: 'Groceries budget reviewed', detail: 'Plan updated three months ago from $350 to $380 per month.' },
      { id: 'a-seed-2', date: addDays(asOf, -2), kind: 'account', title: 'Simulated accounts refreshed', detail: 'Demo balances as of today. No real accounts are connected.' },
    ],
    connections: { payroll: true, bank: true },
    auditNotApplicable: [],
  };
}

/** Blank profile for manual entry. Users fill income, expenses and balances in onboarding. */
export function createManualData(asOf: ISODate, input: {
  name: string; payFrequency: BudgetPlan['income']['payFrequency']; netPerPaycheck: number; grossPerPaycheck: number;
  rent: number; otherEssentials: number; discretionary: number; checking: number; savings: number; debtBalance: number; debtPayment: number; debtApr: number;
}): AppData {
  const plan: BudgetPlan = {
    id: 'plan-1',
    income: { mode: 'paycheck', payFrequency: input.payFrequency, netPerPaycheck: input.netPerPaycheck, grossPerPaycheck: input.grossPerPaycheck, anchorPayDate: asOf, monthlyEstimate: 0 },
    essentialExpenses: [
      { id: 'rent', label: 'Rent', amount: input.rent, kind: 'essential', dueDay: 1 },
      { id: 'other-essentials', label: 'Other essentials', amount: input.otherEssentials, kind: 'essential' },
    ],
    discretionaryBudgets: [{ id: 'discretionary', label: 'Discretionary', amount: input.discretionary, kind: 'discretionary' }],
    plannedPurchases: [], recurringCommitments: [], cashBuffer: Math.min(100000, Math.round(input.checking / 2)), lastUpdated: asOf,
  };
  const accounts: FinancialAccount[] = [
    { id: 'acct-checking', name: 'Checking', institution: 'Entered manually', type: 'checking', balance: input.checking, accountRole: 'cash', isMock: false, updatedAt: asOf },
    { id: 'acct-savings', name: 'Savings', institution: 'Entered manually', type: 'savings', balance: input.savings, accountRole: 'cash', isMock: false, updatedAt: asOf },
  ];
  if (input.debtBalance > 0) accounts.push({ id: 'acct-loan', name: 'Debt', institution: 'Entered manually', type: 'loan', balance: input.debtBalance, accountRole: 'liability', isMock: false, updatedAt: asOf, apr: input.debtApr, plannedPayment: input.debtPayment, minimumPayment: input.debtPayment });
  return {
    version: 1, asOf,
    profile: { id: 'user-manual', displayName: input.name.trim(), onboardingCompleted: true, payFrequency: input.payFrequency, currency: 'USD', planningPreferences: defaultPreferences(), dataSource: 'manual', createdAt: asOf },
    paystub: null, accounts, transactions: [], plan, goals: [],
    scenario: { items: [], selectedId: null }, recommendationFeedback: {}, forecastSnapshots: [],
    garden: emptyGarden(asOf), activity: [{ id: 'a-manual', date: asOf, kind: 'plan', title: 'Plan created from your entries' }],
    connections: { payroll: false, bank: false },
    auditNotApplicable: [],
  };
}
