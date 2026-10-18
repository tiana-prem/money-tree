import { ReactNode, useEffect, useId, useRef, useState } from 'react';
import { Calculator, CheckCircle2, ChevronDown, ChevronUp, Info, X } from 'lucide-react';
import { useStore } from '../state/store';
import { parseDollars, toDollars } from '../lib/money';

export function Logo({ size = 30 }: { size?: number }) {
  // Four-leaf mark built from rounded leaves.
  return (
    <svg className="brand-mark" width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="9" fill="#1f5c3f" />
      <g fill="#e5efe8">
        <path d="M16 15.2c-1.6-3.9-6.6-4-6.9-.6-.3 3 3.6 3.7 6.9.6Z" />
        <path d="M16.8 16c3.9-1.6 4-6.6.6-6.9-3-.3-3.7 3.6-.6 6.9Z" />
        <path d="M16 16.8c1.6 3.9 6.6 4 6.9.6.3-3-3.6-3.7-6.9-.6Z" />
        <path d="M15.2 16c-3.9 1.6-4 6.6-.6 6.9 3 .3 3.7-3.6.6-6.9Z" />
      </g>
      <path d="M16 16.5c.8 3 2.2 5.4 4.4 7.3" stroke="#8fb59a" strokeWidth="1.4" fill="none" strokeLinecap="round" />
    </svg>
  );
}

export function Card({ title, subtitle, action, children, className = '', id }: { title?: ReactNode; subtitle?: ReactNode; action?: ReactNode; children: ReactNode; className?: string; id?: string }) {
  return (
    <section className={`card ${className}`} id={id}>
      {(title || action) && (
        <div className="card-head">
          <div>
            {title && <h2>{title}</h2>}
            {subtitle && <p>{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Progress({ value, tone, label, ghostFrom }: { value: number; tone?: 'sage' | 'warn'; label: string; ghostFrom?: number }) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <div className={`progress ${tone ?? ''}`} role="progressbar" aria-label={label} aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
      <span style={{ width: `${pct}%` }} />
      {ghostFrom !== undefined && ghostFrom > value && (
        <div className="ghost" style={{ left: `${pct}%`, width: `${(Math.min(1, ghostFrom) - value) * 100}%` }} />
      )}
    </div>
  );
}

export function Modal({ open, onClose, title, subtitle, children, footer, wide }: { open: boolean; onClose: () => void; title: string; subtitle?: string; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const first = ref.current?.querySelector<HTMLElement>('input, select, textarea, button:not(.modal-close)');
    first?.focus();
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; prev?.focus?.(); };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-labelledby={titleId} ref={ref}>
        <div className="modal-head">
          <div>
            <h2 id={titleId}>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button className="btn btn-ghost btn-icon modal-close" onClick={onClose} aria-label="Close dialog"><X size={18} /></button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function ConfirmDialog({ open, title, body, confirmLabel, tone = 'primary', onConfirm, onCancel }: { open: boolean; title: string; body: ReactNode; confirmLabel: string; tone?: 'primary' | 'danger'; onConfirm: () => void; onCancel: () => void }) {
  return (
    <Modal open={open} onClose={onCancel} title={title}
      footer={<>
        <button className="btn btn-secondary" onClick={onCancel}>Cancel</button>
        <button className={`btn ${tone === 'danger' ? 'btn-danger' : 'btn-primary'}`} onClick={onConfirm}>{confirmLabel}</button>
      </>}>
      <div className="muted">{body}</div>
    </Modal>
  );
}

/** Dollar input that stores cents. Shows a validation error and only commits valid values. */
export function MoneyInput({ label, value, onChange, hint, min = 0, max, id, required, compact }: {
  label?: string; value: number; onChange: (cents: number) => void; hint?: string; min?: number; max?: number; id?: string; required?: boolean; compact?: boolean;
}) {
  const auto = useId();
  const inputId = id ?? auto;
  const [text, setText] = useState(fmtInput(value));
  const [error, setError] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);
  useEffect(() => { if (!focused) setText(fmtInput(value)); }, [value, focused]);
  const commit = (raw: string) => {
    const c = parseDollars(raw);
    if (c === null) { setError(raw.trim() === '' && !required ? null : 'Enter a valid amount, e.g. 1250 or 1,250.50'); return; }
    if (c < min) { setError(`Must be at least $${toDollars(min).toLocaleString()}`); return; }
    if (max !== undefined && c > max) { setError(`Must be at most $${toDollars(max).toLocaleString()}`); return; }
    setError(null);
    if (c !== value) onChange(c);
  };
  return (
    <div className="field">
      {label && <label htmlFor={inputId}>{label}</label>}
      <div className="input-money">
        <span>$</span>
        <input id={inputId} className="input" inputMode="decimal" value={text} aria-invalid={!!error} aria-describedby={error ? `${inputId}-err` : undefined}
          style={compact ? { height: 34 } : undefined}
          onFocus={() => setFocused(true)}
          onChange={(e) => { setText(e.target.value); const c = parseDollars(e.target.value); if (c !== null && c >= min && (max === undefined || c <= max)) { setError(null); } }}
          onBlur={(e) => { setFocused(false); commit(e.target.value); }}
          onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} />
      </div>
      {error ? <span className="error" id={`${inputId}-err`} role="alert">{error}</span> : hint ? <span className="hint">{hint}</span> : null}
    </div>
  );
}

function fmtInput(c: number) {
  const d = c / 100;
  return Number.isInteger(d) ? d.toLocaleString('en-US') : d.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function Segmented<T extends string | number>({ options, value, onChange, label }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void; label: string }) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={String(o.value)} type="button" aria-pressed={o.value === value} onClick={() => onChange(o.value)}>{o.label}</button>
      ))}
    </div>
  );
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode }) {
  return (
    <label className="switch">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="track" />
      <span>{label}</span>
    </label>
  );
}

