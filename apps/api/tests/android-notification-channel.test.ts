import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ os: 'ios', setChannel: vi.fn() }));
vi.mock('react-native', () => ({ Platform: { get OS() { return state.os; } } }));
vi.mock('expo-notifications', () => ({
  setNotificationChannelAsync: state.setChannel,
  AndroidImportance: { DEFAULT: 3 },
}));
import { ensureMorningUpdateChannel } from '../../mobile/lib/notifications/android-channel';

beforeEach(() => { state.setChannel.mockReset(); state.os = 'ios'; });
describe('Morning Bank Update platform channel', () => {
  it('leaves the iOS registration path unchanged', async () => {
    await ensureMorningUpdateChannel();
    expect(state.setChannel).not.toHaveBeenCalled();
  });
  it('creates the default Android channel without requesting permission', async () => {
    state.os = 'android';
    await ensureMorningUpdateChannel();
    expect(state.setChannel).toHaveBeenCalledExactlyOnceWith('default', {
      name: 'Morning Bank Update', importance: 3,
    });
  });
});
