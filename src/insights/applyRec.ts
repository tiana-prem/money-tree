import { useStore } from '../state/store';
import type { Recommendation } from './recommendations';

/** Apply a recommendation's action through ordinary store actions. Only called after explicit confirmation. */
export function applyRecommendation(rec: Recommendation) {
  const s = useStore.getState();
  const d = s.data;
  if (!d || !rec.action) return;
  const a = rec.action;
  switch (a.kind) {
    case 'set_retirement': {
      if (!d.paystub) return;
      s.updatePaystub({
        employeeRetirementPercent: a.percent,
        employeeRetirementContribution: Math.round((d.paystub.grossPay * a.percent) / 100),
        netPay: d.paystub.netPay - a.netReduction,
      });
      s.updateIncome({ netPerPaycheck: d.plan.income.netPerPaycheck - a.netReduction });
      break;
    }
    case 'trim_budget': {
      const line = d.plan.discretionaryBudgets.find((l) => l.id === a.lineId);
      const goal = d.goals.find((g) => g.id === a.goalId);
      if (!line || !goal) return;
      s.setBudgetLine('discretionary', line.id, { amount: line.amount - a.cut });
      const monthly = goal.contributionFrequency === 'monthly' ? goal.contributionAmount : Math.round((goal.contributionAmount * 24) / 12);
      s.setGoalContribution(goal.id, monthly + a.cut);
      break;
    }
    case 'extend_goal': s.updateGoal(a.goalId, { targetDate: a.date }); break;
    case 'raise_goal': s.setGoalContribution(a.goalId, a.amount); break;
    case 'increase_debt': s.updateAccount(a.accountId, { plannedPayment: a.amount }); break;
    case 'update_line': {
      const kind = d.plan.essentialExpenses.some((l) => l.id === a.lineId) ? 'essential' : 'discretionary';
      s.setBudgetLine(kind, a.lineId, { amount: a.amount });
      break;
    }
    case 'navigate': s.setTab(a.tab); return;
  }
  s.setRecFeedback(rec.id, { status: 'accepted', category: rec.category });
  s.toast('Recommendation applied to your plan.');
}
