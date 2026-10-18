import { describe, expect, it } from 'vitest';
import { annualize, payDatesBetween, toMonthly } from './income';
import { allocateByPriority, safeToSpend, summarizePlan, type EngineInputs } from './plan';
import { installmentPayment, project, expandPurchase } from './projection';
import { analyzeGoal } from './goals';
import { bestOption, compareOptions, compareScenario } from './scenario';
import { project as projectFn } from './projection';
import { analyzeMatch, matchPercent } from './match';
import { applyWeeklyRewards, evaluateWeeksSince, streakBonus, buyItem } from '../garden/rules';
import { GARDEN_ITEMS } from '../garden/items';
import { leaderboard, pointsEarned } from '../garden/friends';
import { createDemoData } from '../data/seed';
import type { PurchaseScenario } from './types';
import { diffDays } from '../lib/dates';
import { parseDollars } from '../lib/money';

const AS_OF = '2026-10-17';
const demo = createDemoData(AS_OF);
const inputs = (over: Partial<EngineInputs> = {}): EngineInputs => ({
  today: AS_OF, plan: demo.plan, accounts: demo.accounts, goals: demo.goals, transactions: demo.transactions,
  prefs: demo.profile.planningPreferences, ...over,
});
const purchase = (p: Partial<PurchaseScenario>): PurchaseScenario => ({
  id: 's1', productId: null, customName: 'Phone', category: 'Electronics', price: 120000, plannedDate: '2026-10-20',
  recurrence: null, payment: { type: 'full' }, included: true, description: '', baselineId: 'baseline', scenarioStatus: 'draft', createdAt: AS_OF, ...p,
});

describe('income normalization', () => {
  it('annualizes each pay frequency correctly', () => {
    expect(annualize(100000, 'weekly')).toBe(5_200_000);
    expect(annualize(100000, 'biweekly')).toBe(2_600_000);
    expect(annualize(100000, 'semimonthly')).toBe(2_400_000);
    expect(annualize(100000, 'monthly')).toBe(1_200_000);
  });
  it('does not confuse biweekly and semimonthly', () => {
    expect(toMonthly(200000, 'biweekly')).toBe(433333);
    expect(toMonthly(200000, 'semimonthly')).toBe(400000);
  });
  it('generates semimonthly pay dates on the 15th and last day', () => {
    const inc = { ...demo.plan.income };
    expect(payDatesBetween(inc, '2026-02-01', '2026-02-28')).toEqual(['2026-02-15', '2026-02-28']);
  });
  it('generates biweekly dates from the anchor', () => {
    const inc = { ...demo.plan.income, payFrequency: 'biweekly' as const, anchorPayDate: '2026-10-02' };
    expect(payDatesBetween(inc, '2026-10-01', '2026-10-31')).toEqual(['2026-10-02', '2026-10-16', '2026-10-30']);
  });
});

describe('plan summary', () => {
  it('matches the seeded demo plan', () => {
    const s = summarizePlan(inputs());
    expect(s.monthlyNet).toBe(420000);
    expect(s.essentials).toBe(205000);
    expect(s.discretionary).toBe(65000);
    expect(s.debtPayments).toBe(25000);
    expect(s.plannedSavings).toBe(90000);
    expect(s.unallocated).toBe(420000 - 205000 - 65000 - 25000 - 90000);
    expect(s.overAllocated).toBe(false);
  });
  it('flags over-allocation and funds goals by priority', () => {
    const goals = demo.goals.map((g) => ({ ...g, contributionAmount: g.contributionAmount * 2 }));
    const s = summarizePlan(inputs({ goals }));
    expect(s.overAllocated).toBe(true);
    const rows = allocateByPriority(goals, demo.plan, s.savingsCapacity);
    expect(rows[0].shortfall).toBe(0);
    expect(rows[rows.length - 1].shortfall).toBeGreaterThan(0);
    expect(rows.reduce((a, r) => a + r.funded, 0)).toBe(s.savingsCapacity);
  });
});

describe('safe to spend', () => {
  it('never double-counts paid items and takes the smaller limit', () => {
    const s = safeToSpend(inputs());
    expect(s.essentialsReserved).toBeGreaterThanOrEqual(0);
    expect(s.safeToSpend).toBe(Math.min(s.budgetRemaining, s.cashBased));
    // Rent was paid on the 1st, so it must not be reserved again.
    expect(s.essentialsReserved).toBeLessThan(130000);
  });
  it('reserves applied purchases and commitments dated this month, including today', () => {
    const plan = { ...demo.plan,
      plannedPurchases: [{ id: 'pp', label: 'Phone', amount: 49900, date: AS_OF, source: 'applied_scenario' as const }],
      recurringCommitments: [{ id: 'rc', label: 'Gym', amount: 6500, interval: 'monthly' as const, startDate: '2026-10-25', occurrences: null, source: 'applied_scenario' as const }] };
    const before = safeToSpend(inputs());
    const after = safeToSpend(inputs({ plan }));
    expect(after.plannedPurchasesReserved).toBe(49900 + 6500);
    expect(after.budgetRemaining).toBe(before.budgetRemaining - 56400);
  });
  it('shows a shortfall instead of a positive number when cash is short', () => {
    const accounts = demo.accounts.map((a) => (a.type === 'checking' ? { ...a, balance: 0 } : a));
    const s = safeToSpend(inputs({ accounts, plan: { ...demo.plan, cashBuffer: 300000 } }));
    expect(s.shortfall).toBe(true);
    expect(s.safeToSpend).toBeLessThan(0);
  });
});

