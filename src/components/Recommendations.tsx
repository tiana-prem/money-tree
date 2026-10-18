import { useMemo, useState } from 'react';
import { Check, Lightbulb, Target, X } from 'lucide-react';
import { useStore } from '../state/store';
import { useData, useDerived } from '../state/hooks';
import { ConfirmDialog, KV, MathToggle } from './ui';
import { Recommendation, buildRecommendations, deprioritizedCategories } from '../insights/recommendations';
import { applyRecommendation } from '../insights/applyRec';

/** Open recommendations, most important first. Shows two until the user asks for more. */
export function Recommendations() {
  const d = useData();
  const x = useDerived();
  const st = useStore();
  const [showAll, setShowAll] = useState(false);
  const [confirm, setConfirm] = useState<Recommendation | null>(null);
  const open = useMemo(() => buildRecommendations(d, x).filter((r) => !d.recommendationFeedback[r.id]), [d, x]);
  const lowered = deprioritizedCategories(d);
  const shown = showAll ? open : open.slice(0, 2);

  if (open.length === 0) return <div className="small muted">No suggestions right now. Your plan looks steady.</div>;

  return (
    <div className="stack">
      {shown.map((r) => (
        <RecCard key={r.id} r={r}
          onAccept={() => (r.action?.kind === 'navigate' ? applyRecommendation(r) : setConfirm(r))}
          onDismiss={() => { st.setRecFeedback(r.id, { status: 'dismissed', category: r.category }); st.toast('Dismissed. Similar suggestions will rank lower if you keep dismissing them.', 'info'); }} />
      ))}
      {open.length > 2 && <button className="link-btn" onClick={() => setShowAll(!showAll)}>{showAll ? 'Show fewer' : `Show ${open.length - 2} more`}</button>}
      {lowered.length > 0 && <p className="tiny faint">Some kinds of suggestions rank lower because you dismissed similar ones. That's a simple rule based on your choices, not a learning model.</p>}
      <ConfirmDialog open={!!confirm} title="Apply this suggestion?"
        body={confirm && <div className="stack-sm"><div className="strong" style={{ color: 'var(--text)' }}>{confirm.actionLabel}</div><div>{confirm.impact}.</div><div className="small">This updates your plan, and everything recalculates right away. You can change it back under Edit my money.</div></div>}
        confirmLabel="Apply" onCancel={() => setConfirm(null)} onConfirm={() => { if (confirm) applyRecommendation(confirm); setConfirm(null); }} />
    </div>
  );
}

function RecCard({ r, onAccept, onDismiss }: { r: Recommendation; onAccept: () => void; onDismiss: () => void }) {
  return (
    <div style={{ paddingBottom: 14, borderBottom: '1px solid var(--border)' }}>
      <div className="row" style={{ alignItems: 'flex-start' }}>
        <div className={`icon-chip ${r.category === 'cashflow' ? 'red' : r.category === 'retirement' || r.category === 'debt' ? 'amber' : 'green'}`}>{r.category === 'goals' ? <Target size={17} /> : <Lightbulb size={17} />}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="strong">{r.title}</div>
          <div className="small muted mt-8">{r.issue}</div>
          <div className="mt-8"><span className="badge badge-success" style={{ height: 'auto', padding: '3px 9px', whiteSpace: 'normal' }}>{r.impact}</span></div>
          <div className="row wrap mt-12">
            {r.action && <button className="btn btn-primary btn-sm" onClick={onAccept}><Check size={14} /> {r.action.kind === 'navigate' ? 'Open' : r.actionLabel.length > 34 ? 'Review & apply' : r.actionLabel}</button>}
            <button className="btn btn-ghost btn-sm" onClick={onDismiss}><X size={14} /> Not now</button>
          </div>
          <MathToggle label="Why and how it's calculated">
            <p>{r.reasoning}</p>
            <h4>Numbers</h4>
            {r.math.map((m) => <KV key={m.label} k={m.label} v={m.value} />)}
            <h4>Formula</h4>
            {r.formula.map((f) => <div key={f} className="formula">{f}</div>)}
          </MathToggle>
        </div>
      </div>
    </div>
  );
}
