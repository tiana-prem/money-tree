import { useEffect, useState } from 'react';
import { Flower2, LogOut, Home as HomeIcon, Lightbulb, RotateCcw, Route, ShoppingBag, Target } from 'lucide-react';
import { useStore } from './state/store';
import type { TabId } from './state/schema';
import { ConfirmDialog, Logo, Toasts } from './components/ui';
import { Onboarding } from './pages/Onboarding';
import { HomePage } from './pages/Home';
import { PlanPage } from './pages/Plan';
import { GoalsPage } from './pages/Goals';
import { SimulatePage } from './pages/Simulate';
import { InsightsPage } from './pages/Insights';
import { GardenPage } from './pages/Garden';
import { fmtDate } from './lib/dates';
import { effectiveToday } from './state/derive';

export const TABS: { id: TabId; label: string; icon: typeof HomeIcon }[] = [
  { id: 'home', label: 'Home', icon: HomeIcon },
  { id: 'plan', label: 'Plan', icon: Route },
  { id: 'goals', label: 'Goals', icon: Target },
  { id: 'simulate', label: 'Simulate', icon: ShoppingBag },
  { id: 'insights', label: 'Insights', icon: Lightbulb },
  { id: 'garden', label: 'Garden', icon: Flower2 },
];

export default function App() {
  const data = useStore((s) => s.data);
  const tab = useStore((s) => s.tab);
  const setTab = useStore((s) => s.setTab);
  const syncGarden = useStore((s) => s.syncGarden);
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmExit, setConfirmExit] = useState(false);
  const resetDemo = useStore((s) => s.resetDemo);
  const startOver = useStore((s) => s.startOver);

  // Evaluate completed weeks once per load. Idempotent, so reloads never duplicate points.
  useEffect(() => { if (data) syncGarden(); }, [!!data]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!data) return <><Onboarding /><Toasts /></>;

  const isDemo = data.profile.dataSource !== 'manual';
  const Page = { home: HomePage, plan: PlanPage, goals: GoalsPage, simulate: SimulatePage, insights: InsightsPage, garden: GardenPage }[tab];

  return (
    <div className="shell">
      <nav className="sidebar" aria-label="Primary">
        <div className="brand"><Logo /> Clover</div>
        {TABS.map((t) => (
          <button key={t.id} className="nav-item" aria-current={tab === t.id ? 'page' : undefined} onClick={() => setTab(t.id)}>
            <t.icon size={19} strokeWidth={tab === t.id ? 2.2 : 1.8} /> {t.label}
          </button>
        ))}
        <div className="sidebar-foot">
          <div className="demo-pill">
            {isDemo ? <>Simulated demo data as of <strong>{fmtDate(effectiveToday(data))}</strong>. No real accounts are connected.</> : <>Using the numbers you entered. Projections are estimates.</>}
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => setConfirmReset(true)}><RotateCcw size={14} /> {isDemo ? 'Reset demo data' : 'Start over'}</button>
          {isDemo && <button className="btn btn-ghost btn-sm" onClick={() => setConfirmExit(true)}><LogOut size={14} /> Back to welcome</button>}
        </div>
      </nav>

      <div className="main">
        <header className="mobile-top">
          <div className="row strong"><Logo size={26} /> Clover</div>
          <button className="btn btn-ghost btn-sm" onClick={() => setConfirmReset(true)} aria-label={isDemo ? 'Reset demo data' : 'Start over'}><RotateCcw size={14} /> Reset</button>
        </header>
        <main key={tab}><Page /></main>
      </div>

      <nav className="bottom-nav" aria-label="Primary">
        {TABS.map((t) => (
          <button key={t.id} aria-current={tab === t.id ? 'page' : undefined} onClick={() => setTab(t.id)}>
            <span className="bn-icon"><t.icon size={20} strokeWidth={tab === t.id ? 2.2 : 1.8} /></span>
            {t.label}
          </button>
        ))}
      </nav>

      <ConfirmDialog
        open={confirmReset}
        title={isDemo ? 'Reset demo data?' : 'Start over?'}
        body={isDemo
          ? 'This restores the original sample profile, goals, transactions and garden. Your simulations, goals and garden changes will be cleared.'
          : 'This clears everything you entered and returns to the welcome screen.'}
        confirmLabel={isDemo ? 'Reset demo' : 'Start over'}
        tone="danger"
        onCancel={() => setConfirmReset(false)}
        onConfirm={() => { setConfirmReset(false); isDemo ? resetDemo() : startOver(); }}
      />
      <ConfirmDialog
        open={confirmExit}
        title="Return to the welcome screen?"
        body="This closes the demo and clears its data in this browser so you can choose another way to start: the demo, your own numbers, or a sample paystub."
        confirmLabel="Return to welcome"
        tone="danger"
        onCancel={() => setConfirmExit(false)}
        onConfirm={() => { setConfirmExit(false); startOver(); }}
      />
      <Toasts />
    </div>
  );
}
