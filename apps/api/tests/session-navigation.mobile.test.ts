import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { beforeEach, expect, it, vi } from 'vitest';
import type { NavigationState, PartialState } from '@react-navigation/native';
import { setDraftSession, terminateDraftSession, openDraft } from '../../mobile/lib/drafts/session-drafts';
const nav = vi.hoisted(() => ({ state: {} as unknown, listeners: new Set<() => void>(), reset: vi.fn(), ref: {} as unknown }));
vi.mock('expo-router', () => ({ useNavigationContainerRef: () => nav.ref }));
import { rememberNavigation, restorableNavigation, useSessionNavigation } from '../../mobile/lib/drafts/use-session-navigation';
type State = PartialState<NavigationState>;
const selected: State = { index: 1, routes: [
  { name: '(tabs)', state: { index: 2, routes: [{ name: 'today' }, { name: 'history' }, { name: 'settings' }] } },
  { name: '(settings)', state: { index: 0, routes: [{ name: 'edit-calories' }] } },
] };
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }); terminateDraftSession(); setDraftSession('a', 'session-a'); nav.listeners.clear(); nav.reset.mockReset();
  nav.ref = { getRootState: () => nav.state, addListener: (_: string, f: () => void) => { nav.listeners.add(f); return () => nav.listeners.delete(f); }, resetRoot: nav.reset };
});
function Root() { useSessionNavigation(); return React.createElement('Root'); }
it('restores the full stack and selected tab after actual root recreation, after the existing startup gate', async () => {
  nav.state = selected;
  let root!: ReactTestRenderer;
  await act(async () => { root = create(React.createElement(Root)); });
  expect(restorableNavigation()).toEqual(selected);
  await act(async () => root.unmount());
  nav.state = { routes: [{ name: 'index' }] };
  await act(async () => { root = create(React.createElement(Root)); });
  expect(nav.reset).not.toHaveBeenCalled();
  nav.state = { routes: [{ name: '(tabs)', state: { routes: [{ name: 'today' }] } }] };
  await act(async () => nav.listeners.forEach(f => f()));
  expect(nav.reset).toHaveBeenCalledExactlyOnceWith(selected);
  await act(async () => root.unmount());
});
it('Back clears a removed editor draft; Activity unmount alone does not', () => {
  openDraft('calorie-correction', 'today', '1', '150'); rememberNavigation(selected);
  expect(openDraft('calorie-correction', 'today', '1', '100').value).toBe('150');
  rememberNavigation({ routes: [{ name: '(tabs)', state: { routes: [{ name: 'settings' }] } }] });
  expect(openDraft('calorie-correction', 'today', '1', '100').value).toBe('100');
});
it('never restores deletion navigation or another account/session', () => {
  rememberNavigation(selected); setDraftSession('b', 'session-b'); expect(restorableNavigation()).toBeNull();
  rememberNavigation(selected); rememberNavigation({ routes: [{ name: '(settings)', state: { routes: [{ name: 'delete-account' }] } }] });
  expect(restorableNavigation()).toBeNull();
  rememberNavigation(selected); terminateDraftSession(); expect(restorableNavigation()).toBeNull();
});
it('waits for authentication hydration before restoring a saved route', async () => {
  rememberNavigation(selected); nav.state = selected;
  function HydratingRoot({ ready }: { ready: boolean }) { useSessionNavigation(ready); return React.createElement('Root'); }
  let root!: ReactTestRenderer;
  await act(async () => { root = create(React.createElement(HydratingRoot, { ready: false })); });
  expect(nav.reset).not.toHaveBeenCalled();
  await act(async () => root.update(React.createElement(HydratingRoot, { ready: true })));
  expect(nav.reset).toHaveBeenCalledExactlyOnceWith(selected); await act(async () => root.unmount());
});
