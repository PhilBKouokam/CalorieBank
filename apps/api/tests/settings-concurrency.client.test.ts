import { beforeEach, expect, it, vi } from 'vitest';
const request = vi.hoisted(() => vi.fn());
vi.mock('../../mobile/lib/api/client', () => ({ apiRequest: request }));
import { fetchProtectedTarget, saveProtectedTarget, fetchProtectedGoal, SettingsConflictError } from '../../mobile/lib/api/settings-concurrency';
beforeEach(() => request.mockReset());
it('opts in through headers without adding revision fields to the legacy body', async () => {
  request.mockResolvedValue(new Response(JSON.stringify({ calories: 100, chosen: true }), { headers: { 'X-CB-Settings-Revision': '12' } }));
  expect(await fetchProtectedTarget()).toEqual({ value: { calories: 100, chosen: true }, revision: '12' });
  request.mockResolvedValue(new Response('{"calories":150,"chosen":true}'));
  await saveProtectedTarget(150, '12');
  expect(request.mock.calls[1]![1]).toMatchObject({ headers: { 'X-CB-Settings-Concurrency': '1', 'If-Match': '"12"' }, body: '{"calories":150}' });
});
it('fails closed when an older backend supplies no revision', async () => {
  request.mockResolvedValue(new Response('{"calories":100,"chosen":true}'));
  await expect(fetchProtectedTarget()).rejects.toThrow('protection is unavailable');
  await expect(saveProtectedTarget(150, '')).rejects.toThrow('Reload');
  expect(request).toHaveBeenCalledTimes(1);
});
it('absent Fitness Goal retains its revision for conditional creation', async () => {
  request.mockResolvedValue(new Response('{}', { status: 404, headers: { 'X-CB-Settings-Revision': '0' } }));
  expect(await fetchProtectedGoal()).toEqual({ value: null, revision: '0' });
});
it('classifies only structured settings conflicts as reviewable conflicts', async () => {
  request.mockResolvedValue(new Response('{"error":{"details":{"code":"SETTINGS_CONFLICT"}}}', { status: 409 }));
  await expect(saveProtectedTarget(150, '1')).rejects.toBeInstanceOf(SettingsConflictError);
  request.mockResolvedValue(new Response('{"error":{"details":{"code":"RECENT_DAY_STILL_UPDATING"}}}', { status: 409 }));
  await expect(saveProtectedTarget(150, '1')).rejects.not.toBeInstanceOf(SettingsConflictError);
});