describe('projection', () => {
  it('is deterministic', () => {
    const a = project(inputs(), { scenarioId: 'a' });
    const b = project(inputs(), { scenarioId: 'a' });
    expect(a.goalCompletionDates).toEqual(b.goalCompletionDates);
  });
  it('completes goals in priority order when surplus is swept', () => {
    const r = project(inputs(), { scenarioId: 'b' });
    const ef = r.goalCompletionDates['g-emergency']!;
    const car = r.goalCompletionDates['g-car']!;
    expect(ef).toBeTruthy();
    expect(car).toBeTruthy();
    expect(ef < car).toBe(true);
  });
  it('matches the simple formula when there is no sweep and no purchases', () => {
    const prefs = { ...demo.profile.planningPreferences, sweepSurplusToGoals: false };
    const r = project(inputs({ prefs }), { scenarioId: 'c' });
    // Car: 640,000 remaining at 30,000/mo; October's transfer is already done → completes in month 22 (fractional 21.33).
    const car = r.goalCompletionDates['g-car']!;
    expect(car.slice(0, 7)).toBe('2028-08');
  });
  it('flags negative cash instead of hiding it', () => {
    const prefs = { ...demo.profile.planningPreferences, protectCashBuffer: false, sweepSurplusToGoals: false };
    const ev = expandPurchase(purchase({ price: 5_000_000 }), '2030-01-01');
    const r = project(inputs({ prefs }), { scenarioId: 'd', extraEvents: ev });
    expect(r.shortfallPeriods.length).toBeGreaterThan(0);
    expect(r.snapshots[r.shortfallPeriods[0]].projectedCash).toBeLessThan(0);
  });
  it('pays off the credit card and records a date', () => {
    const r = project(inputs(), { scenarioId: 'e' });
    expect(r.debtPayoffDates['acct-cc']).toBeTruthy();
  });
});

describe('purchase impact', () => {
  it('delays goals by the calendar difference of completion dates', () => {
    const cmp = compareScenario(inputs(), [purchase({})], { horizon: 24 });
    const ef = cmp.goalImpacts.find((g) => g.goalId === 'g-emergency')!;
    expect(ef.kind).toBe('delayed');
    expect(ef.delayDays).toBe(diffDays(ef.scenarioDate!, ef.baselineDate!));
    expect(ef.delayDays!).toBeGreaterThan(0);
  });
  it('a later purchase hurts the first goal less than a purchase today', () => {
    const now = compareScenario(inputs(), [purchase({})], { horizon: 24 });
    const later = compareScenario(inputs(), [purchase({ plannedDate: '2027-09-01' })], { horizon: 24 });
    const a = now.goalImpacts.find((g) => g.goalId === 'g-emergency')!.delayDays!;
    const b = later.goalImpacts.find((g) => g.goalId === 'g-emergency')!.delayDays ?? 0;
    expect(b).toBeLessThan(a);
  });
  it('does not delay goals when surplus is kept in cash and the buffer holds', () => {
    const prefs = { ...demo.profile.planningPreferences, sweepSurplusToGoals: false };
    const cmp = compareScenario(inputs({ prefs }), [purchase({ price: 5000, plannedDate: '2026-11-20' })], { horizon: 24 });
    expect(cmp.goalImpacts.every((g) => g.kind === 'no_change')).toBe(true);
  });
  it('excluded items have no effect', () => {
    const cmp = compareScenario(inputs(), [purchase({ included: false })], { horizon: 24 });
    expect(cmp.goalImpacts.every((g) => g.kind === 'no_change')).toBe(true);
  });
  it('installments sum to the price at 0% APR', () => {
    const ev = expandPurchase(purchase({ price: 100000, payment: { type: 'installments', months: 6, aprPercent: 0 } }), '2030-01-01');
    expect(ev).toHaveLength(6);
    expect(ev.reduce((a, e) => a + e.amount, 0)).toBe(100000);
    expect(installmentPayment(1_000_000, 36, 0)).toBe(27778);
  });
  it('recurring purchases repeat and reduce savings capacity', () => {
    const cmp = compareScenario(inputs(), [purchase({ price: 6500, recurrence: { interval: 'monthly', occurrences: null } })], { horizon: 12 });
    expect(cmp.monthlyRecurringCost).toBe(6500);
    expect(cmp.savingsCapacity.after).toBe(cmp.savingsCapacity.before - 6500);
  });
});

