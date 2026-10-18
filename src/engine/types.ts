import type { Cents } from '../lib/money';
import type { ISODate } from '../lib/dates';

export type { Cents, ISODate };

export type PayFrequency = 'weekly' | 'biweekly' | 'semimonthly' | 'monthly';

export interface PlanningPreferences {
  /** Move cash above the buffer into goals (by priority) at the end of each month. */
  sweepSurplusToGoals: boolean;
  /** If checking would fall below the buffer, pause lowest-priority goal contributions first. */
  protectCashBuffer: boolean;
  horizonMonths: 12 | 24;
}

export interface UserProfile {
  id: string;
  displayName: string;
  onboardingCompleted: boolean;
  payFrequency: PayFrequency;
  currency: 'USD';
  planningPreferences: PlanningPreferences;
  dataSource: 'demo' | 'manual' | 'paystub';
  createdAt: ISODate;
}

export type AccountType = 'checking' | 'savings' | 'credit_card' | 'loan' | 'investment';
export type AccountRole = 'cash' | 'liability' | 'investment';

export interface FinancialAccount {
  id: string;
  name: string;
  institution: string;
  type: AccountType;
  /** Always non-negative. For liabilities this is the amount owed. */
  balance: Cents;
  accountRole: AccountRole;
  isMock: boolean;
  updatedAt: ISODate;
  /** Liabilities only. Annual percentage rate, e.g. 0.2399. */
  apr?: number;
  minimumPayment?: Cents;
  /** Liabilities only. What the plan pays each month. */
  plannedPayment?: Cents;
  /** Day of month the payment is due. */
  dueDay?: number;
}

export interface MatchTier {
  /** Fraction of the employee contribution matched, e.g. 1 = 100%, 0.5 = 50%. */
  matchRate: number;
  /** Width of this tier as a percent of pay, e.g. 3 means "the next 3% of pay". */
  tierPercent: number;
}

export interface EmployerMatchPolicy {
  tiers: MatchTier[];
  description: string;
  vestingNote?: string;
}

export interface Paystub {
  id: string;
  employer: string;
  grossPay: Cents;
  netPay: Cents;
  payFrequency: PayFrequency;
  payDate: ISODate;
  taxWithholding: { federal: Cents; state: Cents; socialSecurity: Cents; medicare: Cents };
  otherDeductions: { label: string; amount: Cents }[];
  employeeRetirementPercent: number;
  employeeRetirementContribution: Cents;
  employerMatchPolicy: EmployerMatchPolicy | null;
  isMock: boolean;
}

export type TransactionType = 'income' | 'expense' | 'debt_payment' | 'transfer_to_savings';
export type SpendKind = 'essential' | 'discretionary';

export interface Transaction {
  id: string;
  accountId: string;
  date: ISODate;
  /** Positive cents. Direction comes from transactionType. */
  amount: Cents;
  /** Budget line id for expenses, goal id for transfers, account id for debt payments. */
  category: string;
  description: string;
  transactionType: TransactionType;
  kind?: SpendKind;
  isSimulated: false;
}

export interface BudgetLine {
  id: string;
  label: string;
  amount: Cents;
  kind: SpendKind;
  dueDay?: number;
}

export type RecurrenceInterval = 'weekly' | 'monthly' | 'yearly';

export interface RecurringCommitment {
  id: string;
  label: string;
  amount: Cents;
  interval: RecurrenceInterval;
  startDate: ISODate;
  /** Total number of occurrences; null = ongoing. */
  occurrences: number | null;
  source: 'applied_scenario' | 'manual';
  scenarioId?: string;
}

export interface PlannedPurchase {
  id: string;
  label: string;
  amount: Cents;
  date: ISODate;
  source: 'applied_scenario' | 'manual';
  scenarioId?: string;
}

export interface IncomeSettings {
  mode: 'paycheck' | 'estimate';
  payFrequency: PayFrequency;
  netPerPaycheck: Cents;
  grossPerPaycheck: Cents;
  /** Any known pay date, used to anchor weekly/biweekly/monthly schedules. */
  anchorPayDate: ISODate;
  /** Used when mode = 'estimate' (irregular income). */
  monthlyEstimate: Cents;
}

export interface BudgetPlan {
  id: string;
  income: IncomeSettings;
  essentialExpenses: BudgetLine[];
  discretionaryBudgets: BudgetLine[];
  plannedPurchases: PlannedPurchase[];
  recurringCommitments: RecurringCommitment[];
  cashBuffer: Cents;
  lastUpdated: ISODate;
}

export type GoalCategory = 'emergency' | 'car' | 'housing' | 'education' | 'travel' | 'retirement' | 'custom';
export type GoalStatus = 'active' | 'paused' | 'completed';

