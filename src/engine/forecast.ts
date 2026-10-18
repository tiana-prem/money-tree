import type { BudgetLine, Cents, ForecastSnapshot, Transaction } from './types';
import { monthKey } from '../lib/dates';

export interface MonthActuals {
  monthKey: string;
  spending: Cents;
  savings: Cents;
  byLine: Record<string, Cents>;
}

/** Actual spending (essential + discretionary expenses) and savings transfers per calendar month. */
export function actualsByMonth(txns: Transaction[]): Record<string, MonthActuals> {
  const out: Record<string, MonthActuals> = {};
  for (const t of txns) {
    const k = monthKey(t.date);
    const m = (out[k] ??= { monthKey: k, spending: 0, savings: 0, byLine: {} });
    if (t.transactionType === 'expense') {
      m.spending += t.amount;
      m.byLine[t.category] = (m.byLine[t.category] ?? 0) + t.amount;
    } else if (t.transactionType === 'transfer_to_savings') m.savings += t.amount;
  }
  return out;
}

export interface ReportRow {
  monthKey: string;
  predictedSpending: Cents;
  actualSpending: Cents;
  spendingError: Cents;
  predictedSavings: Cents;
  actualSavings: Cents;
  savingsError: Cents;
}

export interface LineDiff { lineId: string; label: string; predicted: Cents; actual: Cents; diff: Cents; count: number; largest: Cents }

export interface ReportCard {
  rows: ReportRow[];
  /** Mean absolute error in cents, over the same months for both quantities. */
  maeSpending: Cents;
  maeSavings: Cents;
  /** Mean absolute percentage error, as a fraction. */
  mapeSpending: number;
  latest: ReportRow | null;
  latestDiffs: LineDiff[];
  suggestions: { lineId: string; label: string; current: Cents; suggested: Cents; avgActual: Cents }[];
}

/**
 * Compare what each month's plan predicted (synthetic snapshots) with what the transactions show.
 * Error = actual − predicted. MAE = mean(|error|) across completed months only (like-for-like).
 */
export function buildReportCard(snapshots: ForecastSnapshot[], txns: Transaction[], lines: BudgetLine[], currentMonth: string): ReportCard {
  const actual = actualsByMonth(txns);
  const rows: ReportRow[] = snapshots
    .filter((s) => s.monthKey < currentMonth && actual[s.monthKey])
    .sort((a, b) => a.monthKey.localeCompare(b.monthKey))
    .map((s) => {
      const a = actual[s.monthKey];
      return {
        monthKey: s.monthKey,
        predictedSpending: s.predictedSpending, actualSpending: a.spending, spendingError: a.spending - s.predictedSpending,
        predictedSavings: s.predictedSavings, actualSavings: a.savings, savingsError: a.savings - s.predictedSavings,
      };
    });
  const mean = (xs: number[]) => (xs.length ? xs.reduce((x, y) => x + y, 0) / xs.length : 0);
  const maeSpending = Math.round(mean(rows.map((r) => Math.abs(r.spendingError))));
  const maeSavings = Math.round(mean(rows.map((r) => Math.abs(r.savingsError))));
  const mapeSpending = mean(rows.filter((r) => r.actualSpending > 0).map((r) => Math.abs(r.spendingError) / r.actualSpending));
  const latest = rows[rows.length - 1] ?? null;

  let latestDiffs: LineDiff[] = [];
  if (latest) {
    const snap = snapshots.find((s) => s.monthKey === latest.monthKey)!;
    const monthTx = txns.filter((t) => t.transactionType === 'expense' && monthKey(t.date) === latest.monthKey);
    latestDiffs = lines
      .map((l) => {
        const tx = monthTx.filter((t) => t.category === l.id);
        const act = tx.reduce((a, t) => a + t.amount, 0);
        const pred = snap.predictedByLine[l.id] ?? l.amount;
        return { lineId: l.id, label: l.label, predicted: pred, actual: act, diff: act - pred, count: tx.length, largest: tx.reduce((m, t) => Math.max(m, t.amount), 0) };
      })
      .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))
      .slice(0, 4);
  }

  // Suggest updating a budget line when the 3 most recent months all ran over by > 5%.
  const recent = rows.slice(-3).map((r) => r.monthKey);
  const suggestions = recent.length < 3 ? [] : lines.flatMap((l) => {
    const acts = recent.map((k) => actual[k]?.byLine[l.id] ?? 0);
    if (!acts.every((a) => a > l.amount * 1.05)) return [];
    const avg = Math.round(mean(acts));
    return [{ lineId: l.id, label: l.label, current: l.amount, suggested: Math.round(avg / 500) * 500, avgActual: avg }];
  });

  return { rows, maeSpending, maeSavings, mapeSpending, latest, latestDiffs, suggestions };
}
