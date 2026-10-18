import { useState } from 'react';
import { Flame, Trophy } from 'lucide-react';
import { useData } from '../state/hooks';
import { Card, Segmented } from './ui';
import { LeaderboardSort, leaderboard } from '../garden/friends';

/** Friends ranked by points earned or current streak. Compares points only, never money. */
export function Leaderboard() {
  const d = useData();
  const [sort, setSort] = useState<LeaderboardSort>('earned');
  const rows = leaderboard(d.garden, d.profile.displayName, sort);
  const me = rows.find((r) => r.isYou)!;
  const ahead = rows[me.rank - 2];
  const gap = ahead ? ahead[sort] - me[sort] : 0;

  return (
    <Card title="Friends" subtitle="Points and streaks only. Nobody sees your money."
      action={<Segmented label="Rank by" value={sort} onChange={setSort} options={[{ value: 'earned', label: 'Points' }, { value: 'streak', label: 'Streak' }]} />}>
      <ol className="leaderboard">
        {rows.map((r) => (
          <li key={r.id} className={r.isYou ? 'you' : ''}>
            <span className={`lb-rank ${r.rank <= 3 ? `top${r.rank}` : ''}`}>{r.rank === 1 ? <Trophy size={14} /> : r.rank}</span>
            <span className="lb-avatar" style={{ background: r.color }} aria-hidden>{r.name.charAt(0).toUpperCase()}</span>
            <span className="lb-name">{r.isYou ? `${r.name === 'You' ? 'You' : `${r.name} (you)`}` : r.name}</span>
            <span className={`lb-streak ${r.streak > 0 ? 'lit' : ''}`} title={`${r.streak}-week streak`}><Flame size={14} />{r.streak}</span>
            <span className="lb-points num">{r.earned.toLocaleString()}</span>
          </li>
        ))}
      </ol>
      <p className="small muted mt-12">
        {me.rank === 1
          ? `You're in first. Keep the streak going to stay there.`
          : `${gap.toLocaleString()} ${sort === 'earned' ? 'points' : `week${gap === 1 ? '' : 's'}`} behind ${ahead.name}. One more good week could close the gap.`}
      </p>
      <p className="tiny faint mt-8">Demo friends are simulated. Adding real friends needs accounts, which this version doesn't have yet.</p>
    </Card>
  );
}
