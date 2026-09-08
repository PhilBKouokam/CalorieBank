import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi, beforeEach, beforeAll } from 'vitest';
import { preferDirectFoodSources } from '../../mobile/lib/healthkit/apple-health-intake-writers';
import { openingPreparationSourceKey } from '../src/modules/bank-history/opening-bank-import';

const mocks = vi.hoisted(() => ({ bank: vi.fn(), lifecycle: vi.fn() }));
vi.mock('../../mobile/lib/api/client', () => ({ fetchBankSummary: mocks.bank, runForegroundLifecycle: mocks.lifecycle }));
vi.mock('../../mobile/lib/healthkit/healthkit-connection', () => ({ getAppleHealthConnectionStatus: async () => 'unavailable', syncAppleHealthToday: vi.fn() }));
type Lifecycle = {
  resetAccountLifecycle(scope: string): void;
  retryIncompleteOpeningAfterSourceChange(): Promise<void>;
};
let resetAccountLifecycle: Lifecycle['resetAccountLifecycle'];
let retryIncompleteOpeningAfterSourceChange: Lifecycle['retryIncompleteOpeningAfterSourceChange'];
beforeAll(async () => {
  ({ resetAccountLifecycle, retryIncompleteOpeningAfterSourceChange } = await import(resolve('../mobile/lib/lifecycle/account-lifecycle.ts')) as Lifecycle);
});

describe('source-choice polish', () => {
  const writers = [{ bundleIdentifier: 'com.fatsecret.caloriecounter', displayName: 'FatSecret' }, { bundleIdentifier: 'CRONOMETER-GOLD', displayName: 'Cronometer' }, { bundleIdentifier: 'unrelated.bundle', displayName: 'FatSecret' }];
  it('prefers a healthy direct FatSecret connection only over its exact known Apple Health identity', () => {
    expect(preferDirectFoodSources(writers, [{ provider: 'fatsecret', status: 'connected' }])).toEqual(writers.slice(1));
    expect(writers).toHaveLength(3);
  });
  it.each([{ connections: [] }, { connections: [{ provider: 'fatsecret', status: 'needs_reconnect' }] }, { connections: [{ provider: 'google_health_fitbit', status: 'connected' }] }])('retains all writers without healthy direct FatSecret: %j', ({ connections }) => {
    expect(preferDirectFoodSources(writers, connections)).toEqual(writers);
  });
  it('uses provider and exact active writer identity, never labels or inactive writer identity', () => {
    const direct = { authoritativeExpenditureProvider: 'apple_health', authoritativeIntakeProvider: 'fatsecret', appleHealthIntakeWriterBundleId: null };
    expect(openingPreparationSourceKey(direct)).toBe(openingPreparationSourceKey({ ...direct, appleHealthIntakeWriterBundleId: 'inactive.writer' }));
    expect(openingPreparationSourceKey(direct)).not.toBe(openingPreparationSourceKey({ ...direct, authoritativeExpenditureProvider: 'google_health_fitbit' }));
    const apple = { ...direct, authoritativeIntakeProvider: 'apple_health', appleHealthIntakeWriterBundleId: 'one' };
    expect(openingPreparationSourceKey(apple)).not.toBe(openingPreparationSourceKey({ ...apple, appleHealthIntakeWriterBundleId: 'two' }));
  });
  it('uses plain burn no-data copy and says setup may continue', () => {
    const source = readFileSync('../mobile/app/(onboarding)/onboarding.tsx', 'utf8');
    expect(source).toContain('Apple Health doesn’t have your total calories burned for the last few days yet. You can still finish setting up CalorieBank.');
    expect(source).not.toContain('complete calorie-burn total');
  });
});

describe('automatic incomplete-opening foreground retry', () => {
  let scope = 0;
  beforeEach(() => { vi.clearAllMocks(); resetAccountLifecycle(`account-${scope++}`); mocks.lifecycle.mockResolvedValue({ shouldSyncHealthKit: false, errors: [], historyDayCount: 8 }); });
  it('automatically invokes normal lifecycle for an incomplete bank after source selection', async () => {
    mocks.bank.mockResolvedValue({ openingBankStatus: 'waiting_for_opening_data' });
    await retryIncompleteOpeningAfterSourceChange();
    expect(mocks.lifecycle).toHaveBeenCalledWith(expect.any(String), 'manual_refresh');
  });
  it('does not reopen an initialized bank', async () => {
    mocks.bank.mockResolvedValue({ openingBankStatus: 'initialized' });
    await retryIncompleteOpeningAfterSourceChange();
    expect(mocks.lifecycle).not.toHaveBeenCalled();
  });
  it('does not transfer an old account response into another account', async () => {
    let finish!: (value: unknown) => void;
    mocks.bank.mockReturnValue(new Promise(resolve => { finish = resolve; }));
    const pending = retryIncompleteOpeningAfterSourceChange();
    resetAccountLifecycle('different-account');
    finish({ openingBankStatus: 'waiting_for_opening_data' });
    await pending;
    expect(mocks.lifecycle).not.toHaveBeenCalled();
  });
  it('leaves a failed read retryable without undoing the acknowledged selection', async () => {
    mocks.bank.mockRejectedValueOnce(new Error('temporary'));
    await expect(retryIncompleteOpeningAfterSourceChange()).resolves.toBeUndefined();
    mocks.bank.mockResolvedValue({ openingBankStatus: 'waiting_for_opening_data' });
    await retryIncompleteOpeningAfterSourceChange();
    expect(mocks.lifecycle).toHaveBeenCalledOnce();
  });
});
