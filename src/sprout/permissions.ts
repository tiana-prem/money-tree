import { runSproutTool, type SproutChange } from './tools';
import { useStore } from '../state/store';
import { PRODUCTS } from '../data/products';
type Request = { label: string; approve: () => void; cancel: () => void };
const readOnly = new Set(['get_context', 'compare_products', 'navigate']);
const edits = new Set(['set_income', 'set_budget', 'set_goal_contribution', 'set_cash_buffer', 'simulate_product', 'simulate_custom', 'choose_scenario']);
export function createPermissionGate(show: (request: Request | null) => void) {
  let cancelPending: (() => void) | undefined;
  return {
    cancel() { cancelPending?.(); },
    run(args: Record<string, unknown>, onChange?: (change: SproutChange) => void): string | Promise<string> {
      const action = String(args.action);
      if (readOnly.has(action) || !edits.has(action)) return runSproutTool(args, onChange);
      if (cancelPending) return JSON.stringify({ ok: false, error: 'A change is already waiting for approval.' });
      const before = useStore.getState().data;
      if (!before) return JSON.stringify({ ok: false, error: 'Set up your plan first.' });
      const dollars = typeof args.amount === 'number' ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(args.amount) : 'an invalid amount';
      const budget = [...before.plan.essentialExpenses, ...before.plan.discretionaryBudgets].find(b => b.id === args.id);
      const goal = before.goals.find(g => g.id === args.id);
      const labels: Record<string, string> = {
        set_income: `Set monthly take-home income estimate to ${dollars}.`,
        set_budget: `Set ${budget?.label ?? 'unknown budget'} to ${dollars} per month.`,
        set_goal_contribution: `Set ${goal?.name ?? 'unknown goal'} contribution to ${dollars} per month.`,
        set_cash_buffer: `Set your cash cushion to ${dollars}.`,
        simulate_product: `Add ${PRODUCTS.find(p => p.id === args.id)?.name ?? 'unknown product'} to your draft simulation.`,
        simulate_custom: `Test a one-time ${String(args.name ?? 'purchase')} for ${dollars}.`,
        choose_scenario: `Make ${before.scenario.items.find(i => i.id === args.id)?.customName ?? 'unknown draft'} the only active draft.`,
      };
      return new Promise(resolve => {
        let done = false;
        const finish = (approved: boolean) => {
          if (done) return; done = true; clearTimeout(timer); cancelPending = undefined; show(null);
          if (!approved) return resolve(JSON.stringify({ ok: false, error: 'Change was not approved. Nothing changed. Do not retry unless asked.' }));
          if (useStore.getState().data !== before) return resolve(JSON.stringify({ ok: false, error: 'Plan changed while awaiting approval. Read context and propose again.' }));
          resolve(runSproutTool(args, onChange));
        };
        const timer = setTimeout(() => finish(false), 25000);
        cancelPending = () => finish(false);
        show({ label: labels[action], approve: () => finish(true), cancel: cancelPending });
      });
    },
  };
}
