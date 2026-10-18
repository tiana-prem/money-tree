import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { ActivityEntry, AppData, RecFeedback, TabId } from './schema';
import type {
  BudgetLine, FinancialAccount, FinancialGoal, IncomeSettings, Paystub, PlanningPreferences, Product, PurchaseScenario,
} from '../engine/types';
import { createDemoData, createManualData } from '../data/seed';
import { todayISO } from '../lib/dates';
import { GARDEN_ITEMS } from '../garden/items';
import { applyWeeklyRewards, buyItem, evaluateWeeksSince } from '../garden/rules';
import { emergencyPercent, effectiveToday } from './derive';
import { money } from '../lib/money';

let idCounter = 0;
export const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${(idCounter++).toString(36)}`;

export interface Toast { id: string; message: string; tone: 'success' | 'info' | 'error' }

interface Store {
  data: AppData | null;
  tab: TabId;
  goalDetailId: string | null;
  toasts: Toast[];

  setTab: (t: TabId) => void;
  openGoal: (id: string | null) => void;
  toast: (message: string, tone?: Toast['tone']) => void;
  dismissToast: (id: string) => void;

  loadDemo: (source?: 'demo' | 'paystub') => void;
  loadManual: (input: Parameters<typeof createManualData>[1]) => void;
  resetDemo: () => void;
  startOver: () => void;

  updateIncome: (patch: Partial<IncomeSettings>) => void;
  setBudgetLine: (kind: 'essential' | 'discretionary', id: string, patch: Partial<BudgetLine>) => void;
  addBudgetLine: (kind: 'essential' | 'discretionary', label: string, amount: number) => void;
  removeBudgetLine: (kind: 'essential' | 'discretionary', id: string) => void;
  setCashBuffer: (c: number) => void;
  setPrefs: (patch: Partial<PlanningPreferences>) => void;
  updatePaystub: (patch: Partial<Paystub>) => void;
  applyPaystubToPlan: () => void;
  updateAccount: (id: string, patch: Partial<FinancialAccount>) => void;
  connectMock: (which: 'payroll' | 'bank') => void;

  addGoal: (g: Omit<FinancialGoal, 'id' | 'createdAt' | 'history' | 'status'>) => string;
  updateGoal: (id: string, patch: Partial<FinancialGoal>) => void;
  deleteGoal: (id: string) => void;
  moveGoal: (id: string, dir: -1 | 1) => void;

  addScenarioFromProduct: (p: Product) => void;
  addCustomScenario: (s: Omit<PurchaseScenario, 'id' | 'baselineId' | 'scenarioStatus' | 'createdAt' | 'included'>) => void;
  updateScenarioItem: (id: string, patch: Partial<PurchaseScenario>) => void;
  removeScenarioItem: (id: string) => void;
  selectScenarioItem: (id: string | null) => void;
  applyScenario: () => void;
  removePlanned: (kind: 'purchase' | 'recurring', id: string) => void;

  setRecFeedback: (id: string, fb: Omit<RecFeedback, 'updatedAt'>) => void;
  toggleAuditNA: (id: string) => void;
  clearRecFeedback: (id: string) => void;
  setGoalContribution: (goalId: string, amount: number) => void;

  syncGarden: () => void;
  buyGardenItem: (itemId: string) => { ok: boolean; error?: string };
  placeItem: (slot: number, itemId: string) => void;
  clearSlot: (slot: number) => void;
  moveItem: (from: number, to: number) => void;
  setTheme: (id: string) => void;
  setPath: (id: string) => void;
}

const logEntry = (data: AppData, e: Omit<ActivityEntry, 'id' | 'date'>): ActivityEntry[] =>
  [{ ...e, id: newId('act'), date: effectiveToday(data) }, ...data.activity].slice(0, 60);

export const useStore = create<Store>()(
  persist(
    (set, get) => {
      /** Apply a change to app data. Every mutation goes through here so `lastUpdated` stays honest. */
      const mutate = (fn: (d: AppData) => AppData) => {
        const d = get().data;
        if (!d) return;
        set({ data: fn(d) });
      };
      const touchPlan = (d: AppData): AppData => ({ ...d, plan: { ...d.plan, lastUpdated: effectiveToday(d) } });

      return {
        data: null,
        tab: 'home',
        goalDetailId: null,
        toasts: [],

        setTab: (t) => {
          set({ tab: t, goalDetailId: t === 'goals' ? get().goalDetailId : null });
          if (t === 'garden') get().syncGarden();
          window.scrollTo(0, 0);
        },
        openGoal: (id) => set({ goalDetailId: id }),
        toast: (message, tone = 'success') => {
          const id = newId('toast');
          set({ toasts: [...get().toasts, { id, message, tone }] });
          setTimeout(() => get().dismissToast(id), 4200);
        },
        dismissToast: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),

        loadDemo: (source = 'demo') => {
          const d = createDemoData(todayISO());
          d.profile.dataSource = source;
          if (source === 'paystub') d.activity = [{ id: newId('act'), date: d.asOf, kind: 'account', title: 'Simulated ADP paystub imported', detail: 'Review the fields on the Plan tab. No real payroll account is connected.' }, ...d.activity];
          set({ data: d, tab: 'home', goalDetailId: null });
        },
        loadManual: (input) => set({ data: createManualData(todayISO(), input), tab: 'home', goalDetailId: null }),
        resetDemo: () => {
          set({ data: createDemoData(todayISO()), tab: 'home', goalDetailId: null });
          get().toast('Demo data restored to the original sample.', 'info');
        },
        startOver: () => set({ data: null, tab: 'home', goalDetailId: null }),

        updateIncome: (patch) => mutate((d) => touchPlan({ ...d, plan: { ...d.plan, income: { ...d.plan.income, ...patch } }, profile: patch.payFrequency ? { ...d.profile, payFrequency: patch.payFrequency } : d.profile })),
        setBudgetLine: (kind, id, patch) => mutate((d) => {
          const key = kind === 'essential' ? 'essentialExpenses' : 'discretionaryBudgets';
          return touchPlan({ ...d, plan: { ...d.plan, [key]: d.plan[key].map((l) => (l.id === id ? { ...l, ...patch } : l)) } });
        }),
        addBudgetLine: (kind, label, amount) => mutate((d) => {
          const key = kind === 'essential' ? 'essentialExpenses' : 'discretionaryBudgets';
          return touchPlan({ ...d, plan: { ...d.plan, [key]: [...d.plan[key], { id: newId('line'), label, amount, kind }] } });
        }),
        removeBudgetLine: (kind, id) => mutate((d) => {
          const key = kind === 'essential' ? 'essentialExpenses' : 'discretionaryBudgets';
          return touchPlan({ ...d, plan: { ...d.plan, [key]: d.plan[key].filter((l) => l.id !== id) } });
        }),
        setCashBuffer: (c) => mutate((d) => touchPlan({ ...d, plan: { ...d.plan, cashBuffer: c } })),
        setPrefs: (patch) => mutate((d) => ({ ...d, profile: { ...d.profile, planningPreferences: { ...d.profile.planningPreferences, ...patch } } })),
        updatePaystub: (patch) => mutate((d) => (d.paystub ? { ...d, paystub: { ...d.paystub, ...patch } } : d)),
        applyPaystubToPlan: () => {
          mutate((d) => {
            if (!d.paystub) return d;
            const s = d.paystub;
            return touchPlan({
              ...d,
              plan: { ...d.plan, income: { ...d.plan.income, mode: 'paycheck', payFrequency: s.payFrequency, netPerPaycheck: s.netPay, grossPerPaycheck: s.grossPay, anchorPayDate: s.payDate } },
              profile: { ...d.profile, payFrequency: s.payFrequency },
              activity: logEntry(d, { kind: 'plan', title: 'Paystub values applied to plan', detail: `Net pay ${money(s.netPay, { exact: true })} per paycheck.` }),
            });
          });
          get().toast('Paystub values applied to your plan.');
        },
        updateAccount: (id, patch) => mutate((d) => ({ ...d, accounts: d.accounts.map((a) => (a.id === id ? { ...a, ...patch, updatedAt: effectiveToday(d) } : a)) })),
        connectMock: (which) => {
          mutate((d) => ({ ...d, connections: { ...d.connections, [which]: true }, activity: logEntry(d, { kind: 'account', title: which === 'payroll' ? 'Simulated ADP connection added' : 'Simulated bank connection added', detail: 'Demo only. No credentials were requested or stored.' }) }));
          get().toast(which === 'payroll' ? 'Simulated payroll connection added.' : 'Simulated bank connection added.', 'info');
        },

        addGoal: (g) => {
          const id = newId('g');
          mutate((d) => ({
            ...d,
            goals: [...d.goals, { ...g, id, status: 'active', createdAt: effectiveToday(d), history: [{ date: effectiveToday(d), balance: g.currentSavedAmount }] }],
            activity: logEntry(d, { kind: 'goal', title: `Goal created: ${g.name}`, amount: g.targetAmount }),
          }));
          return id;
        },
        updateGoal: (id, patch) => mutate((d) => ({ ...d, goals: d.goals.map((g) => (g.id === id ? { ...g, ...patch } : g)) })),
        deleteGoal: (id) => {
          const name = get().data?.goals.find((g) => g.id === id)?.name;
          mutate((d) => ({ ...d, goals: d.goals.filter((g) => g.id !== id), activity: logEntry(d, { kind: 'goal', title: `Goal deleted: ${name}` }) }));
          set({ goalDetailId: null });
          get().toast(`Deleted “${name}”.`, 'info');
        },
        moveGoal: (id, dir) => mutate((d) => {
          const sorted = [...d.goals].sort((a, b) => a.priority - b.priority);
          const i = sorted.findIndex((g) => g.id === id);
          const j = i + dir;
          if (i < 0 || j < 0 || j >= sorted.length) return d;
          [sorted[i], sorted[j]] = [sorted[j], sorted[i]];
          const prio = new Map(sorted.map((g, k) => [g.id, k + 1]));
          return { ...d, goals: d.goals.map((g) => ({ ...g, priority: prio.get(g.id)! })) };
        }),

        addScenarioFromProduct: (p) => {
          const id = newId('sc');
          mutate((d) => ({
            ...d,
            scenario: {
              items: [...d.scenario.items, {
                id, productId: p.id, customName: p.name, category: p.category, price: p.price, plannedDate: effectiveToday(d),
                recurrence: p.recurring ?? null, payment: { type: 'full' }, included: true, description: p.description,
                baselineId: 'baseline', scenarioStatus: 'draft', createdAt: effectiveToday(d),
              }],
              selectedId: id,
            },
            activity: logEntry(d, { kind: 'simulation', title: `Simulated: ${p.name}`, detail: 'Added to a what-if scenario. Nothing was purchased.', amount: p.price }),
          }));
          get().toast(`${p.name} added to your simulation.`);
        },
        addCustomScenario: (s) => {
          const id = newId('sc');
          mutate((d) => ({
            ...d,
            scenario: { items: [...d.scenario.items, { ...s, id, included: true, baselineId: 'baseline', scenarioStatus: 'draft', createdAt: effectiveToday(d) }], selectedId: id },
            activity: logEntry(d, { kind: 'simulation', title: `Simulated: ${s.customName}`, detail: 'Custom what-if purchase. Nothing was purchased.', amount: s.price }),
          }));
          get().toast(`${s.customName} added to your simulation.`);
        },
        updateScenarioItem: (id, patch) => mutate((d) => ({ ...d, scenario: { ...d.scenario, items: d.scenario.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) } })),
        removeScenarioItem: (id) => mutate((d) => {
          const items = d.scenario.items.filter((i) => i.id !== id);
          return { ...d, scenario: { items, selectedId: d.scenario.selectedId === id ? items[items.length - 1]?.id ?? null : d.scenario.selectedId } };
        }),
        selectScenarioItem: (id) => mutate((d) => ({ ...d, scenario: { ...d.scenario, selectedId: id } })),
        applyScenario: () => {
          const d0 = get().data;
          if (!d0) return;
          const toApply = d0.scenario.items.filter((i) => i.included && i.scenarioStatus === 'draft');
          if (toApply.length === 0) return;
          mutate((d) => {
            const plannedPurchases = [...d.plan.plannedPurchases];
            const recurringCommitments = [...d.plan.recurringCommitments];
            for (const i of toApply) {
              if (i.recurrence) {
                recurringCommitments.push({ id: newId('rc'), label: i.customName, amount: i.price, interval: i.recurrence.interval, startDate: i.plannedDate, occurrences: i.recurrence.occurrences, source: 'applied_scenario', scenarioId: i.id });
              } else if (i.payment.type === 'installments' && i.payment.months > 1) {
                const pay = i.payment;
                const r = pay.aprPercent / 100 / 12;
                const amt = r === 0 ? Math.ceil(i.price / pay.months) : Math.round((i.price * r) / (1 - Math.pow(1 + r, -pay.months)));
                recurringCommitments.push({ id: newId('rc'), label: `${i.customName} (installments)`, amount: amt, interval: 'monthly', startDate: i.plannedDate, occurrences: pay.months, source: 'applied_scenario', scenarioId: i.id });
              } else {
                plannedPurchases.push({ id: newId('pp'), label: i.customName, amount: i.price, date: i.plannedDate, source: 'applied_scenario', scenarioId: i.id });
              }
            }
            return touchPlan({
              ...d,
              plan: { ...d.plan, plannedPurchases, recurringCommitments },
              scenario: { ...d.scenario, items: d.scenario.items.map((i) => (toApply.some((a) => a.id === i.id) ? { ...i, scenarioStatus: 'applied' as const } : i)) },
              activity: logEntry(d, { kind: 'plan', title: `Plan updated: ${toApply.map((i) => i.customName).join(', ')}`, detail: 'Added as planned spending. No transaction was recorded.' }),
            });
          });
          get().toast('Scenario applied to your plan as planned spending.');
        },
        removePlanned: (kind, id) => mutate((d) => {
          const plan = kind === 'purchase'
            ? { ...d.plan, plannedPurchases: d.plan.plannedPurchases.filter((p) => p.id !== id) }
            : { ...d.plan, recurringCommitments: d.plan.recurringCommitments.filter((p) => p.id !== id) };
          const removed = kind === 'purchase' ? d.plan.plannedPurchases.find((p) => p.id === id) : d.plan.recurringCommitments.find((p) => p.id === id);
          return touchPlan({
            ...d, plan,
            scenario: { ...d.scenario, items: d.scenario.items.map((i) => (removed?.scenarioId === i.id ? { ...i, scenarioStatus: 'draft' as const } : i)) },
            activity: logEntry(d, { kind: 'plan', title: `Removed from plan: ${removed?.label ?? 'planned item'}` }),
          });
        }),

        setRecFeedback: (id, fb) => mutate((d) => ({ ...d, recommendationFeedback: { ...d.recommendationFeedback, [id]: { ...fb, updatedAt: effectiveToday(d) } } })),
        clearRecFeedback: (id) => mutate((d) => { const { [id]: _removed, ...rest } = d.recommendationFeedback; return { ...d, recommendationFeedback: rest }; }),
        toggleAuditNA: (id) => mutate((d) => ({ ...d, auditNotApplicable: d.auditNotApplicable.includes(id) ? d.auditNotApplicable.filter((x) => x !== id) : [...d.auditNotApplicable, id] })),
        setGoalContribution: (goalId, amount) => mutate((d) => ({ ...d, goals: d.goals.map((g) => (g.id === goalId ? { ...g, contributionAmount: amount, contributionFrequency: 'monthly' } : g)) })),

        syncGarden: () => mutate((d) => {
          const weeks = evaluateWeeksSince(d.garden.trackingStartDate, d.transactions, d.plan, effectiveToday(d));
          const next = applyWeeklyRewards(d.garden, weeks);
          return next === d.garden ? d : { ...d, garden: next };
        }),
        buyGardenItem: (itemId) => {
          const d = get().data;
          const item = GARDEN_ITEMS.find((i) => i.id === itemId);
          if (!d || !item) return { ok: false, error: 'Item not found.' };
          const r = buyItem(d.garden, item, effectiveToday(d), emergencyPercent(d));
          if (!r.ok) return r;
          let garden = r.state;
          if (item.category === 'themes') garden = { ...garden, activeTheme: item.id };
          if (item.category === 'paths') garden = { ...garden, activePath: item.id };
          set({ data: { ...d, garden, activity: logEntry(d, { kind: 'garden', title: `Garden: bought ${item.name}`, detail: `${item.pointCost} points` }) } });
          get().toast(`${item.name} added to your garden inventory.`);
          return { ok: true };
        },
        placeItem: (slot, itemId) => mutate((d) => ({
          ...d,
          garden: {
            ...d.garden,
            placedItems: [...d.garden.placedItems.filter((p) => p.slot !== slot && p.itemId !== itemId), { slot, itemId, placedAt: effectiveToday(d), placedAtQualifiedCount: d.garden.successfulWeeks }],
          },
        })),
        clearSlot: (slot) => mutate((d) => ({ ...d, garden: { ...d.garden, placedItems: d.garden.placedItems.filter((p) => p.slot !== slot) } })),
        moveItem: (from, to) => mutate((d) => {
          if (from === to) return d;
          const a = d.garden.placedItems.find((p) => p.slot === from);
          if (!a) return d;
          const b = d.garden.placedItems.find((p) => p.slot === to);
          const rest = d.garden.placedItems.filter((p) => p.slot !== from && p.slot !== to);
          return { ...d, garden: { ...d.garden, placedItems: [...rest, { ...a, slot: to }, ...(b ? [{ ...b, slot: from }] : [])] } };
        }),
        setTheme: (id) => mutate((d) => ({ ...d, garden: { ...d.garden, activeTheme: id } })),
        setPath: (id) => mutate((d) => ({ ...d, garden: { ...d.garden, activePath: id } })),
      };
    },
    {
      name: 'clover-v1',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ data: s.data, tab: s.tab }),
      version: 1,
    },
  ),
);
