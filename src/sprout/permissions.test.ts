import { beforeEach, expect, it, vi } from 'vitest';
import { createPermissionGate } from './permissions';
import { useStore } from '../state/store';
import { createDemoData } from '../data/seed';
beforeEach(() => { vi.stubGlobal('window', { scrollTo: vi.fn() }); useStore.setState({ data: createDemoData('2026-10-18'), toast: vi.fn() }); });
it('makes no edit until approval, applies once, and rejects cancellation', async () => {
 let request: any; const gate = createPermissionGate(r => { request = r; });
 const before = useStore.getState().data;
 const result = gate.run({ action: 'set_income', amount: 5000 });
 expect(useStore.getState().data).toBe(before);
 const approve = request.approve; approve(); approve();
 expect(JSON.parse(await result).ok).toBe(true);
 expect(useStore.getState().data!.plan.income.monthlyEstimate).toBe(500000);
 const next = gate.run({ action: 'set_income', amount: 9000 }); gate.cancel();
 expect(JSON.parse(await next).ok).toBe(false);
 expect(useStore.getState().data!.plan.income.monthlyEstimate).toBe(500000);
});
it('rejects stale approvals and expires pending requests', async () => {
 vi.useFakeTimers();
 let request: any; const gate = createPermissionGate(r => { request = r; });
 const result = gate.run({ action: 'set_cash_buffer', amount: 50 });
 useStore.getState().setCashBuffer(12300); request.approve();
 expect(JSON.parse(await result).ok).toBe(false);
 const pending = gate.run({ action: 'set_cash_buffer', amount: 50 });
 vi.advanceTimersByTime(25000);
 expect(JSON.parse(await pending).ok).toBe(false);
 expect(useStore.getState().data!.plan.cashBuffer).toBe(12300);
 vi.useRealTimers();
});
