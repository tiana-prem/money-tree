/** All stored money is integer cents. These helpers are the only place that converts. */
export type Cents = number;

export const dollars = (d: number): Cents => Math.round(d * 100);
export const toDollars = (c: Cents): number => c / 100;

const fmt0 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const fmt2 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Format cents as USD. `exact` shows cents; otherwise rounds to whole dollars. */
export function money(c: Cents, opts: { exact?: boolean; sign?: boolean } = {}): string {
  const f = opts.exact ? fmt2 : fmt0;
  const s = f.format(Math.abs(c) / 100);
  if (c < 0) return `−${s}`;
  if (opts.sign && c > 0) return `+${s}`;
  return s;
}

/** Compact format for chart axes: $1.2k, $14k. */
export function moneyShort(c: Cents): string {
  const d = c / 100;
  const a = Math.abs(d);
  const sign = d < 0 ? '−' : '';
  if (a >= 1_000_000) return `${sign}$${(a / 1_000_000).toFixed(1)}M`;
  if (a >= 10_000) return `${sign}$${Math.round(a / 1000)}k`;
  if (a >= 1000) return `${sign}$${(a / 1000).toFixed(1)}k`;
  return `${sign}$${Math.round(a)}`;
}

/**
 * Parse user-entered dollars ("1,200.50", "$45") into cents.
 * Returns null for anything that is not a finite, non-negative amount with at most 2 decimals.
 */
export function parseDollars(input: string): Cents | null {
  const cleaned = input.replace(/[$,\s]/g, '');
  if (cleaned === '' || !/^\d*(\.\d{0,2})?$/.test(cleaned)) return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

export const sum = (xs: Cents[]): Cents => xs.reduce((a, b) => a + b, 0);