/** "Show the math" disclosure used on every key result. */
export function MathToggle({ children, label = 'Show the math' }: { children: ReactNode; label?: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <div className="math-toggle">
      <button className="link-btn" aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}>
        <Calculator size={15} /> {open ? 'Hide the math' : label} {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>
      {open && <div className="math-panel" id={id}>{children}</div>}
    </div>
  );
}

export function KV({ k, v, total, className = '' }: { k: ReactNode; v: ReactNode; total?: boolean; className?: string }) {
  return <div className={`kv ${total ? 'total' : ''} ${className}`}><span className="k">{k}</span><span className="v">{v}</span></div>;
}

export function Callout({ tone = 'info', children, icon }: { tone?: 'info' | 'warn' | 'neg' | 'good' | 'plain'; children: ReactNode; icon?: ReactNode }) {
  return <div className={`callout ${tone}`}>{icon ?? <Info size={17} />}<div>{children}</div></div>;
}

export function Toasts() {
  const toasts = useStore((s) => s.toasts);
  const dismiss = useStore((s) => s.dismissToast);
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((t) => (
        <div className="toast" key={t.id} role="status">
          <CheckCircle2 size={17} color={t.tone === 'error' ? '#f3a4a4' : '#9fd3b0'} />
          <span style={{ flex: 1 }}>{t.message}</span>
          <button className="btn btn-icon btn-sm" style={{ color: 'white', background: 'transparent' }} onClick={() => dismiss(t.id)} aria-label="Dismiss"><X size={15} /></button>
        </div>
      ))}
    </div>
  );
}

export function ChartTooltip({ active, payload, label, formatter, labelFormatter }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="tooltip">
      <div className="t-title">{labelFormatter ? labelFormatter(label) : label}</div>
      {payload.map((p: any) => (
        <div className="t-row" key={p.dataKey}>
          <span className="l"><span className="swatch" style={{ background: p.color ?? p.stroke ?? p.fill }} />{p.name}</span>
          <span>{formatter ? formatter(p.value, p.dataKey) : p.value}</span>
        </div>
      ))}
    </div>
  );
}
