import type { BudgetPlan, GardenItem, GardenState, ISODate, RewardEntry, Transaction } from '../engine/types';
import { addDays, daysInMonth, isoWeekId, parseISO, startOfWeek } from '../lib/dates';
import { sum } from '../lib/money';

/** Configurable reward constants. */
export const POINTS = {
  weeklyBase: 100,
  streakBonusPerWeek: 25,
  streakBonusCap: 100,
};

export type WeekStatus = 'qualified' | 'missed' | 'no_data' | 'in_progress';

export interface WeekEvaluation {
  weekId: string;
  start: ISODate;
  end: ISODate;
  discretionarySpent: number;
  allowance: number;
  essentialsDue: { lineId: string; label: string; dueDate: ISODate; paid: boolean }[];
  withinAllowance: boolean;
  essentialsOk: boolean;
  status: WeekStatus;
}

/** Weekly discretionary allowance = monthly discretionary budget × 12 ÷ 52. */
export function weeklyAllowance(plan: BudgetPlan): number {
  return Math.round((sum(plan.discretionaryBudgets.map((l) => l.amount)) * 12) / 52);
}

/**
 * A week (Mon–Sun) qualifies when BOTH are true:
 *   1. Discretionary spending that week ≤ the weekly allowance, and
 *   2. Every essential bill due that week was paid by the end of the week.
 * Rule 2 means cutting essentials never earns points. Weeks with no transaction data are not scored.
 */
export function evaluateWeek(weekStart: ISODate, txns: Transaction[], plan: BudgetPlan, today: ISODate): WeekEvaluation {
  const end = addDays(weekStart, 6);
  const inWeek = txns.filter((t) => t.date >= weekStart && t.date <= end);
  const discretionarySpent = sum(inWeek.filter((t) => t.transactionType === 'expense' && t.kind === 'discretionary').map((t) => t.amount));
  const allowance = weeklyAllowance(plan);

  const essentialsDue: WeekEvaluation['essentialsDue'] = [];
  for (let i = 0; i < 7; i++) {
    const d = addDays(weekStart, i);
    const p = parseISO(d);
    const dim = daysInMonth(p.getUTCFullYear(), p.getUTCMonth());
    for (const line of plan.essentialExpenses) {
      if (!line.dueDay) continue;
      if (Math.min(line.dueDay, dim) !== p.getUTCDate()) continue;
      const monthStart = d.slice(0, 8) + '01';
      const paid = txns.some((t) => t.transactionType === 'expense' && t.category === line.id && t.date >= monthStart && t.date <= end);
      essentialsDue.push({ lineId: line.id, label: line.label, dueDate: d, paid });
    }
  }
  const withinAllowance = discretionarySpent <= allowance;
  const essentialsOk = essentialsDue.every((e) => e.paid);
  let status: WeekStatus;
  if (end >= today) status = 'in_progress';
  else if (inWeek.length === 0) status = 'no_data';
  else status = withinAllowance && essentialsOk ? 'qualified' : 'missed';
  return { weekId: isoWeekId(weekStart), start: weekStart, end, discretionarySpent, allowance, essentialsDue, withinAllowance, essentialsOk, status };
}

export function evaluateWeeksSince(trackingStart: ISODate, txns: Transaction[], plan: BudgetPlan, today: ISODate): WeekEvaluation[] {
  const out: WeekEvaluation[] = [];
  for (let w = startOfWeek(trackingStart); w <= today; w = addDays(w, 7)) out.push(evaluateWeek(w, txns, plan, today));
  return out;
}

export function streakBonus(streakAfter: number): number {
  return Math.min(POINTS.streakBonusPerWeek * Math.max(0, streakAfter - 1), POINTS.streakBonusCap);
}

/**
 * Grant points for completed weeks that have not been evaluated yet. Idempotent:
 * a week id in `evaluatedWeeks` is never granted again, so reloads and revisits cannot duplicate rewards.
 */
