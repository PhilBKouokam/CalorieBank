import { expect, it, vi } from 'vitest';
it('a fresh JavaScript module/process has no prior session draft or destructive editor capability', async () => {
  const first = await import('../../mobile/lib/drafts/session-drafts');
  first.setDraftSession('a', 'session-a');
  first.openDraft('calorie-correction', 'today', '1', '150');
  vi.resetModules();
  const restarted = await import('../../mobile/lib/drafts/session-drafts');
  expect(restarted.draftSessionReady()).toBe(false);
  restarted.setDraftSession('a', 'session-a');
  expect(restarted.openDraft('calorie-correction', 'today', '1', '100').value).toBe('100');
  first.terminateDraftSession(); restarted.terminateDraftSession();
});
