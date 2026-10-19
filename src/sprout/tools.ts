import { PRODUCTS } from '../data/products';
import { compareOptions } from '../engine/scenario';
import type { PurchaseScenario } from '../engine/types';
import { buildRecommendations } from '../insights/recommendations';
import { derive, effectiveToday } from '../state/derive';
import { useStore } from '../state/store';
import type { AppData, TabId } from '../state/schema';

export interface SproutChange { label: string; before: AppData; after: AppData }
type Args = Record<string, unknown>;
const dollars = (cents: number) => cents / 100;
function amount(value: unknown) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 10_000_000) {
    throw new Error('Enter a dollar amount from 0 to 10,000,000.');
  }
  return Math.round(value * 100);
}
function str(value: unknown, label: string) {
  if (typeof value !== 'string' || !value.trim() || value.length > 160) throw new Error(`Provide a valid ${label}.`);
  return value.trim();
}
function product(id: unknown) {
  const found = PRODUCTS.find((p) => p.id === id);
  if (!found) throw new Error('Product not found. Use get_context for current product IDs.');
  return found;
}
function current() {
  const data = useStore.getState().data;
  if (!data) throw new Error('Finish setting up MoneyTree first.');
  return data;
}
export function getContext() {
  const d = current();
  const x = derive(d);
  return {
    currency: 'USD', units: 'All monetary values in this response are dollars, not cents.',
    scope: 'Educational planning estimates. Catalog prices are illustrative, not live quotes. No actual purchases or payroll changes.',
    page: useStore.getState().tab,
    monthlyTakeHome: dollars(x.summary.monthlyNet), cashBuffer: dollars(d.plan.cashBuffer),
    monthlySavingsCapacity: dollars(x.summary.savingsCapacity), safeToSpend: dollars(x.safe.safeToSpend),
    budgets: [...d.plan.essentialExpenses, ...d.plan.discretionaryBudgets].map((b) => ({ id: b.id, name: b.label, monthlyAmount: dollars(b.amount) })),
    goals: d.goals.map((g) => ({ id: g.id, name: g.name, target: dollars(g.targetAmount), saved: dollars(g.currentSavedAmount), contribution: dollars(g.contributionAmount), frequency: g.contributionFrequency, projectedCompletion: x.baseline.goalCompletionDates[g.id] })),
    products: PRODUCTS.map((p) => ({ id: p.id, name: p.name, price: dollars(p.price), description: p.description, recurrence: p.recurring ?? null })),
    selectedScenarioId: d.scenario.selectedId,
    scenarios: d.scenario.items.map((s) => ({ id: s.id, productId: s.productId, name: s.customName, price: dollars(s.price), included: s.included, status: s.scenarioStatus })),
    recommendations: buildRecommendations(d, x).slice(0, 5).map((r) => ({ title: r.title, reason: r.reasoning, impact: r.impact })),
    currentScenarioImpact: x.comparison ? { goalImpacts: x.comparison.goalImpacts, totalCost: dollars(x.comparison.totalCostInHorizon), safeAfter: dollars(x.comparison.safeAfter.safeToSpend) } : null,
  };
}

