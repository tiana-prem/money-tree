import { useState } from 'react';
import { ArrowRight, CalendarDays, Flame, Leaf, Lightbulb, Trophy, Wallet } from 'lucide-react';
import { useStore } from '../state/store';
import { useData, useDerived } from '../state/hooks';
import { Card, Modal, Progress } from '../components/ui';
import { GoalRow, SafeToSpendBreakdown } from '../components/finance';
import { Recommendations } from '../components/Recommendations';
import { ProductImage } from '../components/ProductImage';
import { PRODUCTS } from '../data/products';
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
  const isDemo = d.profile.dataSource !== 'manual';

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const topGoals = x.sortedGoalIds.slice(0, 3).map((id) => d.goals.find((gg) => gg.id === id)!);
  const board = leaderboard(g, d.profile.displayName, 'earned');
  const me = board.find((r) => r.isYou)!;
  const teaser = PRODUCTS.find((p) => p.id === 'p-headphones') ?? PRODUCTS[0];
  const status = s.shortfall
    ? 'Planned spending is more than you have this month. See the breakdown for why.'
    : x.summary.overAllocated
      ? 'Your goals ask for more than your budget can cover.'
      : 'Your essentials and planned savings are covered.';

  return (
    <div className="page">
      <div className="row-between">
        <div className="eyebrow">{greeting}{d.profile.displayName ? `, ${d.profile.displayName}` : ''}</div>
        {isDemo && <span className="demo-tag">Demo</span>}
      </div>
      <h1 className="hero-title mt-12" style={{ marginBottom: 24 }}>Small habits.<br /><span className="accent">Bigger possibilities.</span></h1>

      <div className="grid g-main">
        {/* Left to spend */}
        <section className="card hero">
          <div className="hero-body">
            <div className="row-between" style={{ alignItems: 'flex-start' }}>
              <div className="metric-label">Left to spend this month</div>
              <Wallet size={24} color="var(--primary)" />
            </div>
            <div className={`metric-xl mt-12 ${s.shortfall ? 'neg' : ''}`}>{money(s.safeToSpend)}</div>
            <p className="muted mt-12" style={{ fontSize: 16 }}>{status}</p>
          </div>
          <HeroArt />
          <div className="hero-stats">
            <div><div className="metric-label">Income</div><div className="metric-sm">{money(x.summary.monthlyNet)}</div></div>
            <div><div className="metric-label">Essentials</div><div className="metric-sm">{money(x.summary.essentials + x.summary.debtPayments)}</div></div>
            <div><div className="metric-label">To goals</div><div className="metric-sm">{money(x.summary.plannedSavings)}</div></div>
          </div>
          <div style={{ padding: '18px 26px 22px' }}>
            <Progress value={s.discretionaryBudget > 0 ? s.discretionarySpent / (s.discretionaryBudget + s.unallocatedAvailable) : 0} tone={s.budgetRemaining < 0 ? 'warn' : undefined} label="Fun-money budget used" />
            <div className="row-between small muted mt-12">
              <span>{money(s.discretionarySpent)} of {money(s.discretionaryBudget + s.unallocatedAvailable)} fun money used</span>
              <button className="link-btn small" onClick={() => setBreakdown(true)}>Breakdown <ArrowRight size={14} /></button>
            </div>
            {s.nextPayDate && <div className="row small muted mt-8" style={{ gap: 6 }}><CalendarDays size={14} /> Next payday {fmtDate(s.nextPayDate, { year: false })}</div>}
          </div>
        </section>

        <div className="stack">
          {/* Streak */}
          <Card title="Your streak" action={<button className="link-btn" onClick={() => setTab('garden')}>Garden <ArrowRight size={15} /></button>}>
            <div className="row" style={{ gap: 14 }}>
              <div className={`streak-flame ${g.currentStreak > 0 ? 'lit' : ''}`}><Flame size={30} /><span>{g.currentStreak}</span></div>
              <div>
                <div className="strong" style={{ fontSize: 17 }}>{g.currentStreak > 0 ? `${g.currentStreak}-week streak` : 'Start a streak this week'}</div>
                <div className="small muted">{g.pointsBalance} points · <Trophy size={12} style={{ verticalAlign: -1 }} /> #{me.rank} of {board.length} friends</div>
              </div>
            </div>
            <div className="mt-16">
              <div className="row-between small"><span className="strong">This week</span><span className="muted num">{money(week.discretionarySpent)} / {money(week.allowance)}</span></div>
              <div className="mt-8"><Progress value={week.allowance ? week.discretionarySpent / week.allowance : 0} tone={week.withinAllowance ? undefined : 'warn'} label="This week's spending" /></div>
              <p className="small muted mt-8">
                {week.withinAllowance
                  ? `Stay under ${money(week.allowance)} and pay your bills to keep it alive (+${POINTS.weeklyBase + streakBonus(g.currentStreak + 1)} points).`
                  : 'Over this week, and that’s okay. A new week starts Monday.'}
              </p>
            </div>
          </Card>

          {/* Test a purchase */}
          <button type="button" className="card cream" onClick={() => setTab('simulate')} style={{ textAlign: 'left', cursor: 'pointer', display: 'grid', gridTemplateColumns: '1fr 120px', gap: 16, alignItems: 'center', padding: 22 }}>
            <div>
              <h2 style={{ fontSize: 24, lineHeight: 1.1 }}>Want it? Test it first.</h2>
              <p className="muted mt-8">See what a purchase does to your goals before you buy.</p>
              <span className="btn btn-pill mt-12">Can I afford it? <ArrowRight size={15} /></span>
            </div>
            <div style={{ borderRadius: 18, overflow: 'hidden' }}><ProductImage src={teaser.imageUrl} alt={teaser.name} category={teaser.category} cutout={teaser.cutout} /></div>
          </button>
        </div>
      </div>

      <div className="section-head">
        <h2>What you’re growing</h2>
        <button className="link-btn" onClick={() => setTab('goals')}>All goals</button>
      </div>
      {topGoals.length === 0 ? (
        <Card><div className="empty">No goals yet.<div className="mt-12"><button className="btn btn-primary btn-sm" onClick={() => setTab('goals')}>Add a goal</button></div></div></Card>
      ) : (
        <div className="grid g-3" style={{ gap: 14 }}>
          {topGoals.map((gl) => <GoalRow key={gl.id} goal={gl} a={x.goalAnalyses[gl.id]} onClick={() => { openGoal(gl.id); setTab('goals'); }} />)}
        </div>
      )}

      <div className="section-head">
        <h2>A little advice</h2>
        <Lightbulb size={20} color="var(--sun)" />
      </div>
      <Card><Recommendations /></Card>

      <div className="page-foot"><Leaf size={16} /> Grow at your own pace.</div>

      <Modal open={breakdown} onClose={() => setBreakdown(false)} wide title="How safe-to-spend is calculated" subtitle={`${fmtDate(s.periodStart, { year: false })} – ${fmtDate(s.periodEnd)}`}>
        <SafeToSpendBreakdown s={s} />
      </Modal>
    </div>
  );
}

