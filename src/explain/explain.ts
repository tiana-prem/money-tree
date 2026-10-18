/**
 * Explanation layer. Turns structured engine outputs into plain language.
 * This is a deterministic template system (no AI service is configured). It never computes
 * or alters numbers — every figure it mentions is read from the engine's results.
 */
import type { FinancialGoal, PurchaseScenario } from '../engine/types';
import type { ScenarioComparison } from '../engine/scenario';
import { describeDays, fmtDate, fmtMonth } from '../lib/dates';
import { money } from '../lib/money';

export interface Explanation {
  headline: string;
  whatChanged: string;
  whyItMatters: string;
  affected: string;
  options: string[];
  how: string;
}

export function explainPurchase(cmp: ScenarioComparison, items: PurchaseScenario[], goals: FinancialGoal[]): Explanation {
  const included = items.filter((i) => i.included && i.scenarioStatus === 'draft');
  const label = included.length === 1 ? `Buying ${included[0].customName.toLowerCase()}` : `These ${included.length} purchases`;
  const when = included.length === 1 ? (included[0].plannedDate === cmp.baseline.startDate ? ' now' : ` on ${fmtDate(included[0].plannedDate, { year: false })}`) : '';

  const delayed = cmp.goalImpacts.filter((g) => g.kind === 'delayed' && (g.delayDays ?? 0) > 0);
  const beyond = cmp.goalImpacts.filter((g) => g.kind === 'pushed_beyond');
  const parts = [
    ...delayed.slice(0, 2).map((g) => `your ${g.name.toLowerCase()} by ${describeDays(g.delayDays!)}`),
    ...beyond.slice(0, 1).map((g) => `your ${g.name.toLowerCase()} beyond the 5-year projection`),
  ];
  const headline = parts.length
    ? `${label}${when} would delay ${joinList(parts)}.`
    : `${label}${when} has no material effect on your goal dates.`;

  const recurring = included.some((i) => i.recurrence);
  const whatChanged = `${money(cmp.totalCostInHorizon)} of planned outflows over the next ${cmp.horizon} months. Projected cash at the end of that period: ${money(cmp.cashAtHorizon.before)} → ${money(cmp.cashAtHorizon.after)}; savings: ${money(cmp.savingsAtHorizon.before)} → ${money(cmp.savingsAtHorizon.after)}.${recurring ? ` Ongoing cost reduces monthly savings capacity by ${money(cmp.monthlyRecurringCost)}.` : ''}`;

  let whyItMatters: string;
  if (cmp.newShortfallPeriods.length) whyItMatters = `Checking is projected to go negative in ${fmtMonth(cmp.scenario.snapshots[cmp.newShortfallPeriods[0]].monthKey)} — a real cash-flow shortfall.`;
  else if (cmp.safeAfter.safeToSpend < 0 && cmp.safeBefore.safeToSpend >= 0) whyItMatters = `It exceeds what is safe to spend this month by ${money(-cmp.safeAfter.safeToSpend)}, so the difference comes out of planned goal contributions.`;
  else if (delayed.length) whyItMatters = 'The money comes out of contributions that would otherwise have gone to your goals, so they finish later.';
  else whyItMatters = 'Your plan absorbs it without pushing back any goal.';

  const affectedNames = [...delayed, ...beyond].map((g) => g.name);
  const affected = affectedNames.length ? joinList(affectedNames) : 'No goals materially affected';

  const options = [
    'Compare a lower-cost alternative or a later date below.',
    'Exclude the item to see your plan without it.',
    'Apply it to your plan only if you decide to buy it.',
  ];
  const how = `Clover ran the same month-by-month projection twice — once with your current plan and once with ${included.length === 1 ? 'this purchase' : 'these purchases'} added on ${included.length === 1 ? fmtDate(included[0].plannedDate) : 'their planned dates'} — and compared the dates each goal reaches its target.${goals.length ? '' : ' Add a goal to see goal-level impact.'}`;
  return { headline, whatChanged, whyItMatters, affected, options, how };
}

function joinList(xs: string[]): string {
  if (xs.length <= 1) return xs.join('');
  return `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`;
}
