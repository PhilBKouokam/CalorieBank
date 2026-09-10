import React from 'react';
import { resolve } from 'node:path';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ fetch: vi.fn(), listener: null as null | ((result: { status: string }) => void) }));
vi.mock('../../mobile/lib/api/client', () => ({ fetchToday: state.fetch }));
vi.mock('../../mobile/lib/lifecycle/account-lifecycle', () => ({ subscribeToAccountLifecycle: (listener: typeof state.listener) => { state.listener = listener; return () => { state.listener = null; }; } }));
describe('read-only Today refresh consumers', () => {
  it('retains known values after failure, recovers, ignores stale generations and unmounts', async () => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    const { useTodayReadModel } = await import(resolve(__dirname, '../../mobile/lib/today/use-today-read-model.ts')) as { useTodayReadModel: () => { today: unknown; failed: boolean } };
    function Consumer() { return React.createElement('output', null, JSON.stringify(useTodayReadModel())); }
    state.fetch.mockResolvedValue({ steps: { count: 100 } });
    let view!: ReactTestRenderer;
    await act(async () => { view = create(React.createElement(Consumer)); });
    state.fetch.mockRejectedValueOnce(new Error('network'));
    await act(async () => state.listener!({ status: 'partial' }));
    expect(JSON.stringify(view.toJSON())).toContain('100');
    expect(JSON.stringify(view.toJSON())).toContain('false');
    let resolveOld!: (value: unknown) => void;
    state.fetch.mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve; }));
    await act(async () => state.listener!({ status: 'success' }));
    state.fetch.mockResolvedValue({ steps: { count: 300 } });
    await act(async () => state.listener!({ status: 'success' }));
    await act(async () => resolveOld({ steps: { count: 200 } }));
    expect(JSON.stringify(view.toJSON())).toContain('300');
    expect(JSON.stringify(view.toJSON())).not.toContain('200');
    await act(async () => view.unmount()); expect(state.listener).toBeNull();
  });
});
