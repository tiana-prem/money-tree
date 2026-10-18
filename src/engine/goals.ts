import type { Cents, FinancialGoal, ISODate, ProjectionResult } from './types';
import type { BudgetPlan } from './types';
import { goalMonthlyContribution, isGoalComplete } from './plan';
import { AVG_DAYS_PER_MONTH, addDays, diffDays, monthsBetween } from '../lib/dates';

export type GoalTrack = 'complete' | 'on_track' | 'behind' | 'overdue' | 'no_contribution' | 'paused' | 'no_target_date';

export interface GoalAnalysis {
  goalId: string;
  remaining: Cents;
  percent: number;
  monthlyContribution: Cents;
  /** Remaining ÷ monthly contribution, contribution-only (no sweep, no pauses). null if contribution is 0. */
  simpleMonths: number | null;
  simpleCompletionDate: ISODate | null;
  /** From the full projection engine (includes surplus sweep and buffer pauses). */
  projectedCompletionDate: ISODate | null;
  monthsUntilTarget: number | null;
  /** Remaining ÷ months until target date. */
  requiredMonthly: Cents | null;
  /** Extra monthly needed beyond the current contribution to hit the target date. */
  gapMonthly: Cents | null;
  track: GoalTrack;
  feasibleWithCapacity: boolean | null;
}

/**
 * Remaining = max(0, target − saved)
 * Months to completion = remaining ÷ monthly contribution   (fractional; dates rounded up to the whole day)
 * Required monthly = remaining ÷ months until target date   (months = days ÷ 30.4375)
 */
export function analyzeGoal(goal: FinancialGoal, plan: BudgetPlan, projection: ProjectionResult | null, today: ISODate, unallocated: Cents): GoalAnalysis {
  const remaining = Math.max(0, goal.targetAmount - goal.currentSavedAmount);
  const percent = goal.targetAmount > 0 ? Math.min(1, goal.currentSavedAmount / goal.targetAmount) : 0;
  const monthlyContribution = goalMonthlyContribution(goal, plan);
  const simpleMonths = monthlyContribution > 0 ? remaining / monthlyContribution : null;
  const simpleCompletionDate = simpleMonths === null ? null : addDays(today, Math.ceil(simpleMonths * AVG_DAYS_PER_MONTH));
  const projectedCompletionDate = projection?.goalCompletionDates[goal.id] ?? null;

  let monthsUntilTarget: number | null = null;
  let requiredMonthly: Cents | null = null;
  let gapMonthly: Cents | null = null;
  let feasibleWithCapacity: boolean | null = null;
  if (goal.targetDate) {
    monthsUntilTarget = monthsBetween(today, goal.targetDate);
    if (monthsUntilTarget > 0) {
      requiredMonthly = Math.ceil(remaining / monthsUntilTarget);
      gapMonthly = Math.max(0, requiredMonthly - monthlyContribution);
      feasibleWithCapacity = gapMonthly <= Math.max(0, unallocated);
    }
  }

  let track: GoalTrack;
  if (isGoalComplete(goal)) track = 'complete';
  else if (goal.status === 'paused') track = 'paused';
  else if (goal.targetDate && diffDays(goal.targetDate, today) <= 0) track = 'overdue';
  else if (!goal.targetDate) track = monthlyContribution > 0 || projectedCompletionDate ? 'no_target_date' : 'no_contribution';
  else if (monthlyContribution <= 0 && !projectedCompletionDate) track = 'no_contribution';
  else track = projectedCompletionDate && projectedCompletionDate <= goal.targetDate ? 'on_track' : 'behind';

  return {
    goalId: goal.id, remaining, percent, monthlyContribution, simpleMonths, simpleCompletionDate, projectedCompletionDate,
    monthsUntilTarget, requiredMonthly, gapMonthly, track, feasibleWithCapacity,
  };
}

export const TRACK_LABEL: Record<GoalTrack, string> = {
  complete: 'Complete',
  on_track: 'On track',
  behind: 'Behind target date',
  overdue: 'Target date passed',
  no_contribution: 'Needs a contribution',
  paused: 'Paused',
  no_target_date: 'No target date',
};
