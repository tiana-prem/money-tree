import type { Cents, EmployerMatchPolicy, Paystub } from './types';
import { PAYCHECKS_PER_YEAR } from './income';

/**
 * Employer match as a percent of pay for a given employee contribution percent.
 * Tiers are applied in order, e.g. [{100%, 3}, {50%, 2}] = "100% of the first 3%, 50% of the next 2%".
 */
export function matchPercent(policy: EmployerMatchPolicy, employeePercent: number): number {
  let left = employeePercent;
  let match = 0;
  for (const t of policy.tiers) {
    const inTier = Math.max(0, Math.min(left, t.tierPercent));
    match += inTier * t.matchRate;
    left -= inTier;
  }
  return match;
}

/** Employee contribution percent needed to receive the maximum match. */
export function fullMatchPercent(policy: EmployerMatchPolicy): number {
  return policy.tiers.reduce((a, t) => a + t.tierPercent, 0);
}

export function maxMatchPercent(policy: EmployerMatchPolicy): number {
  return policy.tiers.reduce((a, t) => a + t.tierPercent * t.matchRate, 0);
}

export interface MatchAnalysis {
  policy: EmployerMatchPolicy;
  annualGross: Cents;
  employeePercent: number;
  fullMatchAt: number;
  matchPercentNow: number;
  maxMatch: number;
  annualMatchNow: Cents;
  annualMatchMax: Cents;
  missedAnnual: Cents;
  /** Additional employee pre-tax contribution per paycheck needed to capture the full match. */
  extraPerPaycheck: Cents;
  extraPerMonth: Cents;
  capturingFull: boolean;
}

export function analyzeMatch(stub: Paystub): MatchAnalysis | null {
  const policy = stub.employerMatchPolicy;
  if (!policy || policy.tiers.length === 0) return null;
  const n = PAYCHECKS_PER_YEAR[stub.payFrequency];
  const annualGross = stub.grossPay * n;
  const now = matchPercent(policy, stub.employeeRetirementPercent);
  const max = maxMatchPercent(policy);
  const fullAt = fullMatchPercent(policy);
  const annualMatchNow = Math.round((annualGross * now) / 100);
  const annualMatchMax = Math.round((annualGross * max) / 100);
  const extraPct = Math.max(0, fullAt - stub.employeeRetirementPercent);
  const extraPerPaycheck = Math.round((stub.grossPay * extraPct) / 100);
  return {
    policy, annualGross, employeePercent: stub.employeeRetirementPercent, fullMatchAt: fullAt,
    matchPercentNow: now, maxMatch: max, annualMatchNow, annualMatchMax,
    missedAnnual: annualMatchMax - annualMatchNow,
    extraPerPaycheck, extraPerMonth: Math.round((extraPerPaycheck * n) / 12),
    capturingFull: now >= max - 1e-9,
  };
}
