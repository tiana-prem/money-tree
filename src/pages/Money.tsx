import { useState } from 'react';
import { ArrowLeft, Plus, Trash2, X } from 'lucide-react';
import { useStore } from '../state/store';
import { useData, useDerived } from '../state/hooks';
import { Card, MathToggle, MoneyInput, Switch } from '../components/ui';
import { AllocationBar } from '../components/charts';
import { FREQUENCY_LABEL, PAYCHECKS_PER_YEAR, annualize, toMonthly } from '../engine/income';
import type { BudgetLine, PayFrequency } from '../engine/types';
import { fmtDate } from '../lib/dates';
import { money } from '../lib/money';

/** Edit my money: every plan input in one place. Opened from Home; not a tab. */
export function MoneyPage() {
  const d = useData();
  const x = useDerived();
  const st = useStore();
  const inc = d.plan.income;
  const checking = d.accounts.find((a) => a.type === 'checking');
  const savings = d.accounts.find((a) => a.type === 'savings');
  const debts = d.accounts.filter((a) => a.accountRole === 'liability');
  const planned = [...d.plan.plannedPurchases.map((p) => ({ ...p, kind: 'purchase' as const })), ...d.plan.recurringCommitments.map((p) => ({ ...p, kind: 'recurring' as const }))];

  return (
    <div className="page">
      <button className="link-btn" onClick={() => st.setTab('home')}><ArrowLeft size={15} /> Home</button>
      <div className="page-head mt-12">
        <div>
          <h1>Edit my money</h1>
          <p>Change anything here and safe-to-spend, goals and simulations update right away.</p>
        </div>
      </div>

      <Card title="Where your paycheck goes" subtitle={`${money(x.summary.monthlyNet)} take-home per month${inc.mode === 'estimate' ? ' (estimate)' : ''}`}>
        <AllocationBar s={x.summary} />
        <MathToggle>
          {inc.mode === 'paycheck'
            ? <div className="formula">{`Monthly take-home = ${money(inc.netPerPaycheck, { exact: true })} × ${PAYCHECKS_PER_YEAR[inc.payFrequency]} paychecks ÷ 12 = ${money(x.summary.monthlyNet, { exact: true })}`}</div>
            : <div className="formula">{`Monthly take-home = your estimate = ${money(inc.monthlyEstimate)}`}</div>}
          <div className="formula">{`Left for goals = take-home − essentials − fun money − debt − recurring
            = ${money(x.summary.monthlyNet)} − ${money(x.summary.essentials)} − ${money(x.summary.discretionary)} − ${money(x.summary.debtPayments)} − ${money(x.summary.recurringCommitments)} = ${money(x.summary.savingsCapacity)}`}</div>
          <p className="muted">Each month, any cash above your safety cushion goes to your goals in priority order. If a month runs short, Clover pauses your lowest-priority goal first so your cushion stays intact.</p>
        </MathToggle>
      </Card>

      <div className="grid g-2 mt-16">
        <Card title="Pay" subtitle="Your take-home drives everything else">
          <div className="stack">
            <Switch checked={inc.mode === 'estimate'} onChange={(v) => st.updateIncome({ mode: v ? 'estimate' : 'paycheck', monthlyEstimate: inc.monthlyEstimate || x.summary.monthlyNet })} label="My pay changes month to month" />
            {inc.mode === 'estimate' ? (
              <MoneyInput label="About how much do you take home per month?" value={inc.monthlyEstimate} onChange={(v) => st.updateIncome({ monthlyEstimate: v })} hint="Used as an estimate everywhere." />
            ) : (
              <div className="form-grid">
                <div className="field full"><label htmlFor="pf">How often you’re paid</label>
                  <select id="pf" className="select" value={inc.payFrequency} onChange={(e) => st.updateIncome({ payFrequency: e.target.value as PayFrequency })}>
                    {(Object.keys(FREQUENCY_LABEL) as PayFrequency[]).map((k) => <option key={k} value={k}>{FREQUENCY_LABEL[k]}</option>)}
                  </select>
                </div>
                <MoneyInput label="Take-home per paycheck" value={inc.netPerPaycheck} onChange={(v) => { st.updateIncome({ netPerPaycheck: v }); if (d.paystub) st.updatePaystub({ netPay: v }); }} hint={`${money(toMonthly(inc.netPerPaycheck, inc.payFrequency))}/mo`} />
                <MoneyInput label="Before taxes per paycheck" value={inc.grossPerPaycheck} onChange={(v) => { st.updateIncome({ grossPerPaycheck: v }); if (d.paystub) st.updatePaystub({ grossPay: v, employeeRetirementContribution: Math.round((v * d.paystub.employeeRetirementPercent) / 100) }); }} hint={`${money(annualize(inc.grossPerPaycheck, inc.payFrequency))}/yr`} />
              </div>
            )}
            {d.paystub && (
              <div className="field"><label htmlFor="ret">401(k) contribution</label>
                <div className="input-suffix"><input id="ret" className="input" type="number" min={0} max={75} step={0.5} value={d.paystub.employeeRetirementPercent}
                  onChange={(e) => { const v = Number(e.target.value); if (Number.isFinite(v) && v >= 0 && v <= 75) st.updatePaystub({ employeeRetirementPercent: v, employeeRetirementContribution: Math.round((d.paystub!.grossPay * v) / 100) }); }} /><span>% of pay</span></div>
                <span className="hint">{x.match ? `Your employer adds ${x.match.matchPercentNow}% (${d.paystub.employerMatchPolicy?.description}).` : 'Taken out before taxes.'}</span>
              </div>
            )}
          </div>
        </Card>

        <Card title="Balances & safety cushion">
          <div className="stack">
            {checking && <MoneyInput label="Checking" value={checking.balance} onChange={(v) => st.updateAccount(checking.id, { balance: v })} />}
            {savings && <MoneyInput label="Savings" value={savings.balance} onChange={(v) => st.updateAccount(savings.id, { balance: v })} />}
            <MoneyInput label="Safety cushion to keep in checking" value={d.plan.cashBuffer} onChange={st.setCashBuffer} hint="Never counted as safe to spend." />
          </div>
        </Card>
      </div>

      <div className="grid g-2 mt-16">
        <LinesCard kind="essential" lines={d.plan.essentialExpenses} />
        <LinesCard kind="discretionary" lines={d.plan.discretionaryBudgets} />
      </div>

      <div className="grid g-2 mt-16">
        <Card title="Debt" subtitle="What you owe is never counted as spendable">
          {debts.length === 0 && <div className="small muted">No debts on file.</div>}
          {debts.map((a) => (
            <div className="list-item" key={a.id}>
              <div style={{ flex: 1 }}>
                <div className="strong">{a.name}</div>
                <div className="tiny muted">{money(a.balance)} at {((a.apr ?? 0) * 100).toFixed(2)}% · paid off {x.baseline.debtPayoffDates[a.id] ? fmtDate(x.baseline.debtPayoffDates[a.id]) : 'in 5+ years'}</div>
              </div>
              <div style={{ width: 130 }}><MoneyInput compact value={a.plannedPayment ?? 0} min={a.minimumPayment ?? 0} onChange={(v) => st.updateAccount(a.id, { plannedPayment: v })} /></div>
            </div>
          ))}
        </Card>

        <Card title="Planned purchases" subtitle="Added from Simulate. Not spent yet.">
          {planned.length === 0 && <div className="small muted">Nothing planned. Purchases you apply in Simulate show up here.</div>}
          {planned.map((p) => (
            <div className="list-item" key={p.id}>
              <div style={{ flex: 1 }}>
                <div className="strong">{p.label}</div>
                <div className="tiny muted">{p.kind === 'purchase' ? `One-time · ${fmtDate(p.date)}` : `${p.interval} from ${fmtDate(p.startDate)}${p.occurrences ? ` · ${p.occurrences} payments` : ''}`}</div>
              </div>
              <span className="num strong">{money(p.amount)}</span>
              <button className="btn btn-ghost btn-icon" aria-label={`Remove ${p.label}`} onClick={() => st.removePlanned(p.kind, p.id)}><X size={16} /></button>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}

function LinesCard({ kind, lines }: { kind: 'essential' | 'discretionary'; lines: BudgetLine[] }) {
  const st = useStore();
  const [label, setLabel] = useState('');
  const [amount, setAmount] = useState(0);
  const total = lines.reduce((a, l) => a + l.amount, 0);
  return (
    <Card title={kind === 'essential' ? 'Bills & essentials' : 'Fun money'} subtitle={`${money(total)} per month`}>
      {lines.map((l) => (
        <div className="list-item" key={l.id}>
          <div style={{ flex: 1 }}><div className="strong">{l.label}</div>{l.dueDay && <div className="tiny muted">Due on the {ordinal(l.dueDay)}</div>}</div>
          <div style={{ width: 130 }}><MoneyInput compact value={l.amount} onChange={(v) => st.setBudgetLine(kind, l.id, { amount: v })} /></div>
          <button className="btn btn-ghost btn-icon" aria-label={`Remove ${l.label}`} onClick={() => st.removeBudgetLine(kind, l.id)}><Trash2 size={15} /></button>
        </div>
      ))}
      <form className="row mt-12" style={{ alignItems: 'flex-end' }} onSubmit={(e) => { e.preventDefault(); if (label.trim() && amount > 0) { st.addBudgetLine(kind, label.trim(), amount); setLabel(''); setAmount(0); } }}>
        <div className="field" style={{ flex: 1 }}><label htmlFor={`new-${kind}`} className="sr-only">New category name</label><input id={`new-${kind}`} className="input" placeholder="Add a category" value={label} onChange={(e) => setLabel(e.target.value)} maxLength={40} /></div>
        <div style={{ width: 130 }}><MoneyInput value={amount} onChange={setAmount} /></div>
        <button className="btn btn-secondary btn-icon" style={{ height: 40, width: 40 }} type="submit" disabled={!label.trim() || amount <= 0} aria-label="Add category"><Plus size={16} /></button>
      </form>
    </Card>
  );
}

function ordinal(n: number) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