/** Decorative: money ribbons flowing into a growing tree. */
function HeroArt() {
  const ribbon = 'M-20 205 C 90 190, 170 235, 280 205 S 430 105, 640 95';
  const colors = ['#a3d9b1', '#e9c46a', '#e8836b', '#b49cf0', '#6f8fe0'];
  return (
    <svg className="hero-art" viewBox="0 0 600 320" role="img" aria-label="Illustration: money flowing into a growing tree">
      <defs>
        <linearGradient id="heroSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#202a4a" /><stop offset="1" stopColor="#1b2b33" /></linearGradient>
      </defs>
      <rect width="600" height="320" fill="url(#heroSky)" />
      <g stroke="#2e3b5c" strokeWidth="1">
        {[100, 200, 300, 400, 500].map((xx) => <line key={xx} x1={xx} y1="0" x2={xx} y2="320" />)}
        {[60, 130, 200, 270].map((yy) => <line key={yy} x1="0" y1={yy} x2="600" y2={yy} />)}
      </g>
      <circle cx="30" cy="70" r="26" fill="#f2c94c" /><text x="30" y="80" textAnchor="middle" fontSize="28" fontWeight="800" fill="#8a6d1d" fontFamily="Georgia, serif">$</text>
      <path d="M140 55 l5 14 14 5 -14 5 -5 14 -5 -14 -14 -5 14 -5Z" fill="#e8f6d6" />
      <circle cx="395" cy="32" r="4" fill="#b49cf0" />
      {colors.map((c, i) => (
        <path key={c} d={ribbon} transform={`translate(0 ${i * 19})`} stroke={c} strokeWidth="21" fill="none" strokeLinecap="butt" />
      ))}
      <ellipse cx="520" cy="285" rx="80" ry="12" fill="#152027" opacity="0.8" />
      <rect x="512" y="150" width="14" height="135" rx="4" fill="#8a6440" />
      <circle cx="488" cy="150" r="42" fill="#3f9b6e" />
      <circle cx="560" cy="150" r="44" fill="#4fae7b" />
      <circle cx="525" cy="108" r="48" fill="#9fd68c" />
      {[[497, 168], [535, 158], [565, 130], [520, 118]].map(([cx, cy], i) => (
        <g key={i}><circle cx={cx} cy={cy} r="14" fill="#f2c94c" stroke="#d9ab2c" strokeWidth="2" /><path d={`M${cx} ${cy - 7} v14 M${cx - 4} ${cy - 4} h8`} stroke="#9b7b1f" strokeWidth="2" strokeLinecap="round" /></g>
      ))}
    </svg>
  );
}
