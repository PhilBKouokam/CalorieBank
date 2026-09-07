import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ os: 'ios', native: vi.fn(), open: vi.fn(), fallback: vi.fn() }));
vi.mock('expo', () => ({ requireOptionalNativeModule: mocks.native }));
vi.mock('react-native', () => ({ Platform: { get OS() { return mocks.os; } }, Linking: { openSettings: mocks.fallback } }));

import { openNotificationSettings } from '../../mobile/lib/notifications/open-notification-settings';

describe('notification settings recovery', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.os = 'ios';
    mocks.native.mockReturnValue({ openAsync: mocks.open });
    mocks.fallback.mockResolvedValue(undefined);
  });

  it('opens the notification-specific native destination without opening generic settings', async () => {
    mocks.open.mockResolvedValue(true);
    expect(await openNotificationSettings()).toBe(true);
    expect(mocks.native).toHaveBeenCalledWith('CalorieBankNotificationSettings');
    expect(mocks.fallback).not.toHaveBeenCalled();
  });

  it('falls back when the iOS version or destination is unsupported', async () => {
    mocks.open.mockResolvedValue(false);
    expect(await openNotificationSettings()).toBe(true);
    expect(mocks.fallback).toHaveBeenCalledOnce();
  });

  it('falls back in an older binary without the native helper', async () => {
    mocks.native.mockReturnValue(null);
    expect(await openNotificationSettings()).toBe(true);
    expect(mocks.fallback).toHaveBeenCalledOnce();
  });

  it('falls back if the native opener rejects', async () => {
    mocks.open.mockRejectedValue(new Error('unavailable'));
    expect(await openNotificationSettings()).toBe(true);
    expect(mocks.fallback).toHaveBeenCalledOnce();
  });

  it('keeps other platforms on their existing app settings path', async () => {
    mocks.os = 'android';
    expect(await openNotificationSettings()).toBe(true);
    expect(mocks.native).not.toHaveBeenCalled();
    expect(mocks.fallback).toHaveBeenCalledOnce();
  });

  it('returns a recoverable result rather than rejecting if both paths fail', async () => {
    mocks.open.mockResolvedValue(false);
    mocks.fallback.mockRejectedValue(new Error('unavailable'));
    expect(await openNotificationSettings()).toBe(false);
  });
});
