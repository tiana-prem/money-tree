import { useState } from 'react';
import { ArrowRight, FileText, PencilLine, ShieldCheck, Sparkles } from 'lucide-react';
import { useStore } from '../state/store';
import { Logo, Modal, MoneyInput } from '../components/ui';
import { demoPaystub } from '../data/seed';
import { todayISO } from '../lib/dates';
import { money } from '../lib/money';
import type { PayFrequency } from '../engine/types';
import { FREQUENCY_LABEL, toMonthly } from '../engine/income';

export function Onboarding() {
  const loadDemo = useStore((s) => s.loadDemo);
  const [manual, setManual] = useState(false);
  const [stub, setStub] = useState(false);

  return (
    <div className="onboard">
      <div className="onboard-inner">
        <div className="row" style={{ marginBottom: 28 }}><Logo size={36} /><span style={{ fontSize: 24, fontWeight: 680, letterSpacing: '-0.02em' }}>Clover</span></div>
        <h1 style={{ fontSize: 40, maxWidth: 720, lineHeight: 1.1 }}>Know what you can spend today, what it costs your future, and how to grow toward your goals.</h1>
        <p className="muted" style={{ fontSize: 17, marginTop: 14, maxWidth: 640 }}>
          Built for your first full-time job: take-home pay, 401(k) matching, student loans, rent, an emergency fund and the big purchases in between.
        </p>

        <div className="grid g-3 mt-24" style={{ marginTop: 36 }}>
          <button className="card option-card" onClick={() => loadDemo('demo')}>
            <div className="icon-chip green"><Sparkles size={18} /></div>
            <h2>Explore the demo</h2>
            <p className="muted small">A fictional recent graduate with six months of simulated transactions, goals, a student loan and a 401(k) match.</p>
            <span className="link-btn mt-8">Start exploring <ArrowRight size={15} /></span>
          </button>
          <button className="card option-card" onClick={() => setManual(true)}>
            <div className="icon-chip blue"><PencilLine size={18} /></div>
            <h2>Enter your numbers</h2>
            <p className="muted small">Type in your pay, rent, spending and balances. Takes about two minutes. Nothing leaves your browser.</p>
            <span className="link-btn mt-8">Enter manually <ArrowRight size={15} /></span>
          </button>
          <button className="card option-card" onClick={() => setStub(true)}>
            <div className="icon-chip amber"><FileText size={18} /></div>
            <h2>Import a sample paystub</h2>
            <p className="muted small">Preview a simulated ADP paystub, review and edit every field, then explore the demo with your pay.</p>
            <span className="link-btn mt-8">Review paystub <ArrowRight size={15} /></span>
          </button>
        </div>

        <div className="row mt-24 small muted" style={{ marginTop: 28 }}>
          <ShieldCheck size={16} /> Demo connections are simulated. Clover never asks for bank or payroll credentials, and projections are educational estimates, not financial advice.
        </div>
      </div>
      <ManualSetup open={manual} onClose={() => setManual(false)} />
      <PaystubImport open={stub} onClose={() => setStub(false)} />
    </div>
  );
}

