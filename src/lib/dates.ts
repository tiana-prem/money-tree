/** Dates are stored as ISO calendar strings (YYYY-MM-DD) and handled in UTC to avoid DST drift. */
export type ISODate = string;

export const DAY_MS = 86_400_000;
/** Average days per month, used only to express fractional months (365.25 / 12). */
export const AVG_DAYS_PER_MONTH = 30.4375;

export function parseISO(d: ISODate): Date {
  const [y, m, day] = d.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, day));
}

export function toISO(d: Date): ISODate {
  return d.toISOString().slice(0, 10);
}

export function todayISO(): ISODate {
  const n = new Date();
  return toISO(new Date(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate())));
}

export function isValidISO(d: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
  const p = parseISO(d);
  return !Number.isNaN(p.getTime()) && toISO(p) === d;
}

export function addDays(d: ISODate, n: number): ISODate {
  return toISO(new Date(parseISO(d).getTime() + n * DAY_MS));
}

/** Add calendar months, clamping the day to the end of the target month. */
export function addMonths(d: ISODate, n: number): ISODate {
  const p = parseISO(d);
  const y = p.getUTCFullYear();
  const m = p.getUTCMonth() + n;
  const target = new Date(Date.UTC(y, m, 1));
  const dim = daysInMonth(target.getUTCFullYear(), target.getUTCMonth());
  target.setUTCDate(Math.min(p.getUTCDate(), dim));
  return toISO(target);
}

export function daysInMonth(year: number, monthIndex0: number): number {
  return new Date(Date.UTC(year, monthIndex0 + 1, 0)).getUTCDate();
}

export function diffDays(a: ISODate, b: ISODate): number {
  return Math.round((parseISO(a).getTime() - parseISO(b).getTime()) / DAY_MS);
}

export function startOfMonth(d: ISODate): ISODate {
  return d.slice(0, 8) + '01';
}

export function endOfMonth(d: ISODate): ISODate {
  const p = parseISO(d);
  return toISO(new Date(Date.UTC(p.getUTCFullYear(), p.getUTCMonth() + 1, 0)));
}

export function monthKey(d: ISODate): string {
  return d.slice(0, 7);
}

/** Monday of the ISO week containing d. */
export function startOfWeek(d: ISODate): ISODate {
  const p = parseISO(d);
  const dow = (p.getUTCDay() + 6) % 7; // Monday = 0
  return addDays(d, -dow);
}

/** ISO-8601 week id, e.g. 2026-W42. Used as an idempotency key for weekly rewards. */
export function isoWeekId(d: ISODate): string {
  const p = parseISO(d);
  const t = new Date(Date.UTC(p.getUTCFullYear(), p.getUTCMonth(), p.getUTCDate()));
  const dayNum = (t.getUTCDay() + 6) % 7;
  t.setUTCDate(t.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(t.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((t.getTime() - firstThursday.getTime()) / DAY_MS - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
  return `${t.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function fmtDate(d: ISODate | null | undefined, opts: { year?: boolean } = {}): string {
  if (!d) return '—';
  const p = parseISO(d);
  const base = `${MONTHS[p.getUTCMonth()]} ${p.getUTCDate()}`;
  return opts.year === false ? base : `${base}, ${p.getUTCFullYear()}`;
}

export function fmtMonth(d: ISODate, opts: { short?: boolean } = {}): string {
  const p = parseISO(d.length === 7 ? d + '-01' : d);
  return opts.short ? `${MONTHS[p.getUTCMonth()]} '${String(p.getUTCFullYear()).slice(2)}` : `${MONTHS[p.getUTCMonth()]} ${p.getUTCFullYear()}`;
}

/** Describe a signed day difference in plain language: "about 2 months", "11 days". */
export function describeDays(days: number): string {
  const a = Math.abs(days);
  if (a === 0) return 'no change';
  if (a < 45) return `${a} day${a === 1 ? '' : 's'}`;
  const months = a / AVG_DAYS_PER_MONTH;
  const rounded = Math.round(months * 2) / 2;
  return `about ${rounded} month${rounded === 1 ? '' : 's'}`;
}

export function monthsBetween(from: ISODate, to: ISODate): number {
  return diffDays(to, from) / AVG_DAYS_PER_MONTH;
}
