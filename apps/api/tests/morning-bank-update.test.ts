import { describe, expect, it, vi } from 'vitest';

import {
  isMorningBankUpdateWindow,
  MorningBankUpdateService,
  morningBankUpdateCopy,
  type PushTransport,
} from '../src/modules/morning-bank-update/morning-bank-update.service';

const userId = '00000000-0000-4000-8000-000000000001';

function fixture(options: {
  now?: Date;
  enabled?: boolean;
  token?: boolean;
  completed?: boolean;
  contribution?: number;
  send?: Awaited<ReturnType<PushTransport['send']>>;
} = {}) {
  let delivery: Record<string, unknown> | null = null;
  let registration: Record<string, unknown> | null = options.token === false ? null : {
    userId, expoPushToken: 'ExpoPushToken[test-token]', platform: 'ios', active: true,
    lastRegisteredAt: new Date('2026-09-05T10:00:00.000Z'), invalidatedAt: null,
  };
  let preference = { userId, enabled: options.enabled ?? true };
  const updateDelivery = vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
    delivery = { ...delivery, ...data };
    return delivery;
  });
  type MutationArgs = { create: Record<string, unknown>; update: Record<string, unknown> };
  type WhereArgs = { where: Record<string, unknown> };
  const delegates = {
    morningBankUpdatePreference: {
      findUnique: vi.fn(async () => preference),
      upsert: vi.fn(async ({ create, update }: MutationArgs) => { preference = { ...preference, ...(preference ? update : create) }; return preference; }),
    },
    pushDeviceRegistration: {
      findUnique: vi.fn(async () => registration),
      deleteMany: vi.fn(async ({ where }: WhereArgs) => { if (!where.userId || where.userId === userId) registration = null; return { count: 1 }; }),
      upsert: vi.fn(async ({ create, update }: MutationArgs) => { registration = { ...(registration ? update : create), userId, lastRegisteredAt: options.now ?? new Date() }; return registration; }),
      update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => { registration = { ...registration, ...data }; return registration; }),
      updateMany: vi.fn(),
    },
    finalizedDailyBankRecord: { findUnique: vi.fn(async () => options.completed === false ? null : { effectiveDailyBankChange: options.contribution ?? 547 }) },
    morningBankUpdateDelivery: {
      findUnique: vi.fn(async () => delivery),
      upsert: vi.fn(async ({ create, update }: MutationArgs) => {
        delivery = delivery
          ? { ...delivery, ...update, attemptCount: typeof update.attemptCount === 'object' ? Number(delivery.attemptCount) + 1 : update.attemptCount ?? delivery.attemptCount }
          : { id: 'delivery-1', ...create };
        return delivery;
      }),
      update: updateDelivery,
      findMany: vi.fn(async () => []),
    },
  };
  const db = {
    ...delegates,
    $transaction: vi.fn(async (operation: unknown) => typeof operation === 'function'
      ? (operation as (transaction: typeof delegates) => Promise<unknown>)(delegates)
      : Promise.all(operation as Promise<unknown>[])),
  };
  const transport: PushTransport = {
    send: vi.fn(async () => options.send ?? { status: 'accepted' as const, ticketId: 'ticket-1' }),
    receipts: vi.fn(async () => new Map()),
  };
  const service = new MorningBankUpdateService(
    db as never,
    { getSummary: vi.fn(async () => ({ availableBankCalories: 2843 })) } as never,
    transport,
    () => options.now ?? new Date('2026-09-05T13:15:00.000Z'),
  );
  return { service, transport, db, getDelivery: () => delivery, getRegistration: () => registration };
}

describe('Morning Bank Update copy', () => {
  it('puts Available Bank first for positive contributions', () => {
    expect(morningBankUpdateCopy(2843, 547)).toEqual({
      title: 'Available Bank: 2,843 kcal', body: 'You banked 547 kcal yesterday.',
    });
  });

  it('uses enjoyed with an unsigned magnitude for negative contributions', () => {
    expect(morningBankUpdateCopy(188, -83)).toEqual({
      title: 'Available Bank: 188 kcal', body: 'You enjoyed 83 kcal yesterday.',
    });
  });

  it('uses neutral copy for zero contributions', () => {
    expect(morningBankUpdateCopy(2843, 0)).toEqual({
      title: 'Available Bank: 2,843 kcal', body: 'You were right on target yesterday.',
    });
  });
});

