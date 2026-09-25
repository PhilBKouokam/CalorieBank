import React from 'react';
import { resolve } from 'node:path';
import { act, create } from 'react-test-renderer';
import { expect, it, vi } from 'vitest';
vi.mock('expo-router', () => ({ Redirect: 'Redirect' }));
it('routes old Android food links into the shared consumer chooser without mutating authority', async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const Screen = (await import(resolve(__dirname, '../../mobile/screens/native-food.android.tsx'))).default;
  let view!: ReturnType<typeof create>;
  await act(async () => { view = create(React.createElement(Screen)); });
  expect(view.root.find((n) => String(n.type) === 'Redirect').props.href).toEqual({ pathname: '/integrations', params: { foodChooser: '1' } });
  await act(async () => view.unmount());
});
