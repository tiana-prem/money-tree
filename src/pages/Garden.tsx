import { useMemo, useState } from 'react';
import { Award, Check, Flame, Hand, Lock, Move, Sparkles, Sprout, Trash2, X } from 'lucide-react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useStore } from '../state/store';
import { useData, useDerived } from '../state/hooks';
import { Card, ChartTooltip, KV, MathToggle, Progress } from '../components/ui';
import { GARDEN_CATEGORY_LABEL, GARDEN_ITEMS, GARDEN_SLOTS } from '../garden/items';
import { ItemSvg, SceneBackground } from '../garden/art';
import { POINTS, evaluateWeeksSince, growthStage, itemState, streakBonus, unlockLabel } from '../garden/rules';
import { emergencyPercent } from '../state/derive';
import type { GardenItem } from '../engine/types';
import { fmtDate } from '../lib/dates';
import { money } from '../lib/money';

type ShopCat = GardenItem['category'];

export function GardenPage() {
  const d = useData();
  const x = useDerived();
  const st = useStore();
  const g = d.garden;
  const ef = emergencyPercent(d);
  const [armed, setArmed] = useState<string | null>(null);
  const [picked, setPicked] = useState<number | null>(null);
  const [cat, setCat] = useState<ShopCat>('plants');
  const [dragOver, setDragOver] = useState<number | null>(null);
  const [justPlaced, setJustPlaced] = useState<number | null>(null);
  const editing = armed !== null || picked !== null;

  const bySlot = new Map(g.placedItems.map((p) => [p.slot, p]));
  const placeable = (id: string) => { const it = GARDEN_ITEMS.find((i) => i.id === id); return it && it.category !== 'themes' && it.category !== 'paths'; };

  const onSlot = (slot: number) => {
    if (armed) { st.placeItem(slot, armed); setJustPlaced(slot); setArmed(null); st.toast('Placed in your garden. Saved automatically.'); return; }
    if (picked !== null) { if (picked !== slot) st.moveItem(picked, slot); setPicked(null); return; }
    if (bySlot.has(slot)) setPicked(slot);
  };

  const weeks = useMemo(() => evaluateWeeksSince(g.trackingStartDate, d.transactions, d.plan, x.today), [g.trackingStartDate, d.transactions, d.plan, x.today]);
  const week = x.currentWeek;
  const nextBonus = streakBonus(g.currentStreak + 1);
  const pointsSeries = useMemo(() => {
    let earned = 0;
    return [...g.rewardHistory].filter((r) => r.type === 'weekly_reward' || r.type === 'missed_week').sort((a, b) => a.date.localeCompare(b.date)).map((r) => { earned += Math.max(0, r.points); return { date: r.date, Earned: earned }; });
  }, [g.rewardHistory]);
  const owned = GARDEN_ITEMS.filter((i) => g.ownedItemIds.includes(i.id) && placeable(i.id));

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Your garden</h1>
          <p>Consistent weeks grow your garden. Earn points by staying within your weekly plan, then spend them on plants and decor.</p>
        </div>
        <div className="row">
          <span className="badge badge-primary" style={{ height: 32, fontSize: 14, padding: '0 14px' }}><Sparkles size={15} /> {g.pointsBalance} points</span>
          <span className="badge badge-warning" style={{ height: 32, fontSize: 14, padding: '0 14px' }}><Flame size={15} /> {g.currentStreak}-week streak</span>
        </div>
      </div>

      {d.transactions.length === 0 && (
        <div className="callout info" style={{ marginBottom: 16 }}>
          <Sprout size={17} />
          <div>Weekly rewards are scored from transaction data, which isn't available for manually entered plans in this version. Explore the demo profile to see weeks scored and points awarded. Your starter garden is still yours to arrange.</div>
        </div>
      )}
      <div className="grid g-main">
        <div className="stack">
          <div className="garden-scene" onClick={(e) => { if (e.target === e.currentTarget) { setArmed(null); setPicked(null); } }}>
            <SceneBackground theme={g.activeTheme} path={g.activePath} />
            <div className="garden-slots">
              {Array.from({ length: GARDEN_SLOTS }, (_, slot) => {
                const p = bySlot.get(slot);
                const item = p && GARDEN_ITEMS.find((i) => i.id === p.itemId);
                const stage = item?.grows ? growthStage(p!.placedAtQualifiedCount, g) : 2;
                return (
                  <button key={slot} className={`slot ${editing ? 'editing' : ''} ${picked === slot ? 'picked' : ''} ${dragOver === slot ? 'target' : ''}`}
                    aria-label={item ? `${item.name}${item.grows ? `, ${['sprouting', 'growing', 'in full bloom'][stage]}` : ''}, plot ${slot + 1}` : `Empty plot ${slot + 1}`}
                    onClick={() => onSlot(slot)}
                    draggable={!!p}
                    onDragStart={(e) => { e.dataTransfer.setData('text/plain', `slot:${slot}`); setPicked(slot); }}
                    onDragOver={(e) => { e.preventDefault(); setDragOver(slot); }}
                    onDragLeave={() => setDragOver(null)}
                    onDrop={(e) => {
                      e.preventDefault(); setDragOver(null);
                      const v = e.dataTransfer.getData('text/plain');
                      if (v.startsWith('slot:')) st.moveItem(Number(v.slice(5)), slot);
                      else if (v.startsWith('item:')) { st.placeItem(slot, v.slice(5)); setJustPlaced(slot); }
                      setPicked(null); setArmed(null);
                    }}>
                    {editing && !item && <span className="slot-num">{slot + 1}</span>}
                    {item && <ItemSvg id={item.id} stage={stage} className={`${justPlaced === slot ? 'grow-in' : ''} ${item.grows && stage === 2 ? 'sway' : ''}`} />}
                  </button>
                );
              })}
            </div>
          </div>

          {(armed || picked !== null) && (
            <div className="callout info row-between" role="status">
              <div className="row" style={{ gap: 8 }}><Hand size={16} />
                {armed ? <>Choose a plot for <strong>{GARDEN_ITEMS.find((i) => i.id === armed)?.name}</strong>. Placing it on an occupied plot replaces that item (you keep it in inventory).</>
                  : <>Choose another plot to move <strong>{GARDEN_ITEMS.find((i) => i.id === bySlot.get(picked!)?.itemId)?.name}</strong>, or remove it.</>}
              </div>
              <div className="row">
                {picked !== null && <button className="btn btn-sm btn-danger" onClick={() => { st.clearSlot(picked); setPicked(null); }}><Trash2 size={14} /> Remove</button>}
                <button className="btn btn-sm btn-secondary" onClick={() => { setArmed(null); setPicked(null); }}><X size={14} /> Cancel</button>
              </div>
            </div>
          )}

          <Card title="Inventory" subtitle="Select an item, then a plot. You can also drag items onto the garden, or select a placed item to move or remove it.">
            {owned.length === 0 ? <div className="small muted">Nothing to place yet. Buy something in the shop.</div> : (
              <div className="shop-grid">
                {owned.map((it) => {
                  const placedHere = g.placedItems.find((p) => p.itemId === it.id);
                  return (
                    <button key={it.id} className={`shop-item ${armed === it.id ? 'armed' : ''} ${placedHere ? 'placed' : ''}`} style={{ cursor: 'pointer' }} draggable
                      onDragStart={(e) => e.dataTransfer.setData('text/plain', `item:${it.id}`)}
                      onClick={() => { setPicked(null); setArmed(armed === it.id ? null : it.id); }} aria-pressed={armed === it.id}>
                      <div className="thumb"><ItemSvg id={it.id} stage={placedHere && it.grows ? growthStage(placedHere.placedAtQualifiedCount, g) : 2} /></div>
                      <div className="strong small">{it.name}</div>
                      <div className="tiny muted">{placedHere ? `Placed on plot ${placedHere.slot + 1}` : 'In inventory'}{it.grows && placedHere ? ` · ${['sprout', 'growing', 'full bloom'][growthStage(placedHere.placedAtQualifiedCount, g)]}` : ''}</div>
                    </button>
                  );
                })}
              </div>
            )}
          </Card>
        </div>

        <div className="stack">
          <Card title="This week" subtitle={`${fmtDate(week.start, { year: false })} – ${fmtDate(week.end, { year: false })}`}>
            <div className="row-between small"><span>Discretionary spending</span><span className="num strong">{money(week.discretionarySpent)} / {money(week.allowance)}</span></div>
            <div className="mt-8"><Progress value={week.allowance ? week.discretionarySpent / week.allowance : 0} tone={week.withinAllowance ? 'sage' : 'warn'} label="This week's discretionary spending" /></div>
            <div className="mt-12 small">
              <div className="row" style={{ gap: 6 }}>{week.withinAllowance ? <Check size={15} color="var(--success)" /> : <X size={15} color="var(--warning)" />} Stay within {money(week.allowance)} of discretionary spending</div>
              <div className="row mt-8" style={{ gap: 6 }}>{week.essentialsOk ? <Check size={15} color="var(--success)" /> : <X size={15} color="var(--warning)" />} Pay essential bills due this week{week.essentialsDue.length ? ` (${week.essentialsDue.map((e) => e.label).join(', ')})` : ' (none due)'}</div>
            </div>
            <div className="callout good mt-12"><div>{week.withinAllowance ? <>On track to earn <strong>{POINTS.weeklyBase + nextBonus} points</strong> when the week closes ({POINTS.weeklyBase} + {nextBonus} streak bonus).</> : <>This week ran over — that's okay. Next week is a fresh start, and every week you qualify adds to your garden.</>}</div></div>
            <MathToggle label="How points work">
              <div className="formula">{`Weekly allowance = monthly discretionary budget × 12 ÷ 52
  = ${money(x.summary.discretionary)} × 12 ÷ 52 = ${money(week.allowance)}
A week qualifies when discretionary ≤ allowance AND every
essential bill due that week is paid. Cutting essentials never earns points.
Points = ${POINTS.weeklyBase} + min(${POINTS.streakBonusPerWeek} × (streak − 1), ${POINTS.streakBonusCap})
Each week is scored once (by week id), so reloads can't add points.`}</div>
            </MathToggle>
          </Card>

          <Card title="Streaks">
            <div className="grid g-3" style={{ gap: 8 }}>
              <div><div className="metric-label">Current</div><div className="metric">{g.currentStreak}</div></div>
              <div><div className="metric-label">Longest</div><div className="metric">{g.longestStreak}</div></div>
              <div><div className="metric-label">Successful</div><div className="metric">{g.successfulWeeks}</div></div>
            </div>
            <div className="week-dots mt-16" aria-label="Recent weeks">
              {weeks.slice(-12).map((w) => <span key={w.weekId} className={`week-dot ${w.status === 'qualified' ? 'q' : w.status === 'in_progress' ? 'p' : 'm'}`} title={`${fmtDate(w.start, { year: false })}: ${w.status.replace('_', ' ')}`}>{w.status === 'qualified' ? <Check size={13} /> : w.status === 'in_progress' ? '•' : ''}</span>)}
            </div>
            <div className="tiny muted mt-8">Last {Math.min(12, weeks.length)} weeks · filled = qualified · outlined = in progress</div>
            {pointsSeries.length > 1 && (
              <div className="chart-wrap sm mt-12" style={{ height: 150 }}>
                <ResponsiveContainer>
                  <LineChart data={pointsSeries} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke="var(--c-grid)" />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#868c86' }} tickLine={false} axisLine={false} tickFormatter={(v) => fmtDate(v, { year: false })} minTickGap={20} />
                    <YAxis tick={{ fontSize: 11, fill: '#868c86' }} tickLine={false} axisLine={false} width={40} />
                    <Tooltip content={<ChartTooltip labelFormatter={(v: string) => fmtDate(v)} />} />
                    <Line dataKey="Earned" name="Points earned (total)" stroke="var(--primary)" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>
        </div>
      </div>

      <Card className="mt-16" title="Shop" subtitle={`${g.pointsBalance} points available · emergency fund ${Math.round(ef * 100)}% funded`}>
        <div className="chips" role="group" aria-label="Shop category">
          {(Object.keys(GARDEN_CATEGORY_LABEL) as ShopCat[]).map((c) => <button key={c} className="chip" aria-pressed={cat === c} onClick={() => setCat(c)}>{GARDEN_CATEGORY_LABEL[c]}</button>)}
        </div>
        <div className="shop-grid mt-16">
          {GARDEN_ITEMS.filter((i) => i.category === cat).map((it) => {
            const s = itemState(it, g, ef);
            const afford = g.pointsBalance >= it.pointCost;
            return (
              <div key={it.id} className={`shop-item ${s === 'locked' ? 'locked' : ''} ${s === 'placed' ? 'placed' : ''}`}>
                <div className="thumb"><ItemSvg id={it.id} /></div>
                <div className="row-between"><span className="strong small">{it.name}</span>{s === 'locked' && <Lock size={13} color="var(--text-3)" />}</div>
                <div className="tiny muted">{it.description}</div>
                <div className="row-between">
                  <span className="small strong num">{it.pointCost === 0 ? 'Free' : `${it.pointCost} pts`}</span>
                  <span className={`badge ${s === 'placed' ? 'badge-primary' : s === 'owned' ? 'badge-success' : s === 'locked' ? '' : 'badge-outline'}`} style={{ height: 20, fontSize: 11 }}>{s === 'placed' ? (it.category === 'themes' || it.category === 'paths' ? 'In use' : 'Placed') : s === 'owned' ? 'Owned' : s === 'locked' ? 'Locked' : 'Available'}</span>
                </div>
                {s === 'locked' && <div className="tiny" style={{ color: 'var(--warning)' }}>{unlockLabel(it)}</div>}
                {s === 'available' && (
                  <button className="btn btn-primary btn-sm" disabled={!afford} onClick={() => { const r = st.buyGardenItem(it.id); if (!r.ok) st.toast(r.error ?? 'Could not buy item.', 'error'); else if (placeable(it.id)) setArmed(it.id); }}>
                    {afford ? `Buy for ${it.pointCost}` : `Need ${it.pointCost - g.pointsBalance} more`}
                  </button>
                )}
                {s === 'owned' && (it.category === 'themes' ? <button className="btn btn-soft btn-sm" onClick={() => st.setTheme(it.id)}>Use theme</button>
                  : it.category === 'paths' ? <button className="btn btn-soft btn-sm" onClick={() => st.setPath(it.id)}>Use path</button>
                    : <button className="btn btn-soft btn-sm" onClick={() => { setPicked(null); setArmed(it.id); window.scrollTo({ top: 0, behavior: 'smooth' }); }}><Move size={13} /> Place</button>)}
                {s === 'placed' && it.grows && (() => { const p = g.placedItems.find((pp) => pp.itemId === it.id)!; const stg = growthStage(p.placedAtQualifiedCount, g); return <div className="tiny muted row" style={{ gap: 4 }}><Sprout size={12} /> {stg === 2 ? 'Full bloom' : `Grows with ${2 - stg} more successful week${2 - stg === 1 ? '' : 's'}`}</div>; })()}
              </div>
            );
          })}
        </div>
      </Card>

      <Card className="mt-16" title="Points history" subtitle="Every point earned and spent">
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Date</th><th>Event</th><th className="r">Base</th><th className="r">Streak bonus</th><th className="r">Points</th></tr></thead>
            <tbody>
              {[...g.rewardHistory].reverse().map((r) => (
                <tr key={r.id}>
                  <td>{fmtDate(r.date, { year: false })}</td>
                  <td>{r.type === 'weekly_reward' ? <span className="row" style={{ gap: 6 }}><Award size={14} color="var(--primary)" /> Qualified week ({r.weekId}) · streak {r.streakAfter}</span> : r.type === 'missed_week' ? <span className="muted">Week {r.weekId} didn't qualify — {r.note.toLowerCase()}</span> : r.note}</td>
                  <td className="r">{r.basePoints ?? '—'}</td>
                  <td className="r">{r.streakBonus !== undefined ? r.streakBonus : '—'}</td>
                  <td className={`r strong ${r.points > 0 ? 'pos' : r.points < 0 ? 'neg' : ''}`}>{r.points > 0 ? `+${r.points}` : r.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <KV k="Balance" v={`${g.pointsBalance} points`} total />
      </Card>
    </div>
  );
}
