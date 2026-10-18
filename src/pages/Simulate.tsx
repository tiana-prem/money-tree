import { useMemo, useState } from 'react';
import { AlertTriangle, ArrowRight, CalendarDays, Check, CheckCircle2, Clock, Info, Layers, Plus, Repeat, Search, ShoppingBag, Sparkles, TrendingDown, X } from 'lucide-react';
import { useStore } from '../state/store';
import { useData, useDerived } from '../state/hooks';
import { Callout, Card, ConfirmDialog, KV, MathToggle, Modal, MoneyInput, Segmented } from '../components/ui';
import { ProjectionChart } from '../components/charts';
import { ProductImage } from '../components/ProductImage';
import { PRODUCTS, PRODUCT_CATEGORIES } from '../data/products';
import type { ProductCategory, PurchaseScenario, RecurrenceInterval } from '../engine/types';
import { buildAlternatives, goalMath, type GoalImpact, type ScenarioComparison } from '../engine/scenario';
import { installmentPayment, totalPurchaseCost } from '../engine/projection';
import { explainPurchase } from '../explain/explain';
import { addDays, describeDays, diffDays, fmtDate, fmtMonth, isValidISO } from '../lib/dates';
import { money } from '../lib/money';

export function SimulatePage() {
  const d = useData();
  const x = useDerived();
  const st = useStore();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<ProductCategory | 'All'>('All');
  const [custom, setCustom] = useState(false);
  const [confirmApply, setConfirmApply] = useState(false);

  const items = d.scenario.items;
  const drafts = items.filter((i) => i.scenarioStatus === 'draft');
  const selected = items.find((i) => i.id === d.scenario.selectedId) ?? drafts[drafts.length - 1];
  const cmp = x.comparison;
  const horizon = d.profile.planningPreferences.horizonMonths;

  const filtered = PRODUCTS.filter((p) => (cat === 'All' || p.category === cat) && (q.trim() === '' || `${p.name} ${p.description} ${p.category}`.toLowerCase().includes(q.trim().toLowerCase())));
  const alternatives = useMemo(
    () => (cmp && selected && selected.scenarioStatus === 'draft' ? buildAlternatives(x.inputs, drafts, selected.id, PRODUCTS, horizon, x.baseline, cmp) : []),
    [x, cmp, selected?.id, drafts, horizon], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const explanation = cmp ? explainPurchase(cmp, items, d.goals) : null;
  const toApply = drafts.filter((i) => i.included);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Simulate a purchase</h1>
          <p>Test it before you buy it. Simulations never change your balances, transactions or plan unless you choose to apply them.</p>
        </div>
        <button className="btn btn-secondary" onClick={() => setCustom(true)}><Plus size={16} /> Custom purchase</button>
      </div>

      {drafts.length > 0 && selected && cmp && explanation ? (
        <div className="stack">
          {/* Headline */}
          <Card className="hero">
            <div className="row-between wrap" style={{ alignItems: 'flex-start' }}>
              <div style={{ maxWidth: 760 }}>
                <span className="badge badge-info"><Layers size={12} /> What-if scenario · not a real transaction</span>
                <h2 className="mt-12" style={{ fontSize: 22, lineHeight: 1.3 }}>{explanation.headline}</h2>
                <p className="muted mt-8">{explanation.whyItMatters}</p>
              </div>
              <div className="row wrap">
                <button className="btn btn-primary" disabled={toApply.length === 0} onClick={() => setConfirmApply(true)}><Check size={16} /> Apply to my plan</button>
              </div>
            </div>
            <MathToggle label="How this was calculated">
              <h4>What changed</h4><p>{explanation.whatChanged}</p>
              <h4>Which goals</h4><p>{explanation.affected}</p>
              <h4>Method</h4><p>{explanation.how}</p>
              <h4>Your options</h4><ul style={{ margin: 0, paddingLeft: 18 }}>{explanation.options.map((o) => <li key={o}>{o}</li>)}</ul>
              <p className="tiny faint mt-12">Generated from the projection engine's outputs by Clover's built-in explanation templates. Estimates, not guarantees or financial advice.</p>
            </MathToggle>
          </Card>

          <div className="grid g-main">
            {/* Scenario controls */}
            <Card title="Scenario" subtitle={`${drafts.length} item${drafts.length > 1 ? 's' : ''} · ${toApply.length} included`}>
              <div className="list">
                {items.map((i) => (
                  <div key={i.id} className="list-item" style={{ cursor: 'pointer', background: i.id === selected.id ? 'var(--sage-soft)' : undefined, borderRadius: 10, paddingLeft: 8, paddingRight: 8 }}
                    onClick={() => st.selectScenarioItem(i.id)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') st.selectScenarioItem(i.id); }} aria-pressed={i.id === selected.id}>
                    <div style={{ width: 52, borderRadius: 8, overflow: 'hidden', flexShrink: 0 }}><ProductImage src={PRODUCTS.find((p) => p.id === i.productId)?.imageUrl} alt={i.customName} category={i.category} /></div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="strong" style={{ opacity: i.included ? 1 : 0.5 }}>{i.customName}</div>
                      <div className="tiny muted">{money(i.price)}{i.recurrence ? ` / ${i.recurrence.interval.replace('ly', '')}` : ''} · {fmtDate(i.plannedDate, { year: false })}{i.payment.type === 'installments' ? ` · ${i.payment.months} payments` : ''}</div>
                    </div>
                    {i.scenarioStatus === 'applied' ? <span className="badge badge-primary">Applied</span> : (
                      <label className="switch" onClick={(e) => e.stopPropagation()} title="Include in scenario">
                        <input type="checkbox" checked={i.included} onChange={(e) => st.updateScenarioItem(i.id, { included: e.target.checked })} aria-label={`Include ${i.customName}`} /><span className="track" />
                      </label>
                    )}
                    <button className="btn btn-ghost btn-icon" onClick={(e) => { e.stopPropagation(); st.removeScenarioItem(i.id); }} aria-label={`Remove ${i.customName} from simulation`}><X size={16} /></button>
                  </div>
                ))}
              </div>
              {selected.scenarioStatus === 'draft' && <ItemControls item={selected} />}
              {selected.scenarioStatus === 'applied' && <Callout tone="good" icon={<CheckCircle2 size={17} />}>Applied to your plan as planned spending. Remove it from the Plan tab to undo.</Callout>}
            </Card>

            {/* Before / after */}
            <Card title="Before and after" subtitle={`Current plan vs. with this scenario, next ${horizon} months`}>
              <Compare cmp={cmp} />
            </Card>
          </div>

          <Card title="Goal completion dates" subtitle="Calculated from the baseline and scenario projections">
            {d.goals.length === 0 ? <div className="small muted">Add a goal to see how purchases move it.</div> : cmp.goalImpacts.map((g) => <ImpactRow key={g.goalId} g={g} cmp={cmp} />)}
          </Card>

          <div className="grid g-main">
            <Card title="Projection" subtitle="Solid = current plan · dashed = with scenario">
              <ProjectionChart baseline={x.baseline} scenario={cmp.scenario} months={horizon} buffer={d.plan.cashBuffer} height={280} />
            </Card>
            <Card title="Purchase timeline" subtitle="Drag the date to see milestones move">
              <Timeline cmp={cmp} item={selected} />
            </Card>
          </div>

          <Card title="Alternatives" subtitle="Each one is a separate projection. Trying one changes only the simulation.">
            {alternatives.length === 0 ? <div className="small muted">No alternatives for this item.</div> : (
              <div className="grid g-3">
                {alternatives.map((a) => {
                  const top = a.comparison.goalImpacts.filter((g) => g.kind === 'delayed' || g.kind === 'pushed_beyond');
                  return (
                    <div key={a.id} className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div className="strong">{a.title}</div>
                      <div className="small muted">{a.description}</div>
                      <div className="sep" style={{ margin: '4px 0' }} />
                      <div className="small">
                        {top.length === 0 ? <span className="pos strong">No goal delays projected</span> : top.slice(0, 2).map((g) => <div key={g.goalId}>{g.name}: <strong>{g.kind === 'pushed_beyond' ? 'beyond projection' : `${describeDays(g.delayDays!)} later`}</strong></div>)}
                      </div>
                      {a.vsCurrent && a.vsCurrent.days !== 0 && <span className={`badge ${a.vsCurrent.days < 0 ? 'badge-success' : 'badge-warning'}`}>{a.vsCurrent.goalName} {describeDays(a.vsCurrent.days)} {a.vsCurrent.days < 0 ? 'sooner' : 'later'} than current choice</span>}
                      <div className="tiny muted">Cost within {horizon} months: {money(a.costInHorizon)}{a.comparison.newShortfallPeriods.length ? ' · creates a cash shortfall' : ''}</div>
                      <div style={{ marginTop: 'auto' }}>
                        {a.id === 'reduce'
                          ? <div className="tiny faint">Budget changes are applied from Insights or Plan only after you approve them.</div>
                          : <button className="btn btn-soft btn-sm btn-block" onClick={() => { const changed = a.items.find((i) => i.id === selected.id)!; st.updateScenarioItem(selected.id, { price: changed.price, plannedDate: changed.plannedDate, payment: changed.payment, recurrence: changed.recurrence, customName: changed.customName, productId: changed.productId }); st.toast('Simulation updated with this alternative.', 'info'); }}>Try this in my simulation</button>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      ) : (
        <Callout tone="info" icon={<ShoppingBag size={17} />}>
          <strong>Pick something to test.</strong> Add a product below or enter a custom purchase. Clover will rerun your projection and show exactly which goals move and by how much.
          {items.some((i) => i.scenarioStatus === 'applied') && <div className="mt-8">Previously applied purchases are already part of your plan.</div>}
        </Callout>
      )}

      {/* Catalog */}
      <Card className="mt-16" title="Product catalog" subtitle="Curated demo products. Prices are illustrative estimates.">
        <div className="row wrap" style={{ gap: 12 }}>
          <div className="search" style={{ flex: '1 1 260px' }}>
            <Search size={16} />
            <label htmlFor="psearch" className="sr-only">Search products</label>
            <input id="psearch" className="input" placeholder="Search phones, laptops, cars, trips…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="chips" role="group" aria-label="Filter by category">
            {(['All', ...PRODUCT_CATEGORIES.filter((c) => c === 'Other' ? false : true)] as const).map((c) => <button key={c} className="chip" aria-pressed={cat === c} onClick={() => setCat(c)}>{c}</button>)}
          </div>
        </div>
        <div className="product-grid mt-16">
          {filtered.map((p) => {
            const inScenario = drafts.some((i) => i.productId === p.id);
            return (
              <div key={p.id} className={`product ${inScenario ? 'selected' : ''}`}>
                <ProductImage src={p.imageUrl} alt={p.name} category={p.category} />
                <div className="product-body">
                  <div className="row-between"><span className="badge">{p.category}</span>{p.recurring && <span className="badge badge-info"><Repeat size={11} /> Recurring</span>}</div>
                  <div className="strong">{p.name}</div>
                  <div className="price">{money(p.price)}{p.recurring ? <span className="small muted"> / {p.recurring.interval === 'monthly' ? 'mo' : p.recurring.interval}</span> : ''}</div>
                  <div className="tiny muted" style={{ flex: 1 }}>{p.description}</div>
                  <button className={`btn btn-sm ${inScenario ? 'btn-soft' : 'btn-primary'} mt-8`} onClick={() => inScenario ? st.selectScenarioItem(drafts.find((i) => i.productId === p.id)!.id) : st.addScenarioFromProduct(p)}>
                    {inScenario ? <><Check size={14} /> In simulation</> : <><Plus size={14} /> Add to simulation</>}
                  </button>
                  <div className="tiny faint" title={p.imageCredit}>Photo: {p.imageCredit.split(' — ')[0]}</div>
                </div>
              </div>
            );
          })}
        </div>
        {filtered.length === 0 && (
          <div className="empty"><div className="icon-chip"><Search size={18} /></div>No products match “{q}”.<div className="mt-12"><button className="btn btn-secondary btn-sm" onClick={() => setCustom(true)}>Enter it as a custom purchase</button></div></div>
        )}
      </Card>

      <CustomPurchase open={custom} onClose={() => setCustom(false)} />
      <ConfirmDialog open={confirmApply} title="Apply this scenario to your plan?"
        body={<div className="stack-sm">
          <div>These will be added to your plan as <strong>planned spending</strong>. Your account balances and transaction history will not change, and nothing is purchased.</div>
          <ul style={{ margin: 0, paddingLeft: 18 }}>{toApply.map((i) => <li key={i.id}>{i.customName}: {i.recurrence ? `${money(i.price)} ${i.recurrence.interval} from ${fmtDate(i.plannedDate)}${i.recurrence.occurrences ? ` for ${i.recurrence.occurrences} payments` : ''}` : i.payment.type === 'installments' ? `${i.payment.months} monthly payments of ${money(installmentPayment(i.price, i.payment.months, i.payment.aprPercent))}` : `${money(i.price)} on ${fmtDate(i.plannedDate)}`}</li>)}</ul>
          <div className="small">You can remove them later from the Plan tab.</div>
        </div>}
        confirmLabel="Apply to plan" onCancel={() => setConfirmApply(false)} onConfirm={() => { setConfirmApply(false); st.applyScenario(); }} />
    </div>
  );
}

function ItemControls({ item }: { item: PurchaseScenario }) {
  const x = useDerived();
  const st = useStore();
  const upd = (patch: Partial<PurchaseScenario>) => st.updateScenarioItem(item.id, patch);
  const offset = Math.max(0, diffDays(item.plannedDate, x.today));
  const [dateText, setDateText] = useState(item.plannedDate);
  const [dateErr, setDateErr] = useState<string | null>(null);
  const commitDate = (v: string) => {
    setDateText(v);
    if (!isValidISO(v)) return setDateErr('Enter a valid date.');
    if (v < x.today) return setDateErr('Purchases must be dated today or later.');
    setDateErr(null);
    upd({ plannedDate: v });
  };
  const product = PRODUCTS.find((p) => p.id === item.productId);
  const cheaper = product?.alternativeId ? PRODUCTS.find((p) => p.id === product.alternativeId) : undefined;
  const pay = item.payment;

  return (
    <div className="stack mt-16" style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
      <div className="eyebrow">Edit “{item.customName}”</div>
      <div className="form-grid">
        <MoneyInput label={item.recurrence ? `Amount per ${item.recurrence.interval.replace('ly', '')}` : 'Price'} value={item.price} min={100} max={100_000_000} onChange={(v) => upd({ price: v })} />
        <div className="field"><label htmlFor={`d-${item.id}`}>{item.recurrence ? 'First payment' : 'Purchase date'}</label>
          <input id={`d-${item.id}`} type="date" className="input" value={dateErr ? dateText : item.plannedDate} min={x.today} onChange={(e) => commitDate(e.target.value)} aria-invalid={!!dateErr} />
          {dateErr && <span className="error">{dateErr}</span>}
        </div>
        <div className="field full">
          <label htmlFor={`r-${item.id}`} className="row-between"><span>Move the date</span><span className="muted small">{offset === 0 ? 'Today' : `In ${offset} days`} · {fmtDate(item.plannedDate)}</span></label>
          <input id={`r-${item.id}`} type="range" min={0} max={540} step={1} value={Math.min(offset, 540)} onChange={(e) => { setDateErr(null); const v = addDays(x.today, Number(e.target.value)); setDateText(v); upd({ plannedDate: v }); }} />
        </div>
      </div>
      {!item.recurrence ? (
        <div className="stack-sm">
          <span className="label small strong">Payment</span>
          <Segmented label="Payment method" value={pay.type} onChange={(v) => upd({ payment: v === 'full' ? { type: 'full' } : { type: 'installments', months: 6, aprPercent: 0 } })} options={[{ value: 'full', label: 'Pay in full' }, { value: 'installments', label: 'Installments' }]} />
          {pay.type === 'installments' && (
            <div className="form-grid">
              <div className="field"><label htmlFor={`m-${item.id}`}>Months</label>
                <select id={`m-${item.id}`} className="select" value={pay.months} onChange={(e) => upd({ payment: { ...pay, months: Number(e.target.value) } })}>{[3, 6, 12, 24, 36, 48, 60].map((m) => <option key={m} value={m}>{m} months</option>)}</select></div>
              <div className="field"><label htmlFor={`a-${item.id}`}>APR</label>
                <div className="input-suffix"><input id={`a-${item.id}`} className="input" type="number" min={0} max={40} step={0.1} value={pay.aprPercent} onChange={(e) => { const v = Number(e.target.value); if (Number.isFinite(v) && v >= 0 && v <= 40) upd({ payment: { ...pay, aprPercent: v } }); }} /><span>%</span></div></div>
              <div className="full small muted">{money(installmentPayment(item.price, pay.months, pay.aprPercent), { exact: true })}/mo · total {money(totalPurchaseCost(item), { exact: true })}{pay.aprPercent > 0 ? ` (${money(totalPurchaseCost(item) - item.price)} interest)` : ''}. Model only plans actually offered to you.</div>
            </div>
          )}
        </div>
      ) : (
        <div className="form-grid">
          <div className="field"><label htmlFor={`ri-${item.id}`}>Repeats</label>
            <select id={`ri-${item.id}`} className="select" value={item.recurrence.interval} onChange={(e) => upd({ recurrence: { ...item.recurrence!, interval: e.target.value as RecurrenceInterval } })}><option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="yearly">Yearly</option></select></div>
          <div className="field"><label htmlFor={`ro-${item.id}`}>Number of payments</label>
            <select id={`ro-${item.id}`} className="select" value={item.recurrence.occurrences ?? 0} onChange={(e) => upd({ recurrence: { ...item.recurrence!, occurrences: Number(e.target.value) || null } })}><option value={0}>Ongoing</option>{[3, 6, 12, 24].map((n) => <option key={n} value={n}>{n}</option>)}</select></div>
          <div className="full small muted">12-month cost {money(totalPurchaseCost(item, 12))} · reduces monthly savings capacity while active.</div>
        </div>
      )}
      {cheaper && <button className="btn btn-secondary btn-sm" onClick={() => st.addScenarioFromProduct(cheaper)}><TrendingDown size={14} /> Compare with {cheaper.name} ({money(cheaper.price)})</button>}
    </div>
  );
}

function Compare({ cmp }: { cmp: ScenarioComparison }) {
  const h = cmp.horizon;
  const ef = cmp.emergency;
  const rows: { label: string; before: string; after: string; worse: boolean; note?: string }[] = [
    { label: 'Safe to spend this month', before: money(cmp.safeBefore.safeToSpend), after: money(cmp.safeAfter.safeToSpend), worse: cmp.safeAfter.safeToSpend < cmp.safeBefore.safeToSpend },
    { label: `Lowest checking balance (${h} mo)`, before: money(cmp.minCash.before), after: money(cmp.minCash.after), worse: cmp.minCash.after < cmp.minCash.before },
    { label: `Checking in ${h} months`, before: money(cmp.cashAtHorizon.before), after: money(cmp.cashAtHorizon.after), worse: cmp.cashAtHorizon.after < cmp.cashAtHorizon.before },
    { label: `Savings in ${h} months`, before: money(cmp.savingsAtHorizon.before), after: money(cmp.savingsAtHorizon.after), worse: cmp.savingsAtHorizon.after < cmp.savingsAtHorizon.before },
    ...(ef ? [{ label: `Emergency fund, end of ${fmtMonth(ef.atMonth)}`, before: `${money(ef.before)} (${Math.round((ef.before / ef.target) * 100)}%)`, after: `${money(ef.after)} (${Math.round((ef.after / ef.target) * 100)}%)`, worse: ef.after < ef.before }] : []),
    { label: 'Monthly savings capacity', before: money(cmp.savingsCapacity.before), after: money(cmp.savingsCapacity.after), worse: cmp.savingsCapacity.after < cmp.savingsCapacity.before },
    { label: 'Cash-flow shortfall', before: cmp.baseline.shortfallPeriods.filter((p) => p <= h).length ? 'Yes' : 'None', after: cmp.scenario.shortfallPeriods.filter((p) => p <= h).length ? `Yes — ${fmtMonth(cmp.scenario.snapshots[cmp.scenario.shortfallPeriods[0]].monthKey)}` : 'None', worse: cmp.newShortfallPeriods.length > 0 },
  ];
  return (
    <div>
      <div className="compare">
        <div className="h">&nbsp;</div><div className="h right">Current plan</div><div className="h scen right">With scenario</div>
        {rows.map((r) => (
          <FragmentRow key={r.label} r={r} />
        ))}
      </div>
      <div className="small muted mt-12">Total scenario outflow within {h} months: <strong className="num">{money(cmp.totalCostInHorizon)}</strong>{cmp.monthlyRecurringCost ? ` · ongoing ${money(cmp.monthlyRecurringCost)}/mo` : ''}</div>
      {cmp.safeAfter.safeToSpend < 0 && <Callout tone="warn" icon={<AlertTriangle size={17} />}>This exceeds what's safe to spend this month. {cmp.scenario.snapshots[0] && Object.values(cmp.scenario.snapshots[Math.max(0, cmp.firstEventPeriod)].pausedContributions).some((v) => v > 0) ? 'Clover pauses lower-priority goal contributions to keep your cash buffer intact.' : 'The difference comes from cash that would otherwise go to goals.'}</Callout>}
      {cmp.newShortfallPeriods.length > 0 && <Callout tone="neg" icon={<AlertTriangle size={17} />}>Projected shortfall: checking goes negative in {fmtMonth(cmp.scenario.snapshots[cmp.newShortfallPeriods[0]].monthKey)} by {money(cmp.scenario.snapshots[cmp.newShortfallPeriods[0]].cashFlowShortfall)}.</Callout>}
    </div>
  );
}

function FragmentRow({ r }: { r: { label: string; before: string; after: string; worse: boolean } }) {
  return (
    <>
      <div className="muted">{r.label}</div>
      <div className="right">{r.before}</div>
      <div className={`right scen strong ${r.worse ? 'neg' : ''}`}>{r.after}</div>
    </>
  );
}

function ImpactRow({ g, cmp }: { g: GoalImpact; cmp: ScenarioComparison }) {
  const x = useDerived();
  const [open, setOpen] = useState(false);
  const m = open ? goalMath(x.inputs, cmp, g.goalId) : null;
  const badge =
    g.kind === 'delayed' ? <span className="badge badge-warning"><Clock size={12} /> {describeDays(g.delayDays!)} later</span>
      : g.kind === 'earlier' ? <span className="badge badge-success">{g.delayDays !== null ? `${describeDays(g.delayDays)} sooner` : 'Now reachable'}</span>
        : g.kind === 'pushed_beyond' ? <span className="badge badge-negative">Not reached within projection</span>
          : g.kind === 'already_complete' ? <span className="badge badge-success">Already complete</span>
            : g.kind === 'not_reached' ? <span className="badge">Not reached in either</span>
              : <span className="badge"><Check size={12} /> No material change</span>;
  return (
    <div style={{ borderTop: '1px solid var(--border)', padding: '12px 0' }}>
      <div className="row-between wrap">
        <div><div className="strong">{g.name}</div><div className="small muted num">{fmtDate(g.baselineDate) === '—' ? 'Not within 5 years' : fmtDate(g.baselineDate)} <ArrowRight size={12} style={{ verticalAlign: -1 }} /> <strong style={{ color: 'var(--text)' }}>{g.scenarioDate ? fmtDate(g.scenarioDate) : 'Not within 5 years'}</strong></div></div>
        <div className="row">{badge}<button className="link-btn small" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? 'Hide the math' : 'Show the math'}</button></div>
      </div>
      {m && (
        <div className="math-panel">
          <h4>Inputs</h4>
          <div className="grid g-2" style={{ gap: '0 24px' }}>
            <div>
              <KV k="Starting checking" v={money(m.startingCash)} />
              <KV k="Cash buffer" v={money(m.buffer)} />
              {m.purchaseLines.slice(0, 4).map((p, i) => <KV key={i} k={`${p.label} · ${fmtDate(p.date, { year: false })}`} v={`−${money(p.amount)}`} />)}
              {m.purchaseLines.length > 4 && <KV k={`+ ${m.purchaseLines.length - 4} more payments`} v="" />}
            </div>
            <div>
              <KV k="Monthly net income" v={money(m.monthly.net)} />
              <KV k="Essentials + discretionary" v={`−${money(m.monthly.essentials + m.monthly.discretionary)}`} />
              <KV k="Debt + recurring" v={`−${money(m.monthly.debt + m.monthly.recurring)}`} />
              <KV k="Scheduled goal contributions" v={`−${money(m.monthly.scheduledContribution)}`} />
              <KV k="Unassigned surplus" v={money(m.monthly.unallocated)} />
            </div>
          </div>
          <KV k={`${m.goal.name}: target / saved`} v={`${money(m.goal.targetAmount)} / ${money(m.goal.currentSavedAmount)}`} />
          <h4>Rules applied</h4>
          <div className="formula">{`Each month: income − spending − debt − scheduled contributions − purchases = cash
${m.protect ? 'If cash < buffer → pause contributions, lowest priority first\n' : ''}${m.sweep ? 'If cash > buffer → sweep the excess to goals in priority order\n' : ''}Completion date = first day the balance reaches the target
  (contributions accrue evenly within the month; day rounded up)
Delay = scenario date − baseline date`}</div>
          <h4>Month by month — {m.goal.name}</h4>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Month</th><th className="r">Purchase</th><th className="r">Added (plan)</th><th className="r">Added (scenario)</th><th className="r">Paused</th><th className="r">Balance (plan)</th><th className="r">Balance (scenario)</th></tr></thead>
              <tbody>
                {m.ledger.map((r) => (
                  <tr key={r.month} className={r.scenarioPurchases > 0 ? 'hl' : ''}>
                    <td>{fmtMonth(r.month, { short: true })}{r.month === m.ledger[0].month ? ' (rest)' : ''}</td>
                    <td className="r">{r.scenarioPurchases ? money(r.scenarioPurchases) : '—'}</td>
                    <td className="r">{money(r.baselineContribution)}</td>
                    <td className="r">{money(r.scenarioContribution)}</td>
                    <td className="r">{r.paused ? money(r.paused) : '—'}</td>
                    <td className="r">{money(r.baselineBalance)}</td>
                    <td className="r strong">{money(r.scenarioBalance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <h4>Result</h4>
          <div className="formula">{`Baseline completion: ${fmtDate(m.baselineDate)}
Scenario completion: ${m.scenarioDate ? fmtDate(m.scenarioDate) : 'not reached within the 5-year projection'}
Difference: ${m.delayDays === null ? 'n/a' : `${m.delayDays} day${Math.abs(m.delayDays) === 1 ? '' : 's'}`}`}</div>
        </div>
      )}
    </div>
  );
}

function Timeline({ cmp, item }: { cmp: ScenarioComparison; item: PurchaseScenario }) {
  const x = useDerived();
  const st = useStore();
  const offset = Math.max(0, diffDays(item.plannedDate, x.today));
  const entries = [
    ...cmp.events.slice(0, 1).map((e) => ({ date: e.date, title: `${e.label}${cmp.events.length > 1 ? ` (+${cmp.events.length - 1} more payments)` : ''}`, sub: money(e.amount), kind: 'purchase' as const })),
    ...cmp.goalImpacts.filter((g) => g.scenarioDate || g.baselineDate).map((g) => ({ date: g.scenarioDate ?? '9999-12-31', title: g.name, sub: g.kind === 'delayed' ? `was ${fmtDate(g.baselineDate)} · ${describeDays(g.delayDays!)} later` : g.kind === 'pushed_beyond' ? `was ${fmtDate(g.baselineDate)} · now beyond projection` : 'No material change', kind: g.kind === 'delayed' || g.kind === 'pushed_beyond' ? ('warn' as const) : ('ok' as const) })),
  ].sort((a, b) => a.date.localeCompare(b.date));
  return (
    <div>
      {item.scenarioStatus === 'draft' && (
        <div className="field" style={{ marginBottom: 16 }}>
          <label htmlFor="tl-range" className="row-between"><span className="row" style={{ gap: 6 }}><CalendarDays size={14} /> {item.customName}</span><span className="muted small">{fmtDate(item.plannedDate)}</span></label>
          <input id="tl-range" type="range" min={0} max={540} value={Math.min(offset, 540)} onChange={(e) => st.updateScenarioItem(item.id, { plannedDate: addDays(x.today, Number(e.target.value)) })} />
          <div className="row-between tiny faint"><span>Today</span><span>+18 months</span></div>
        </div>
      )}
      <div className="timeline">
        {entries.map((e, i) => (
          <div className="tl-item" key={i}>
            <span className={`tl-dot ${e.kind === 'purchase' ? 'purchase' : e.kind === 'warn' ? 'warn' : 'done'}`} />
            <div className="row-between"><span className="strong">{e.title}</span><span className="small num strong">{e.date === '9999-12-31' ? 'Beyond projection' : fmtDate(e.date)}</span></div>
            <div className="small muted">{e.sub}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CustomPurchase({ open, onClose }: { open: boolean; onClose: () => void }) {
  const x = useDerived();
  const st = useStore();
  const blank = { name: '', price: 0, category: 'Other' as ProductCategory, date: x.today, recurring: false, interval: 'monthly' as RecurrenceInterval, occurrences: 0, description: '' };
  const [f, setF] = useState(blank);
  const [touched, setTouched] = useState(false);
  const errors: Record<string, string> = {};
  if (!f.name.trim()) errors.name = 'Name the purchase.';
  if (f.price <= 0) errors.price = 'Enter a price greater than $0.';
  if (f.price > 100_000_000) errors.price = 'That price is outside the supported range.';
  if (!isValidISO(f.date)) errors.date = 'Enter a valid date.';
  else if (f.date < x.today) errors.date = 'Choose today or a future date.';
  const ok = Object.keys(errors).length === 0;
  const submit = () => {
    setTouched(true);
    if (!ok) return;
    st.addCustomScenario({
      productId: null, customName: f.name.trim(), category: f.category, price: f.price, plannedDate: f.date,
      recurrence: f.recurring ? { interval: f.interval, occurrences: f.occurrences || null } : null, payment: { type: 'full' }, description: f.description,
    });
    setF(blank); setTouched(false); onClose();
  };
  return (
    <Modal open={open} onClose={onClose} title="Custom purchase" subtitle="Anything not in the catalog. It's simulated only."
      footer={<><button className="btn btn-secondary" onClick={onClose}>Cancel</button><button className="btn btn-primary" onClick={submit} disabled={touched && !ok}><Sparkles size={15} /> Add to simulation</button></>}>
      <div className="form-grid">
        <div className="field full"><label htmlFor="cp-name">Purchase name</label><input id="cp-name" className="input" value={f.name} maxLength={60} onChange={(e) => setF({ ...f, name: e.target.value })} aria-invalid={touched && !!errors.name} placeholder="e.g. Concert tickets" />{touched && errors.name && <span className="error">{errors.name}</span>}</div>
        <div><MoneyInput label={f.recurring ? 'Amount each time' : 'Price'} value={f.price} onChange={(v) => setF({ ...f, price: v })} />{touched && errors.price && <span className="error small" style={{ color: 'var(--negative)' }}>{errors.price}</span>}</div>
        <div className="field"><label htmlFor="cp-cat">Category</label><select id="cp-cat" className="select" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value as ProductCategory })}>{PRODUCT_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></div>
        <div className="field"><label htmlFor="cp-date">{f.recurring ? 'First payment' : 'Planned date'}</label><input id="cp-date" type="date" className="input" min={x.today} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} aria-invalid={!!errors.date} />{errors.date && <span className="error">{errors.date}</span>}</div>
        <div className="field"><span className="label">Type</span><Segmented label="Purchase type" value={f.recurring ? 'r' : 'o'} onChange={(v) => setF({ ...f, recurring: v === 'r' })} options={[{ value: 'o', label: 'One-time' }, { value: 'r', label: 'Recurring' }]} /></div>
        {f.recurring && <>
          <div className="field"><label htmlFor="cp-int">Repeats</label><select id="cp-int" className="select" value={f.interval} onChange={(e) => setF({ ...f, interval: e.target.value as RecurrenceInterval })}><option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="yearly">Yearly</option></select></div>
          <div className="field"><label htmlFor="cp-occ">Number of payments</label><select id="cp-occ" className="select" value={f.occurrences} onChange={(e) => setF({ ...f, occurrences: Number(e.target.value) })}><option value={0}>Ongoing</option>{[3, 6, 12, 24].map((n) => <option key={n} value={n}>{n}</option>)}</select></div>
        </>}
        <div className="field full"><label htmlFor="cp-desc">Description (optional)</label><input id="cp-desc" className="input" maxLength={120} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
      </div>
      <p className="tiny muted mt-12 row"><Info size={13} /> Invalid prices and past dates are blocked so they never reach the projection.</p>
    </Modal>
  );
}

