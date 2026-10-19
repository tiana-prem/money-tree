import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createDemoData } from '../data/seed';
import { useStore } from '../state/store';
import { getContext, runSproutTool, undoSproutChange, type SproutChange } from './tools';

beforeEach(() => {
  vi.stubGlobal('window', { scrollTo: vi.fn() });
  useStore.setState({ data: createDemoData('2026-10-18'), tab: 'home', toast: vi.fn() });
});
const call = (args: Record<string, unknown>) => JSON.parse(runSproutTool(args));
describe('Sprout app actions', () => {
  it('reports dollar values and excludes identifying account information', () => {
    const ctx = getContext();
    expect(ctx.products[0].price).toBe(1199);
    expect(ctx).not.toHaveProperty('accounts');
    expect(ctx).not.toHaveProperty('profile');
  });
  it('updates take-home income in cents and supports safe undo', () => {
    let change: SproutChange | undefined;
    const before = useStore.getState().data;
    const result = JSON.parse(runSproutTool({ action: 'set_income', amount: 6500.25 }, (c) => { change = c; }));
    expect(result.ok).toBe(true);
    expect(useStore.getState().data!.plan.income.monthlyEstimate).toBe(650025);
    expect(getContext().monthlyTakeHome).toBe(6500.25);
    expect(undoSproutChange(change!)).toBe(true);
    expect(useStore.getState().data).toBe(before);
  });
  it('refuses to undo across a subsequent manual edit', () => {
    let change: SproutChange | undefined;
    runSproutTool({ action: 'set_income', amount: 6000 }, (c) => { change = c; });
    useStore.getState().setCashBuffer(99900);
    expect(undoSproutChange(change!)).toBe(false);
    expect(useStore.getState().data!.plan.cashBuffer).toBe(99900);
  });
  it.each([-1, NaN, Infinity, '5000', 10000001, null])('rejects unsafe amount %s without mutation', (value) => {
    const before = useStore.getState().data;
    expect(call({ action: 'set_income', amount: value }).ok).toBe(false);
    expect(useStore.getState().data).toBe(before);
  });
  it('simulates a catalog purchase without committing it or duplicating it', () => {
    const plan = useStore.getState().data!.plan;
    expect(call({ action: 'simulate_product', id: 'p-laptop' }).ok).toBe(true);
    call({ action: 'simulate_product', id: 'p-laptop' });
    expect(useStore.getState().data!.scenario.items).toHaveLength(1);
    expect(useStore.getState().data!.plan).toBe(plan);
    expect(useStore.getState().tab).toBe('simulate');
  });
  it('compares independently without changing a plan or scenario', () => {
    const before = useStore.getState().data;
    const result = call({ action: 'compare_products', ids: 'p-laptop,p-laptop-budget' });
    expect(result.ok).toBe(true);
    expect(result.options).toHaveLength(2);
    expect(result.options[0].totalCost).toBe(1599);
    expect(result.bestFinancialFit).toBe('p-laptop-budget');
    expect(useStore.getState().data).toBe(before);
  });
  it('validates comparison IDs and rejects unknown actions', () => {
    expect(call({ action: 'compare_products', ids: ['p-laptop', 'missing'] }).ok).toBe(false);
    expect(call({ action: 'compare_products', ids: ['p-laptop', 'p-laptop'] }).ok).toBe(false);
    expect(call({ action: 'delete_all' }).ok).toBe(false);
    expect(call({ action: 'navigate', id: 'bad' }).ok).toBe(false);
  });
  it('validates budget and goal IDs and converts monthly contributions', () => {
    const data = useStore.getState().data!;
    const budget = data.plan.essentialExpenses[0];
    expect(call({ action: 'set_budget', id: budget.id, amount: 1200 }).ok).toBe(true);
    expect(useStore.getState().data!.plan.essentialExpenses[0].amount).toBe(120000);
    expect(call({ action: 'set_goal_contribution', id: data.goals[0].id, amount: 250 }).ok).toBe(true);
    expect(useStore.getState().data!.goals[0].contributionFrequency).toBe('monthly');
    expect(call({ action: 'set_budget', id: 'missing', amount: 1 }).ok).toBe(false);
  });
  it('creates a one-time custom product and validates its name', () => {
    expect(call({ action: 'simulate_custom', name: 'Camera', amount: 349.95 }).ok).toBe(true);
    expect(useStore.getState().data!.scenario.items[0].price).toBe(34995);
    expect(call({ action: 'simulate_custom', name: '', amount: 100 }).ok).toBe(false);
  });
  it('fails cleanly after the profile is cleared', () => {
    useStore.setState({ data: null });
    expect(call({ action: 'set_income', amount: 5000 }).ok).toBe(false);
  });
});
