import type {
  BudgetPlan, Cents, FinancialAccount, FinancialGoal, ForecastSnapshot, GardenState, ISODate, Paystub, PurchaseScenario, RecommendationStatus, Transaction, UserProfile,
} from '../engine/types';

export interface ActivityEntry {
  id: string;
  date: ISODate;
  kind: 'simulation' | 'plan' | 'goal' | 'garden' | 'account';
  title: string;
  detail?: string;
  amount?: Cents;
}

export interface RecFeedback {
  status: RecommendationStatus;
  category: string;
  updatedAt: ISODate;
}

export type TabId = 'home' | 'plan' | 'goals' | 'simulate' | 'insights' | 'garden';

export interface AppData {
  version: 1;
  /** Fixed "today" for this dataset, so the demo is reproducible. Set when the data is created. */
  asOf: ISODate;
  profile: UserProfile;
  paystub: Paystub | null;
  accounts: FinancialAccount[];
  transactions: Transaction[];
  plan: BudgetPlan;
  goals: FinancialGoal[];
  scenario: { items: PurchaseScenario[]; selectedId: string | null };
  recommendationFeedback: Record<string, RecFeedback>;
  forecastSnapshots: ForecastSnapshot[];
  garden: GardenState;
  activity: ActivityEntry[];
  connections: { payroll: boolean; bank: boolean };
  /** Audit requirement ids the user marked as not applicable. */
  auditNotApplicable: string[];
}
