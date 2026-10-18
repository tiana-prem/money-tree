import type { AppData } from './schema';
import type { ISODate, ProjectionResult } from '../engine/types';
import { EngineInputs, PlanSummary, SafeToSpend, allocateByPriority, safeToSpend, sortByPriority, summarizePlan, AllocationRow } from '../engine/plan';
import { project } from '../engine/projection';
import { GoalAnalysis, analyzeGoal } from '../engine/goals';
import { ScenarioComparison, compareScenario } from '../engine/scenario';
import { MatchAnalysis, analyzeMatch } from '../engine/match';
import { todayISO } from '../lib/dates';
import { WeekEvaluation, evaluateWeek } from '../garden/rules';
import { startOfWeek } from '../lib/dates';

/** Demo data is pinned to the day it was created so the walkthrough is reproducible. */
export function effectiveToday(d: AppData): ISODate {
  return d.profile.dataSource === 'manual' ? todayISO() : d.asOf;
}

export function engineInputs(d: AppData): EngineInputs {
  return { today: effectiveToday(d), plan: d.plan, accounts: d.accounts, goals: d.goals, transactions: d.transactions, prefs: d.profile.planningPreferences };
}

export function emergencyPercent(d: AppData): number {
  const ef = d.goals.find((g) => g.category === 'emergency');
  return ef && ef.targetAmount > 0 ? Math.min(1, ef.currentSavedAmount / ef.targetAmount) : 0;
}

export interface Derived {
  today: ISODate;
  inputs: EngineInputs;
  summary: PlanSummary;
  safe: SafeToSpend;
  baseline: ProjectionResult;
  goalAnalyses: Record<string, GoalAnalysis>;
  allocation: AllocationRow[];
  sortedGoalIds: string[];
  comparison: ScenarioComparison | null;
  match: MatchAnalysis | null;
  currentWeek: WeekEvaluation;
}

const cache = new WeakMap<AppData, Derived>();

/** All derived values are recomputed from authoritative inputs, cached per immutable data snapshot. */
export function derive(d: AppData): Derived {
  const hit = cache.get(d);
  if (hit) return hit;
  const today = effectiveToday(d);
  const inputs = engineInputs(d);
  const summary = summarizePlan(inputs);
  const baseline = project(inputs, { scenarioId: 'baseline' });
  const goalAnalyses: Record<string, GoalAnalysis> = {};
  for (const g of d.goals) goalAnalyses[g.id] = analyzeGoal(g, d.plan, baseline, today, summary.unallocated);
  const draftIncluded = d.scenario.items.filter((i) => i.included && i.scenarioStatus === 'draft');
  const comparison = draftIncluded.length
    ? compareScenario(inputs, d.scenario.items.filter((i) => i.scenarioStatus === 'draft'), { horizon: d.profile.planningPreferences.horizonMonths, baseline })
    : null;
  const out: Derived = {
    today, inputs, summary,
    safe: safeToSpend(inputs),
    baseline, goalAnalyses,
    allocation: allocateByPriority(d.goals, d.plan, summary.savingsCapacity),
    sortedGoalIds: sortByPriority(d.goals).map((g) => g.id),
    comparison,
    match: d.paystub ? analyzeMatch(d.paystub) : null,
    currentWeek: evaluateWeek(startOfWeek(today), d.transactions, d.plan, today),
  };
  cache.set(d, out);
  return out;
}