describe('Morning Bank Update eligibility and delivery', () => {
  it('uses the local 7:00 through 11:59 morning window across DST seasons', () => {
    expect(isMorningBankUpdateWindow('America/Chicago', new Date('2026-03-09T12:30:00.000Z'))).toBe(true);
    expect(isMorningBankUpdateWindow('America/Chicago', new Date('2026-11-02T13:30:00.000Z'))).toBe(true);
    expect(isMorningBankUpdateWindow('America/Chicago', new Date('2026-09-05T17:00:00.000Z'))).toBe(false);
  });

  it('does not send before completed accounting exists', async () => {
    const { service, transport } = fixture({ completed: false });
    expect(await service.deliverForUser(userId, 'America/Chicago')).toEqual({ status: 'not_eligible' });
    expect(transport.send).not.toHaveBeenCalled();
  });

  it('does not send outside the local morning window', async () => {
    const { service, transport } = fixture({ now: new Date('2026-09-05T17:00:00.000Z') });
    expect(await service.deliverForUser(userId, 'America/Chicago')).toEqual({ status: 'outside_window' });
    expect(transport.send).not.toHaveBeenCalled();
  });

  it('sends once and durably suppresses lifecycle retries', async () => {
    const { service, transport } = fixture();
    expect(await service.deliverForUser(userId, 'America/Chicago')).toEqual({ status: 'delivered' });
    expect(await service.deliverForUser(userId, 'America/Chicago')).toEqual({ status: 'already_handled' });
    expect(transport.send).toHaveBeenCalledOnce();
    expect(transport.send).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Available Bank: 2,843 kcal', body: 'You banked 547 kcal yesterday.',
    }));
  });

  it('does not replace delivered state when the device is later removed', async () => {
    const { service, transport, getDelivery } = fixture();
    await service.deliverForUser(userId, 'America/Chicago');
    await service.unregisterDevice(userId);
    expect(await service.deliverForUser(userId, 'America/Chicago')).toEqual({ status: 'already_handled' });
    expect(getDelivery()).toMatchObject({ status: 'DELIVERED' });
    expect(transport.send).toHaveBeenCalledOnce();
  });

  it('does not resubmit an attempt whose process outcome is indeterminate', async () => {
    const { service, transport, db } = fixture();
    await db.morningBankUpdateDelivery.upsert({
      create: { userId, completedLocalDate: new Date('2026-09-04T00:00:00.000Z'), status: 'ATTEMPTING', attemptCount: 1 },
      update: {},
    });
    expect(await service.deliverForUser(userId, 'America/Chicago')).toEqual({ status: 'already_handled' });
    expect(transport.send).not.toHaveBeenCalled();
  });

  it('records token absence without affecting accounting', async () => {
    const { service, transport, getDelivery } = fixture({ token: false });
    expect(await service.deliverForUser(userId, 'America/Chicago')).toEqual({ status: 'no_token' });
    expect(getDelivery()).toMatchObject({ status: 'NO_TOKEN' });
    expect(transport.send).not.toHaveBeenCalled();
  });

  it('preference off prevents delivery', async () => {
    const { service, transport } = fixture({ enabled: false });
    expect(await service.deliverForUser(userId, 'America/Chicago')).toEqual({ status: 'preference_off' });
    expect(transport.send).not.toHaveBeenCalled();
  });

  it('records retryable failure for a later hourly run', async () => {
    const { service, getDelivery } = fixture({ send: { status: 'retryable_failure', code: 'expo_http_503' } });
    expect(await service.deliverForUser(userId, 'America/Chicago')).toEqual({ status: 'retryable_failure' });
    expect(getDelivery()).toMatchObject({ status: 'RETRYABLE_FAILURE', attemptCount: 1, failureCode: 'expo_http_503' });
  });

  it('invalidates a permanently rejected token', async () => {
    const { service, getRegistration } = fixture({ send: { status: 'permanent_failure', code: 'DeviceNotRegistered' } });
    expect(await service.deliverForUser(userId, 'America/Chicago')).toEqual({ status: 'permanent_failure' });
    expect(getRegistration()).toMatchObject({ active: false });
  });

  it('moves the same physical token to the newly authenticated account', async () => {
    const { service, db } = fixture();
    await service.registerDevice('00000000-0000-4000-8000-000000000002', {
      expoPushToken: 'ExpoPushToken[test-token]', platform: 'ios',
    });
    expect(db.pushDeviceRegistration.deleteMany).toHaveBeenCalledWith({
      where: { expoPushToken: 'ExpoPushToken[test-token]', userId: { not: '00000000-0000-4000-8000-000000000002' } },
    });
  });
});
