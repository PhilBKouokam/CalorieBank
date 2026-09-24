import React from 'react';
import { resolve } from 'node:path';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const router = vi.hoisted(() => ({ canGoBack: vi.fn(), back: vi.fn(), replace: vi.fn() }));
vi.mock('expo-router', () => ({ useRouter: () => router }));
vi.mock('@react-navigation/elements', () => ({ HeaderBackButton: 'HeaderBackButton' }));
let view: ReactTestRenderer | undefined;
beforeEach(() => { Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }); vi.clearAllMocks(); });
afterEach(async () => { if (view) await act(async () => view?.unmount()); });
async function mount(fallback: '/today' | '/settings') {
  const { NavigationBackButton } = await import(resolve(__dirname, '../../mobile/components/caloriebank/NavigationBackButton.tsx'));
  await act(async () => { view = create(React.createElement(NavigationBackButton, { fallback })); });
  return view!.root.find((node) => String(node.type) === 'HeaderBackButton');
}
it('returns through navigation history, including a nested stack parent, without replacing the origin', async () => {
  router.canGoBack.mockReturnValue(true);
  const button = await mount('/today');
  await act(async () => button.props.onPress());
  expect(router.back).toHaveBeenCalledOnce();
  expect(router.replace).not.toHaveBeenCalled();
  expect(button.props.accessibilityLabel).toBe('Back');
  expect(button.props.style).toEqual({ minWidth: 48, minHeight: 48 });
});
it.each(['/today', '/settings'] as const)('returns a directly opened screen safely to %s without history', async (fallback) => {
  router.canGoBack.mockReturnValue(false);
  const button = await mount(fallback);
  await act(async () => button.props.onPress());
  expect(router.back).not.toHaveBeenCalled();
  expect(router.replace).toHaveBeenCalledWith(fallback);
});