/** The same validated boundary handles every voice and text agent action. */
export function runSproutTool(args: Args, onChange?: (change: SproutChange) => void): string {
  try {
    const before = current();
    const s = useStore.getState();
    let label = '';
    switch (args.action) {
      case 'get_context': return JSON.stringify(getContext());
      case 'set_income': {
        const value = amount(args.amount);
        s.updateIncome({ mode: 'estimate', monthlyEstimate: value });
        label = `Monthly take-home estimate set to $${dollars(value).toLocaleString()}`;
        break;
      }
      case 'set_budget': {
        const line = [...before.plan.essentialExpenses, ...before.plan.discretionaryBudgets].find((b) => b.id === args.id);
        if (!line) throw new Error('Budget not found. Read get_context first.');
        s.setBudgetLine(line.kind, line.id, { amount: amount(args.amount) });
        label = `${line.label} monthly budget updated`;
        break;
      }
      case 'set_goal_contribution': {
        const goal = before.goals.find((g) => g.id === args.id);
        if (!goal) throw new Error('Goal not found. Read get_context first.');
        s.setGoalContribution(goal.id, amount(args.amount));
        label = `${goal.name} monthly contribution updated`;
        break;
      }
      case 'set_cash_buffer': s.setCashBuffer(amount(args.amount)); label = 'Cash cushion updated'; break;
      case 'simulate_product': {
        const p = product(args.id);
        const existing = before.scenario.items.find((i) => i.productId === p.id && i.scenarioStatus === 'draft');
        if (existing) { s.selectScenarioItem(existing.id); s.setTab('simulate'); return JSON.stringify({ ok: true, message: 'Already in your simulation.', context: getContext() }); }
        s.addScenarioFromProduct(p); s.setTab('simulate'); label = `Trying ${p.name} in your simulation`; break;
      }
      case 'simulate_custom': {
        const name = str(args.name, 'product name');
        s.addCustomScenario({ productId: null, customName: name, category: 'Other', price: amount(args.amount), plannedDate: effectiveToday(before), recurrence: null, payment: { type: 'full' }, description: 'One-time purchase requested through Sprout.' });
        s.setTab('simulate'); label = `Trying ${name} in your simulation`; break;
      }
      case 'compare_products': {
        const ids = typeof args.ids === 'string' ? args.ids.split(',').map((id) => id.trim()) : args.ids;
        if (!Array.isArray(ids) || ids.length < 2 || ids.length > 4 || new Set(ids).size !== ids.length) throw new Error('Provide two to four different product IDs.');
        const x = derive(before);
        const items: PurchaseScenario[] = ids.map((id) => {
          const p = product(id);
          return { id: p.id, productId: p.id, customName: p.name, category: p.category, price: p.price, plannedDate: x.today, recurrence: p.recurring ?? null, payment: { type: 'full' }, included: true, description: p.description, baselineId: 'baseline', scenarioStatus: 'draft', createdAt: x.today };
        });
        const options = compareOptions(x.inputs, items, before.profile.planningPreferences.horizonMonths, x.baseline);
        const ranked = [...options].sort((a, b) => a.cmp.newShortfallPeriods.length - b.cmp.newShortfallPeriods.length || a.goalsPushedBeyond - b.goalsPushedBeyond || a.totalDelayDays - b.totalDelayDays || a.cmp.totalCostInHorizon - b.cmp.totalCostInHorizon);
        return JSON.stringify({ ok: true, bestFinancialFit: ranked[0].item.productId, method: 'Each option tested independently against your current plan. Rank by new cash shortfalls, goals pushed beyond horizon, goal delay, then cost. Ask about personal preferences; waiting is also an option.', options: options.map((o) => ({ id: o.item.productId, name: o.item.customName, totalCost: dollars(o.cmp.totalCostInHorizon), safeAfter: dollars(o.cmp.safeAfter.safeToSpend), newShortfallMonths: o.cmp.newShortfallPeriods.length, goalImpacts: o.cmp.goalImpacts })) });
      }
      case 'choose_scenario': {
        const item = before.scenario.items.find((i) => i.id === args.id && i.scenarioStatus === 'draft');
        if (!item) throw new Error('Draft scenario not found.');
        s.chooseScenarioItem(item.id); s.setTab('simulate'); label = `Selected ${item.customName} as your only active draft`; break;
      }
      case 'navigate': {
        const tabs: TabId[] = ['home', 'money', 'goals', 'simulate', 'garden'];
        if (!tabs.includes(args.id as TabId)) throw new Error('Unknown page.');
        s.setTab(args.id as TabId); return JSON.stringify({ ok: true, message: `Opened ${args.id}.` });
      }
      default: throw new Error('Unknown action.');
    }
    const after = current();
    onChange?.({ label, before, after });
    return JSON.stringify({ ok: true, message: `${label}. Planning only; nothing purchased. Undo is available in chat.`, context: getContext() });
  } catch (error) {
    return JSON.stringify({ ok: false, error: error instanceof Error ? error.message : 'Could not complete action.' });
  }
}

/** Never restore a stale snapshot over newer edits elsewhere in the app. */
export function undoSproutChange(change: SproutChange): boolean {
  if (useStore.getState().data !== change.after) return false;
  useStore.setState({ data: change.before });
  return true;
}
