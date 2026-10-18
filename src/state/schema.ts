import type {
  BudgetPlan, Cents, FinancialAccount, FinancialGoal, GardenState, ISODate, Paystub, PurchaseScenario, RecommendationStatus, Transaction, UserProfile,
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

/** The four tabs, plus the Money screen opened from Home. */
export type TabId = 'home' | 'simulate' | 'goals' | 'garden' | 'money';

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
  garden: GardenState;
  activity: ActivityEntry[];
  connections: { payroll: boolean; bank: boolean };
}