export interface FinancialGoal {
  id: string;
  name: string;
  category: GoalCategory;
  targetAmount: Cents;
  currentSavedAmount: Cents;
  targetDate: ISODate | null;
  contributionAmount: Cents;
  contributionFrequency: 'monthly' | 'per_paycheck';
  /** 1 = highest priority. */
  priority: number;
  status: GoalStatus;
  notes: string;
  createdAt: ISODate;
  /** Month-end balances, oldest first. Historical only. */
  history: { date: ISODate; balance: Cents }[];
}

export type ProductCategory = 'Electronics' | 'Transportation' | 'Furniture' | 'Housing' | 'Lifestyle' | 'Travel' | 'Other';

export interface Product {
  id: string;
  name: string;
  category: ProductCategory;
  price: Cents;
  imageUrl: string;
  imageCredit: string;
  description: string;
  sourceType: 'curated_demo' | 'custom';
  /** Id of a cheaper comparable product, if any. */
  alternativeId?: string;
  /** For recurring products (rent, memberships). */
  recurring?: { interval: RecurrenceInterval; occurrences: number | null };
}

export type PaymentPlan = { type: 'full' } | { type: 'installments'; months: number; aprPercent: number };

export interface PurchaseScenario {
  id: string;
  productId: string | null;
  customName: string;
  category: ProductCategory;
  /** One-time: total price. Recurring: amount per occurrence. */
  price: Cents;
  plannedDate: ISODate;
  recurrence: { interval: RecurrenceInterval; occurrences: number | null } | null;
  payment: PaymentPlan;
  included: boolean;
  description: string;
  baselineId: 'baseline';
  scenarioStatus: 'draft' | 'applied';
  createdAt: ISODate;
}

/** A dated cash outflow fed into the projection (expanded from purchases / commitments). */
export interface CashEvent {
  date: ISODate;
  amount: Cents;
  label: string;
  source: 'planned' | 'scenario';
  refId: string;
}

export interface ProjectionSnapshot {
  id: string;
  scenarioId: string;
  period: number;
  monthKey: string;
  periodStart: ISODate;
  periodEnd: ISODate;
  income: Cents;
  essentials: Cents;
  discretionary: Cents;
  debtPaid: Cents;
  interestCharged: Cents;
  purchases: Cents;
  recurring: Cents;
  /** Goal contributions actually funded this period (scheduled + sweep − paused). */
  contributions: Record<string, Cents>;
  scheduledContributions: Record<string, Cents>;
  pausedContributions: Record<string, Cents>;
  sweptContributions: Record<string, Cents>;
  projectedCash: Cents;
  projectedSavings: Cents;
  projectedDebt: Cents;
  goalBalances: Record<string, Cents>;
  debtBalances: Record<string, Cents>;
  cashFlowShortfall: Cents;
  belowBuffer: boolean;
  events: CashEvent[];
}

export interface ProjectionResult {
  scenarioId: string;
  startDate: ISODate;
  snapshots: ProjectionSnapshot[];
  /** null = not reached within the projection period. */
  goalCompletionDates: Record<string, ISODate | null>;
  debtPayoffDates: Record<string, ISODate | null>;
  totalInterest: Cents;
  shortfallPeriods: number[];
  horizonMonths: number;
}

export type RecommendationStatus = 'new' | 'accepted' | 'dismissed';

export interface GardenItem {
  id: string;
  name: string;
  category: 'plants' | 'trees' | 'pots' | 'paths' | 'decor' | 'themes';
  pointCost: number;
  unlockRequirement: { type: 'none' } | { type: 'streak'; weeks: number } | { type: 'successfulWeeks'; weeks: number } | { type: 'emergencyFund'; percent: number };
  description: string;
  /** Plants grow through stages; other items are static. */
  grows: boolean;
}

export interface PlacedItem {
  slot: number;
  itemId: string;
  placedAt: ISODate;
  /** Number of qualified weeks at the time of placement — growth is measured from here. */
  placedAtQualifiedCount: number;
}

export interface RewardEntry {
  id: string;
  date: ISODate;
  type: 'weekly_reward' | 'missed_week' | 'purchase' | 'starter';
  weekId?: string;
  points: number;
  basePoints?: number;
  streakBonus?: number;
  streakAfter?: number;
  itemId?: string;
  note: string;
}

export interface GardenState {
  pointsBalance: number;
  currentStreak: number;
  longestStreak: number;
  successfulWeeks: number;
  ownedItemIds: string[];
  placedItems: PlacedItem[];
  lastQualifiedWeek: string | null;
  /** Week ids already evaluated (qualified or missed). Prevents duplicate grants. */
  evaluatedWeeks: string[];
  rewardHistory: RewardEntry[];
  activePath: string | null;
  activeTheme: string;
  trackingStartDate: ISODate;
}

export interface ForecastSnapshot {
  monthKey: string;
  /** Snapshot of what the plan predicted at the start of that month. */
  predictedSpending: Cents;
  predictedSavings: Cents;
  predictedByLine: Record<string, Cents>;
  isSynthetic: true;
}