export function applyWeeklyRewards(g: GardenState, weeks: WeekEvaluation[]): GardenState {
  const done = new Set(g.evaluatedWeeks);
  const fresh = weeks.filter((w) => (w.status === 'qualified' || w.status === 'missed') && !done.has(w.weekId)).sort((a, b) => a.start.localeCompare(b.start));
  if (fresh.length === 0) return g;
  let { currentStreak, longestStreak, successfulWeeks, pointsBalance, lastQualifiedWeek } = g;
  const entries: RewardEntry[] = [];
  for (const w of fresh) {
    if (w.status === 'qualified') {
      currentStreak += 1;
      longestStreak = Math.max(longestStreak, currentStreak);
      successfulWeeks += 1;
      const bonus = streakBonus(currentStreak);
      const pts = POINTS.weeklyBase + bonus;
      pointsBalance += pts;
      lastQualifiedWeek = w.weekId;
      entries.push({ id: `reward-${w.weekId}`, date: addDays(w.end, 1), type: 'weekly_reward', weekId: w.weekId, points: pts, basePoints: POINTS.weeklyBase, streakBonus: bonus, streakAfter: currentStreak, note: `Week of ${w.start}: stayed within the weekly allowance and paid essentials on time` });
    } else {
      currentStreak = 0;
      entries.push({ id: `missed-${w.weekId}`, date: addDays(w.end, 1), type: 'missed_week', weekId: w.weekId, points: 0, streakAfter: 0, note: !w.essentialsOk ? 'An essential bill was not recorded as paid this week' : 'Discretionary spending ran over the weekly allowance' });
    }
    done.add(w.weekId);
  }
  return { ...g, currentStreak, longestStreak, successfulWeeks, pointsBalance, lastQualifiedWeek, evaluatedWeeks: [...done], rewardHistory: [...g.rewardHistory, ...entries] };
}

export type ItemState = 'locked' | 'available' | 'owned' | 'placed';

export function unlockMet(item: GardenItem, g: GardenState, emergencyPercent: number): boolean {
  const r = item.unlockRequirement;
  switch (r.type) {
    case 'none': return true;
    case 'streak': return g.longestStreak >= r.weeks;
    case 'successfulWeeks': return g.successfulWeeks >= r.weeks;
    case 'emergencyFund': return emergencyPercent * 100 >= r.percent;
  }
}

export function unlockLabel(item: GardenItem): string {
  const r = item.unlockRequirement;
  switch (r.type) {
    case 'none': return 'Available to everyone';
    case 'streak': return `Reach a ${r.weeks}-week streak`;
    case 'successfulWeeks': return `Complete ${r.weeks} successful weeks`;
    case 'emergencyFund': return `Emergency fund ${r.percent}% funded`;
  }
}

export function itemState(item: GardenItem, g: GardenState, emergencyPercent: number): ItemState {
  const isThemeOrPath = item.category === 'themes' || item.category === 'paths';
  if (g.ownedItemIds.includes(item.id)) {
    if (isThemeOrPath) return g.activeTheme === item.id || g.activePath === item.id ? 'placed' : 'owned';
    return g.placedItems.some((p) => p.itemId === item.id) ? 'placed' : 'owned';
  }
  return unlockMet(item, g, emergencyPercent) ? 'available' : 'locked';
}

/** Growth stage 0 (sprout) → 2 (full bloom), advancing with each successful week after planting. */
export function growthStage(placedAtQualifiedCount: number, g: GardenState): 0 | 1 | 2 {
  const grown = g.successfulWeeks - placedAtQualifiedCount;
  return grown >= 2 ? 2 : grown >= 1 ? 1 : 0;
}

export function buyItem(g: GardenState, item: GardenItem, today: ISODate, emergencyPercent: number): { ok: true; state: GardenState } | { ok: false; error: string } {
  if (g.ownedItemIds.includes(item.id)) return { ok: false, error: 'You already own this item.' };
  if (!unlockMet(item, g, emergencyPercent)) return { ok: false, error: `Locked: ${unlockLabel(item)}.` };
  if (g.pointsBalance < item.pointCost) return { ok: false, error: `You need ${item.pointCost - g.pointsBalance} more points.` };
  return {
    ok: true,
    state: {
      ...g,
      pointsBalance: g.pointsBalance - item.pointCost,
      ownedItemIds: [...g.ownedItemIds, item.id],
      rewardHistory: [...g.rewardHistory, { id: `buy-${item.id}-${g.rewardHistory.length}`, date: today, type: 'purchase', itemId: item.id, points: -item.pointCost, note: `Bought ${item.name}` }],
    },
  };
}
