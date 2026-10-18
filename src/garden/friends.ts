import type { GardenState } from '../engine/types';

/**
 * Demo friends for the leaderboard. Simulated — real friend leaderboards need accounts and a
 * server, which this version doesn't have. Friends compare points and streaks only, never money.
 */
export interface Friend {
  id: string;
  name: string;
  /** Total points earned (spending points in the shop never lowers your rank). */
  earned: number;
  streak: number;
  /** Points earned in the most recent completed week. */
  lastWeek: number;
  color: string;
}

export const DEMO_FRIENDS: Friend[] = [
  { id: 'f-priya', name: 'Priya', earned: 1325, streak: 6, lastWeek: 200, color: '#e87ba4' },
  { id: 'f-jordan', name: 'Jordan', earned: 1100, streak: 3, lastWeek: 150, color: '#2a78d6' },
  { id: 'f-alex', name: 'Alex', earned: 875, streak: 0, lastWeek: 0, color: '#eb6834' },
  { id: 'f-sam', name: 'Sam', earned: 650, streak: 1, lastWeek: 100, color: '#1baf7a' },
];

export type LeaderboardSort = 'earned' | 'streak';

export interface LeaderRow extends Friend {
  isYou: boolean;
  rank: number;
}

/** Points you've earned from qualifying weeks (purchases in the shop don't count against you). */
export function pointsEarned(g: GardenState): number {
  return g.rewardHistory.filter((r) => r.type === 'weekly_reward').reduce((a, r) => a + r.points, 0);
}

export function lastWeekPoints(g: GardenState): number {
  const weekly = g.rewardHistory.filter((r) => r.type === 'weekly_reward' || r.type === 'missed_week').sort((a, b) => a.date.localeCompare(b.date));
  return weekly.length ? Math.max(0, weekly[weekly.length - 1].points) : 0;
}

export function leaderboard(g: GardenState, name: string, sort: LeaderboardSort): LeaderRow[] {
  const you: Friend = { id: 'you', name: name || 'You', earned: pointsEarned(g), streak: g.currentStreak, lastWeek: lastWeekPoints(g), color: '#1f5c3f' };
  const rows = [you, ...DEMO_FRIENDS].sort((a, b) => b[sort] - a[sort] || b.earned - a.earned || (a.id === 'you' ? -1 : 1));
  return rows.map((r, i) => ({ ...r, isYou: r.id === 'you', rank: i + 1 }));
}