describe('comparing options', () => {
  it('evaluates each option alone, even when not included in the combined scenario', () => {
    const flagship = purchase({ id: 'a', customName: 'Flagship', price: 119900 });
    const midrange = purchase({ id: 'b', customName: 'Midrange', price: 49900, included: false });
    const baseline = projectFn(inputs(), { scenarioId: 'baseline' });
    const [a, b] = compareOptions(inputs(), [flagship, midrange], 24, baseline);
    const aloneB = compareScenario(inputs(), [{ ...midrange, included: true }], { horizon: 24 });
    expect(b.cmp.goalImpacts).toEqual(aloneB.goalImpacts);
    expect(b.totalDelayDays).toBeLessThan(a.totalDelayDays);
    expect(bestOption([a, b])!.item.id).toBe('b');
  });
});

describe('goals', () => {
  it('computes required contribution for a target date', () => {
    const g = { ...demo.goals[1], targetDate: '2027-10-17', currentSavedAmount: 300000, targetAmount: 900000 };
    const a = analyzeGoal(g, demo.plan, null, AS_OF, 0);
    expect(a.remaining).toBe(600000);
    expect(a.requiredMonthly).toBe(Math.ceil(600000 / (365 / 30.4375)));
  });
  it('marks past target dates as overdue', () => {
    const g = { ...demo.goals[2], targetDate: '2026-01-01' };
    expect(analyzeGoal(g, demo.plan, null, AS_OF, 0).track).toBe('overdue');
  });
  it('has no completion date with a zero contribution', () => {
    const g = { ...demo.goals[2], contributionAmount: 0 };
    expect(analyzeGoal(g, demo.plan, null, AS_OF, 0).simpleCompletionDate).toBeNull();
  });
});

describe('employer match', () => {
  it('applies tiered policies', () => {
    const p = demo.paystub!.employerMatchPolicy!;
    expect(matchPercent(p, 4)).toBe(3.5);
    expect(matchPercent(p, 5)).toBe(4);
    expect(matchPercent(p, 10)).toBe(4);
    const m = analyzeMatch(demo.paystub!)!;
    expect(m.fullMatchAt).toBe(5);
    expect(m.missedAnnual).toBe(Math.round((283333 * 24 * 0.5) / 100));
  });
});

describe('garden rewards', () => {
  it('seeded garden came from the weekly rules', () => {
    expect(demo.garden.successfulWeeks).toBe(8);
    expect(demo.garden.currentStreak).toBe(2);
    expect(demo.garden.longestStreak).toBe(4);
  });
  it('never grants the same week twice', () => {
    const weeks = evaluateWeeksSince(demo.garden.trackingStartDate, demo.transactions, demo.plan, AS_OF);
    const again = applyWeeklyRewards(demo.garden, weeks);
    expect(again).toBe(demo.garden);
    expect(again.pointsBalance).toBe(demo.garden.pointsBalance);
  });
  it('caps the streak bonus', () => {
    expect(streakBonus(1)).toBe(0);
    expect(streakBonus(2)).toBe(25);
    expect(streakBonus(10)).toBe(100);
  });
  it('enforces unlocks and balances when buying', () => {
    const locked = GARDEN_ITEMS.find((i) => i.id === 'oak')!;
    expect(buyItem(demo.garden, locked, AS_OF, 0.5).ok).toBe(false);
    const cheap = GARDEN_ITEMS.find((i) => i.id === 'lavender')!;
    const r = buyItem(demo.garden, cheap, AS_OF, 0.5);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.state.pointsBalance).toBe(demo.garden.pointsBalance - 150);
  });
});

describe('friends leaderboard', () => {
  it('ranks by points earned, unaffected by shop spending', () => {
    expect(pointsEarned(demo.garden)).toBe(1000);
    const spent = { ...demo.garden, pointsBalance: 0 };
    const rows = leaderboard(spent, 'Maya', 'earned');
    expect(rows.map((r) => r.rank)).toEqual([1, 2, 3, 4, 5]);
    expect(rows.find((r) => r.isYou)!.rank).toBe(3);
  });
  it('can rank by streak', () => {
    const rows = leaderboard(demo.garden, 'Maya', 'streak');
    expect(rows[0].streak).toBeGreaterThanOrEqual(rows[rows.length - 1].streak);
  });
});

describe('money parsing', () => {
  it('rejects invalid amounts', () => {
    expect(parseDollars('1,200.50')).toBe(120050);
    expect(parseDollars('-5')).toBeNull();
    expect(parseDollars('abc')).toBeNull();
    expect(parseDollars('1.234')).toBeNull();
  });
});