function ManualSetup({ open, onClose }: { open: boolean; onClose: () => void }) {
  const loadManual = useStore((s) => s.loadManual);
  const [f, setF] = useState({
    name: '', payFrequency: 'biweekly' as PayFrequency, netPerPaycheck: 180000, grossPerPaycheck: 250000,
    rent: 120000, otherEssentials: 60000, discretionary: 50000, checking: 200000, savings: 300000, debtBalance: 0, debtPayment: 0, debtApr: 0.05,
  });
  const set = (k: keyof typeof f) => (v: any) => setF({ ...f, [k]: v });
  const monthly = toMonthly(f.netPerPaycheck, f.payFrequency);
  const committed = f.rent + f.otherEssentials + f.discretionary + f.debtPayment;
  const errors: string[] = [];
  if (f.netPerPaycheck <= 0) errors.push('Net pay must be greater than zero.');
  if (f.grossPerPaycheck < f.netPerPaycheck) errors.push('Gross pay should be at least net pay.');
  if (f.debtBalance > 0 && f.debtPayment <= 0) errors.push('Add a monthly payment for your debt.');
  return (
    <Modal open={open} onClose={onClose} wide title="Enter your numbers" subtitle="Estimates are fine — you can change anything later under Edit my money."
      footer={<>
        <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" disabled={errors.length > 0} onClick={() => loadManual(f)}>Create my plan</button>
      </>}>
      <div className="form-grid">
        <div className="field full"><label htmlFor="m-name">First name (optional)</label><input id="m-name" className="input" value={f.name} onChange={(e) => set('name')(e.target.value)} maxLength={40} /></div>
        <div className="field"><label htmlFor="m-freq">Pay frequency</label>
          <select id="m-freq" className="select" value={f.payFrequency} onChange={(e) => set('payFrequency')(e.target.value)}>
            {(Object.keys(FREQUENCY_LABEL) as PayFrequency[]).map((k) => <option key={k} value={k}>{FREQUENCY_LABEL[k]}</option>)}
          </select>
        </div>
        <MoneyInput label="Net pay per paycheck" value={f.netPerPaycheck} onChange={set('netPerPaycheck')} hint={`≈ ${money(monthly)} per month`} />
        <MoneyInput label="Gross pay per paycheck" value={f.grossPerPaycheck} onChange={set('grossPerPaycheck')} />
        <MoneyInput label="Monthly rent" value={f.rent} onChange={set('rent')} />
        <MoneyInput label="Other essentials per month" value={f.otherEssentials} onChange={set('otherEssentials')} hint="Groceries, utilities, transport, insurance" />
        <MoneyInput label="Discretionary spending per month" value={f.discretionary} onChange={set('discretionary')} hint="Dining, shopping, fun" />
        <MoneyInput label="Checking balance" value={f.checking} onChange={set('checking')} />
        <MoneyInput label="Savings balance" value={f.savings} onChange={set('savings')} />
        <MoneyInput label="Debt balance (optional)" value={f.debtBalance} onChange={set('debtBalance')} />
        <MoneyInput label="Monthly debt payment" value={f.debtPayment} onChange={set('debtPayment')} />
      </div>
      <div className={`callout ${monthly - committed < 0 ? 'neg' : 'good'} mt-16`}>
        <div>Monthly take-home {money(monthly)} − committed {money(committed)} = <strong>{money(monthly - committed)}</strong> left for savings goals.</div>
      </div>
      {errors.map((e) => <div key={e} className="error small mt-8" role="alert" style={{ color: 'var(--negative)' }}>{e}</div>)}
    </Modal>
  );
}

function PaystubImport({ open, onClose }: { open: boolean; onClose: () => void }) {
  const loadDemo = useStore((s) => s.loadDemo);
  const sample = demoPaystub(todayISO());
  const [gross, setGross] = useState(sample.grossPay);
  const [net, setNet] = useState(sample.netPay);
  const [pct, setPct] = useState(sample.employeeRetirementPercent);
  const valid = net > 0 && gross >= net && pct >= 0 && pct <= 75;
  const confirm = () => {
    loadDemo('paystub');
    const s = useStore.getState();
    s.updatePaystub({ grossPay: gross, netPay: net, employeeRetirementPercent: pct, employeeRetirementContribution: Math.round((gross * pct) / 100) });
    s.applyPaystubToPlan();
  };
  return (
    <Modal open={open} onClose={onClose} title="Simulated ADP paystub" subtitle="Sample data for the demo. No payroll account is connected and no credentials are requested."
      footer={<>
        <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" disabled={!valid} onClick={confirm}>Use these values</button>
      </>}>
      <div className="stack">
        <div className="row-between"><span className="badge badge-outline">Simulated</span><span className="small muted">{sample.employer} · pay date {sample.payDate} · twice a month</span></div>
        <div className="form-grid">
          <MoneyInput label="Gross pay" value={gross} onChange={setGross} />
          <MoneyInput label="Net pay" value={net} onChange={setNet} />
          <div className="field"><label htmlFor="ps-401k">401(k) contribution</label>
            <div className="input-suffix"><input id="ps-401k" className="input" type="number" min={0} max={75} step={0.5} value={pct} onChange={(e) => setPct(Number(e.target.value))} aria-invalid={!valid} /><span>% of pay</span></div>
          </div>
          <div className="field"><span className="label">Employer match</span><span className="small muted">{sample.employerMatchPolicy?.description}</span></div>
        </div>
        <div className="small muted">
          Withholding: federal {money(sample.taxWithholding.federal, { exact: true })}, state {money(sample.taxWithholding.state, { exact: true })}, Social Security {money(sample.taxWithholding.socialSecurity, { exact: true })}, Medicare {money(sample.taxWithholding.medicare, { exact: true })}. Other: health insurance {money(sample.otherDeductions[0].amount, { exact: true })}.
        </div>
        {!valid && <div className="error small" role="alert" style={{ color: 'var(--negative)' }}>Gross pay must be at least net pay, and the 401(k) rate must be between 0% and 75%.</div>}
      </div>
    </Modal>
  );
}
