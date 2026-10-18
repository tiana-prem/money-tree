import type { Cents, IncomeSettings, ISODate, PayFrequency } from './types';
import { addDays, addMonths, daysInMonth, diffDays, parseISO, toISO } from '../lib/dates';

export const PAYCHECKS_PER_YEAR: Record<PayFrequency, number> = {
  weekly: 52,
  biweekly: 26,
  semimonthly: 24,
  monthly: 12,
};

export const FREQUENCY_LABEL: Record<PayFrequency, string> = {
  weekly: 'Weekly (52 paychecks/yr)',
  biweekly: 'Every two weeks (26/yr)',
  semimonthly: 'Twice a month (24/yr)',
  monthly: 'Monthly (12/yr)',
};

/** Annualized amount = per-paycheck × paychecks per year. */
export function annualize(perPaycheck: Cents, freq: PayFrequency): Cents {
  return perPaycheck * PAYCHECKS_PER_YEAR[freq];
}

/** Monthly planning basis = annualized ÷ 12, rounded to the cent. */
export function toMonthly(perPaycheck: Cents, freq: PayFrequency): Cents {
  return Math.round(annualize(perPaycheck, freq) / 12);
}

export function monthlyNetIncome(income: IncomeSettings): Cents {
  return income.mode === 'estimate' ? income.monthlyEstimate : toMonthly(income.netPerPaycheck, income.payFrequency);
}

export function monthlyGrossIncome(income: IncomeSettings): Cents {
  return income.mode === 'estimate' ? income.monthlyEstimate : toMonthly(income.grossPerPaycheck, income.payFrequency);
}

/**
 * All pay dates within [from, to] inclusive.
 * - weekly/biweekly: every 7/14 days from the anchor
 * - semimonthly: the 15th and the last day of each month
 * - monthly: the anchor's day of month (clamped to month length)
 */
export function payDatesBetween(income: IncomeSettings, from: ISODate, to: ISODate): ISODate[] {
  if (income.mode === 'estimate') return [];
  const out: ISODate[] = [];
  const f = income.payFrequency;
  if (f === 'weekly' || f === 'biweekly') {
    const step = f === 'weekly' ? 7 : 14;
    const offset = diffDays(from, income.anchorPayDate);
    const k = Math.ceil(offset / step);
    let d = addDays(income.anchorPayDate, k * step);
    while (d <= to) {
      if (d >= from) out.push(d);
      d = addDays(d, step);
    }
    return out;
  }
  // Month-based schedules
  let cursor = from.slice(0, 8) + '01';
  while (cursor <= to) {
    const p = parseISO(cursor);
    const dim = daysInMonth(p.getUTCFullYear(), p.getUTCMonth());
    const candidates =
      f === 'semimonthly'
        ? [15, dim]
        : [Math.min(parseISO(income.anchorPayDate).getUTCDate(), dim)];
    for (const day of candidates) {
      const d = toISO(new Date(Date.UTC(p.getUTCFullYear(), p.getUTCMonth(), day)));
      if (d >= from && d <= to) out.push(d);
    }
    cursor = addMonths(cursor, 1);
  }
  return out;
}

export function nextPayDate(income: IncomeSettings, after: ISODate): ISODate | null {
  const list = payDatesBetween(income, addDays(after, 1), addDays(after, 70));
  return list[0] ?? null;
}
