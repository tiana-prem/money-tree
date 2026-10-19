import Sprout from './sprout/Sprout';
import { useEffect } from 'react';
import { Home as HomeIcon, Leaf, ShoppingBag, Target, Wallet } from 'lucide-react';
import { useStore } from './state/store';
import type { TabId } from './state/schema';
import { Toasts, Wordmark } from './components/ui';
import { SessionControls } from './components/SessionControls';
import { Onboarding } from './pages/Onboarding';
import { HomePage } from './pages/Home';
import { MoneyPage } from './pages/Money';
import { GoalsPage } from './pages/Goals';
import { SimulatePage } from './pages/Simulate';
import { GardenPage } from './pages/Garden';

export const TABS: { id: TabId; label: string; icon: typeof HomeIcon }[] = [
  { id: 'home', label: 'Home', icon: HomeIcon },
  { id: 'simulate', label: 'Shop', icon: ShoppingBag },
  { id: 'goals', label: 'Goals', icon: Target },
  { id: 'garden', label: 'Garden', icon: Leaf },
];

export default function App() {
  const data = useStore((s) => s.data);
  const storedTab = useStore((s) => s.tab);
  const setTab = useStore((s) => s.setTab);
  const syncGarden = useStore((s) => s.syncGarden);

  // Evaluate completed weeks once per load. Idempotent, so reloads never duplicate points.
  useEffect(() => { if (data) syncGarden(); }, [!!data]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!data) return <><Onboarding /><Toasts /></>;

  const isDemo = data.profile.dataSource !== 'manual';
  const pages = { home: HomePage, simulate: SimulatePage, goals: GoalsPage, garden: GardenPage, money: MoneyPage };
  // Older saved sessions may hold a tab that no longer exists.
  const tab = storedTab in pages ? storedTab : 'home';
  const Page = pages[tab];

  return (
    <div className="shell">
      <nav className="sidebar" aria-label="Primary">
        <Wordmark />
        {TABS.map((t) => (
          <button key={t.id} className="nav-item" aria-current={tab === t.id ? 'page' : undefined} onClick={() => setTab(t.id)}>
            <t.icon size={20} strokeWidth={2} /> {t.label}
          </button>
        ))}
        <button className="nav-item" aria-current={tab === 'money' ? 'page' : undefined} onClick={() => setTab('money')}>
          <Wallet size={20} strokeWidth={2} /> Edit my money
        </button>
        <div className="sidebar-foot">
          {isDemo && <span className="demo-tag">Demo</span>}
          <SessionControls />
        </div>
      </nav>

      <div className="main">
        <header className="mobile-top">
          <Wordmark />
          <button className="top-action" onClick={() => setTab('money')} aria-label="Edit my money" aria-current={tab === 'money' ? 'page' : undefined}><Wallet size={22} /></button>
        </header>
        <main key={tab}><Page /></main>
      </div>

      <nav className="bottom-nav" aria-label="Primary">
        {TABS.map((t) => (
          <button key={t.id} aria-current={tab === t.id ? 'page' : undefined} onClick={() => setTab(t.id)}>
            <span className="bn-icon"><t.icon size={22} strokeWidth={2} /></span>
            {t.label}
          </button>
        ))}
      </nav>
      <Sprout />
      <Toasts />
    </div>
  );
}
