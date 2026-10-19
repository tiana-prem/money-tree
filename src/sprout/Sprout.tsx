import { useEffect, useRef, useState } from 'react';
import { ConversationProvider, useConversation } from '@elevenlabs/react';
import { ArrowUp, Check, Mic, MicOff, RotateCcw, Settings2, Square, X } from 'lucide-react';
import { useStore } from '../state/store';
import { createPermissionGate } from './permissions';
import { undoSproutChange, type SproutChange } from './tools';
import { SproutIcon } from './SproutIcon';
import './sprout.css';

interface Message { id: string; role: 'user' | 'sprout' | 'action'; text: string; change?: SproutChange; undone?: boolean }
const configKey = 'money-tree-sprout-agent';
function savedAgent() {
  try { return localStorage.getItem(configKey) || import.meta.env.VITE_ELEVENLABS_AGENT_ID || 'agent_1801m57nwz02e65b9pv8k7br5re2'; }
  catch { return import.meta.env.VITE_ELEVENLABS_AGENT_ID || 'agent_1801m57nwz02e65b9pv8k7br5re2'; }
}
export default function Sprout() {
  return <ConversationProvider><SproutChat /></ConversationProvider>;
}
function SproutChat() {
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState(false);
  const [agentId, setAgentId] = useState(savedAgent);
  const [agentDraft, setAgentDraft] = useState(agentId);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [voice, setVoice] = useState(false);
  const [quiet, setQuiet] = useState(false);
  const launcher = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const log = useRef<HTMLDivElement>(null);
  const serial = useRef(0);
  const queued = useRef('');
  const active = useRef(false);
  const [pending, setPending] = useState<{ label: string; approve: () => void; cancel: () => void } | null>(null);
  const gate = useRef<ReturnType<typeof createPermissionGate>>();
  if (!gate.current) gate.current = createPermissionGate(setPending);
  const session = useRef(0);
  const add = (role: Message['role'], text: string, change?: SproutChange) => {
    setMessages((prev) => [...prev, { id: `local-${serial.current++}`, role, text, change }]);
  };
  const conversation = useConversation({
    clientTools: {
      money_tree: (args) => active.current
        ? gate.current!.run(args, (change) => add('action', change.label, change))
        : JSON.stringify({ ok: false, error: 'Session has ended. No changes were made.' }),
    },
    onConnect: () => { active.current = true; },
    onDisconnect: () => { active.current = false; gate.current?.cancel(); },
    onError: () => {
      active.current = false;
      setError('Sprout couldn’t connect. Check your connection and Agent ID, or try typing instead. For voice, allow microphone access in your browser.');
    },
    onUnhandledClientToolCall: () => setError('Sprout’s app tools need configuration. Add the money_tree client tool in ElevenLabs using docs/sprout-tool.json.'),
    onMessage: (message) => {
      const id = `remote-${session.current}-${message.role}-${message.event_id}`;
      const role = message.role === 'user' ? 'user' : 'sprout';
      setMessages((prev) => {
        const existing = prev.findIndex((m) => m.id === id);
        if (existing >= 0) return prev.map((m, i) => i === existing ? { ...m, text: message.message } : m);
        // Some transports echo typed input; keep only one visible copy.
        if (role === 'user' && prev.at(-1)?.role === 'user' && prev.at(-1)?.text === message.message) return prev;
        return [...prev, { id, role, text: message.message }];
      });
    },
  });
  const connected = conversation.status === 'connected';
  const connecting = conversation.status === 'connecting';
  const data = useStore((s) => s.data);
  useEffect(() => {
    if (connected) conversation.sendContextualUpdate('The MoneyTree plan may have changed. Call money_tree with get_context before advising or editing.');
  }, [data, connected, conversation.sendContextualUpdate]);
  useEffect(() => { if (open) closeButton.current?.focus(); }, [open]);
  useEffect(() => { if (log.current) log.current.scrollTop = messages.length ? log.current.scrollHeight : 0; }, [messages, open, error]);
  function stop() { queued.current = ''; gate.current?.cancel(); active.current = false; conversation.endSession(); }
  function close() { stop(); setOpen(false); requestAnimationFrame(() => launcher.current?.focus()); }
  function start(withVoice: boolean) {
    if (!agentId) { setSettings(true); return; }
    if (connecting || connected) return;
    setError(''); setVoice(withVoice); session.current++;
    conversation.startSession({ agentId, textOnly: !withVoice, connectionType: withVoice ? 'webrtc' : 'websocket' });
  }
  function send(text = draft) {
    if (!text.trim()) return;
    if (!connected) { queued.current = text.trim(); setDraft(text); start(false); return; }
    try { conversation.sendUserMessage(text.trim()); add('user', text.trim()); setDraft(''); }
    catch { setError('Your message wasn’t sent. Reconnect and try again.'); }
  }
  useEffect(() => () => { active.current = false; gate.current?.cancel(); }, []);
  useEffect(() => { if (connected && queued.current) { const text = queued.current; queued.current = ''; send(text); } }, [connected]);
  function saveAgent() {
    const value = agentDraft.trim();
    if (!/^agent_[a-zA-Z0-9_-]+$/.test(value)) { setError('Use an ElevenLabs Agent ID beginning with agent_.'); return; }
    try { localStorage.setItem(configKey, value); } catch { /* Session-only setup still works. */ }
    setAgentId(value); setSettings(false); setError('');
  }
  return <>
    <button ref={launcher} className={`sprout-launcher ${open ? 'sprout-hidden' : ''}`} onClick={() => setOpen(true)} aria-label="Ask Sprout, your MoneyTree assistant" aria-expanded={open} aria-controls="sprout-panel">
      <SproutIcon size={36} />
    </button>
    {open && <section id="sprout-panel" className="sprout-panel" role="dialog" aria-modal="false" aria-labelledby="sprout-title" onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } }}>
      <header className="sprout-header">
        <SproutIcon size={32} /><div><h2 id="sprout-title">Sprout</h2></div>
        {error && <button className="sprout-icon-btn" aria-label="Sprout settings" disabled={connecting || connected} onClick={() => setSettings(!settings)}><Settings2 size={17} /></button>}
        <button ref={closeButton} className="sprout-icon-btn" aria-label="Close Sprout and stop microphone" onClick={close}><X size={19} /></button>
      </header>
      {(connecting || (connected && voice)) && <div className="sprout-status" role="status"><span className="sprout-dot live" />{connecting ? 'Connecting…' : conversation.isMuted ? 'Microphone paused' : conversation.isSpeaking ? 'Speaking…' : 'Listening…'}</div>}
      {settings && <form className="sprout-settings" onSubmit={(e) => { e.preventDefault(); saveAgent(); }}>
        <label htmlFor="sprout-agent">ElevenLabs Agent ID</label>
        <input id="sprout-agent" value={agentDraft} onChange={(e) => setAgentDraft(e.target.value)} placeholder="agent_…" autoComplete="off" />
        <p>Connect your Sprout agent. Use an Agent ID, never an API key.</p>
        <button className="btn btn-primary btn-sm" type="submit">Save connection</button>
      </form>}
      <div className="sprout-log" ref={log} role="log" aria-label="Conversation with Sprout" aria-live="polite" aria-relevant="additions text">
        {messages.length === 0 && <div className="sprout-welcome"><h3>How can I help?</h3><p>Try a purchase or talk through your budget.</p></div>}
        {!agentId && <p className="sprout-notice">Sprout’s voice and chat are waiting for an ElevenLabs connection. Add your Agent ID in settings to get started.</p>}
        {messages.map((message) => <div key={message.id} className={`sprout-message ${message.role}`}>
          <span className="sprout-message-name">{message.role === 'user' ? 'You' : message.role === 'action' ? 'Updated in MoneyTree' : 'Sprout'}</span>
          <p>{message.role === 'action' && <Check size={14} />} {message.text}</p>
          {message.change && !message.undone && <button className="sprout-undo" onClick={() => {
            if (!undoSproutChange(message.change!)) { setError('Your plan has changed since this action. Ask Sprout to adjust the current values instead.'); return; }
            setMessages((prev) => prev.map((m) => m.id === message.id ? { ...m, undone: true } : m));
            if (connected) conversation.sendContextualUpdate(`The user undid: ${message.text}. Read get_context again.`);
          }}><RotateCcw size={12} /> Undo</button>}
          {message.undone && <small>Undone</small>}
        </div>)}
      </div>
      {pending && <div className="sprout-approval" role="group" aria-label="Approve Sprout change"><strong>Make this change?</strong><small> Approve within 25 seconds.</small><p>{pending.label}</p><div><button className="btn btn-primary btn-sm" onClick={pending.approve}>Approve change</button><button className="btn btn-sm" onClick={pending.cancel}>Cancel</button></div></div>}
      {error && <div className="sprout-error" role="alert">{error}<button aria-label="Dismiss error" onClick={() => setError('')}><X size={14} /></button></div>}
      <footer className="sprout-footer">
        {!connected && !connecting && <div className="sprout-connect"><button className="sprout-voice-start" onClick={() => start(true)}><Mic size={17} /> Talk to Sprout</button></div>}
        {connecting && <button className="sprout-stop" onClick={stop}><Square size={13} /> Cancel connection</button>}
        {connected && <div className="sprout-session-controls">
          {voice && <><button onClick={() => conversation.setMuted(!conversation.isMuted)} aria-pressed={conversation.isMuted}>{conversation.isMuted ? <MicOff size={15} /> : <Mic size={15} />}{conversation.isMuted ? 'Unmute' : 'Pause mic'}</button><button aria-pressed={quiet} onClick={() => { setQuiet(!quiet); conversation.setVolume({ volume: quiet ? 1 : 0 }); }}>{quiet ? 'Voice replies on' : 'Text replies only'}</button></>}
          <button onClick={stop}><Square size={13} /> End chat</button>
        </div>}
        <form className="sprout-compose" onSubmit={(e) => { e.preventDefault(); send(); }}>
          <input aria-label="Message Sprout" value={draft} maxLength={2000} onChange={(e) => setDraft(e.target.value)} placeholder="Ask Sprout…" />
          <button type="submit" disabled={connecting || !draft.trim()} aria-label={connected ? 'Send message' : 'Connect text chat'}><ArrowUp size={19} /></button>
        </form>
        <p className="sprout-fine">AI by ElevenLabs · Chat shares your plan details.<br />You approve every change.</p>
      </footer>
    </section>}
  </>;
}
