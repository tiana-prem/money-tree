import { useState } from 'react';
import { LogOut, RotateCcw } from 'lucide-react';
import { useStore } from '../state/store';
import { useData } from '../state/hooks';
import { ConfirmDialog } from './ui';

/** Reset / start-over controls with their confirmations. Used in the desktop sidebar and on Edit my money. */
export function SessionControls({ layout = 'stack' }: { layout?: 'stack' | 'row' }) {
  const d = useData();
  const resetDemo = useStore((s) => s.resetDemo);
  const startOver = useStore((s) => s.startOver);
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmExit, setConfirmExit] = useState(false);
  const isDemo = d.profile.dataSource !== 'manual';

  return (
    <>
      <div className={layout === 'row' ? 'row wrap' : 'stack-sm'}>
        <button className="btn btn-ghost btn-sm" onClick={() => setConfirmReset(true)}><RotateCcw size={14} /> {isDemo ? 'Reset demo data' : 'Start over'}</button>
        {isDemo && <button className="btn btn-ghost btn-sm" onClick={() => setConfirmExit(true)}><LogOut size={14} /> Back to welcome</button>}
      </div>
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
    </>
  );
}
