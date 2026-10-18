import { useState } from 'react';
import { ArrowRight, CalendarDays, Flame, Lightbulb, ShoppingBag, SlidersHorizontal, Sparkles, Trophy } from 'lucide-react';
import { useStore } from '../state/store';
import { useData, useDerived } from '../state/hooks';
import { Card, Modal, Progress } from '../components/ui';
import { GoalRow, SafeToSpendBreakdown } from '../components/finance';
import { Recommendations } from '../components/Recommendations';
import { leaderboard } from '../garden/friends';
import { streakBonus, POINTS } from '../garden/rules';
import { fmtDate } from '../lib/dates';
import { money } from '../lib/money';

export function HomePage() {
  const d = useData();
  const x = useDerived();
  const setTab = useStore((s) => s.setTab);
  const openGoal = useStore((s) => s.openGoal);
  const [breakdown, setBreakdown] = useState(false);
  const s = x.safe;
  const g = d.garden;
  const week = x.currentWeek;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const topGoals = x.sortedGoalIds.slice(0, 3).map((id) => d.goals.find((gg) => gg.id === id)!);
  const board = leaderboard(g, d.profile.displayName, 'earned');
  const me = board.find((r) => r.isYou)!;
  const status = s.shortfall
    ? 'Your planned spending is more than you have this month. Tap the breakdown to see why.'
    : x.summary.overAllocated
      ? 'Your goals ask for more than your budget can cover. Worth a look on the Goals tab.'
      : 'You’re on plan this month.';

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="eyebrow">{fmtDate(x.today)}</div>
          <h1>{greeting}{d.profile.displayName ? `, ${d.profile.displayName}` : ''}</h1>
          <p>{status}</p>
        </div>
        <div className="row wrap">
          <button className="btn btn-secondary" onClick={() => setTab('money')}><SlidersHorizontal size={16} /> Edit my money</button>
          <button className="btn btn-primary btn-lg" onClick={() => setTab('simulate')}><ShoppingBag size={18} /> Can I afford it?</button>
        </div>
      </div>

      <div className="grid g-main">
        {/* Safe to spend */}
        <Card className="hero">
          <div className="row-between wrap" style={{ alignItems: 'flex-start' }}>
            <div>
              <div className="metric-label">Safe to spend through {fmtDate(s.periodEnd, { year: false })}</div>
              <div className={`metric-xl mt-8 ${s.shortfall ? 'neg' : ''}`}>{money(s.safeToSpend)}</div>
              {s.shortfall && <span className="badge badge-negative mt-8">Over budget</span>}
            </div>
            {s.nextPayDate && <span className="badge badge-primary"><CalendarDays size={13} /> Payday {fmtDate(s.nextPayDate, { year: false })}</span>}
          </div>
          <p className="small muted mt-8">What you can spend on fun stuff and still pay your bills and hit your savings. This isn’t your bank balance.</p>
          <div className="mt-16">
            <Progress value={s.discretionaryBudget > 0 ? s.discretionarySpent / (s.discretionaryBudget + s.unallocatedAvailable) : 0} tone={s.budgetRemaining < 0 ? 'warn' : 'sage'} label="Fun-money budget used" />
            <div className="row-between small muted mt-8"><span>{money(s.discretionarySpent)} spent of {money(s.discretionaryBudget + s.unallocatedAvailable)}</span><button className="link-btn small" onClick={() => setBreakdown(true)}>See the breakdown <ArrowRight size={14} /></button></div>
          </div>
        </Card>

        {/* Streak */}
        <Card title="Your streak" action={<button className="link-btn" onClick={() => setTab('garden')}>Garden <ArrowRight size={15} /></button>}>
          <div className="row" style={{ gap: 14 }}>
            <div className={`streak-flame ${g.currentStreak > 0 ? 'lit' : ''}`}><Flame size={30} /><span>{g.currentStreak}</span></div>
            <div>
              <div className="strong">{g.currentStreak > 0 ? `${g.currentStreak}-week streak` : 'Start a streak this week'}</div>
              <div className="small muted">{g.pointsBalance} points to spend · <Trophy size={12} style={{ verticalAlign: -1 }} /> #{me.rank} of {board.length} friends</div>
            </div>
          </div>
          <div className="mt-16">
            <div className="row-between small"><span className="strong">This week</span><span className="muted num">{money(week.discretionarySpent)} / {money(week.allowance)}</span></div>
            <div className="mt-8"><Progress value={week.allowance ? week.discretionarySpent / week.allowance : 0} tone={week.withinAllowance ? 'sage' : 'warn'} label="This week's spending" /></div>
            <p className="small muted mt-8">
              {week.withinAllowance
                ? `Stay under ${money(week.allowance)} and pay your bills to keep the streak alive (+${POINTS.weeklyBase + streakBonus(g.currentStreak + 1)} points).`
                : 'Over this week, and that’s okay. A new week starts Monday.'}
            </p>
          </div>
        </Card>
      </div>

      <div className="grid g-main mt-16">
        <Card title="Suggestions for you" subtitle="Calculated from your own numbers" action={<Lightbulb size={18} color="var(--warning)" />}>
          <Recommendations />
        </Card>

        <Card title="Your goals" action={<button className="link-btn" onClick={() => setTab('goals')}>All goals <ArrowRight size={15} /></button>}>
          {topGoals.length === 0 ? (
            <div className="empty"><div className="icon-chip green"><Sparkles size={18} /></div>No goals yet.<div className="mt-12"><button className="btn btn-primary btn-sm" onClick={() => setTab('goals')}>Add a goal</button></div></div>
          ) : (
            <div className="list">{topGoals.map((gl) => <GoalRow key={gl.id} goal={gl} a={x.goalAnalyses[gl.id]} onClick={() => { openGoal(gl.id); setTab('goals'); }} />)}</div>
          )}
        </Card>
      </div>

      <Modal open={breakdown} onClose={() => setBreakdown(false)} wide title="How safe-to-spend is calculated" subtitle={`${fmtDate(s.periodStart, { year: false })} – ${fmtDate(s.periodEnd)}`}>
        <SafeToSpendBreakdown s={s} />
      </Modal>
    </div>
  );
}
