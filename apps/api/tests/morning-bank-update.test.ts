import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  isMorningBankUpdateWindow,
  ExpoPushTransport,
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
  availableBank?: number;
  transport?: PushTransport;
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
    user: { findUnique: vi.fn(async () => ({ deletionRequestedAt: null as Date | null })) },
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
  const transport: PushTransport = options.transport ?? {
    send: vi.fn(async () => options.send ?? { status: 'accepted' as const, ticketId: 'ticket-1' }),
    receipts: vi.fn(async () => new Map()),
  };
  const service = new MorningBankUpdateService(
    db as never,
    { getSummary: vi.fn(async () => ({ availableBankCalories: options.availableBank ?? 2843 })) } as never,
    transport,
    () => options.now ?? new Date('2026-09-05T13:15:00.000Z'),
  );
  return { service, transport, db, getDelivery: () => delivery, getRegistration: () => registration };
}

describe('Morning Bank Update copy', () => {
  it('keeps personal values inside the app', () => {
    expect(morningBankUpdateCopy()).toEqual({
      title: 'CalorieBank', body: 'Your daily banking summary is ready.',
    });
  });
});

describe('Morning Bank Update eligibility and delivery', () => {
  it('does not send while account deletion is pending', async () => {
    const { service, transport, db } = fixture();
    db.user.findUnique.mockResolvedValue({ deletionRequestedAt: new Date() });
    expect(await service.deliverForUser(userId, 'America/Chicago')).toEqual({ status: 'not_eligible' });
    expect(transport.send).not.toHaveBeenCalled();
  });
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
    expect(transport.send).toHaveBeenCalledWith({ token: 'ExpoPushToken[test-token]' });
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

describe('remote notification privacy boundary', () => {
  afterEach(() => vi.restoreAllMocks());

  function expo() {
    const fetchImpl = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({
      data: { status: 'ok', id: 'ticket-1' },
    }), { status: 200 }));
    // Vitest keeps one overload from the combined Node/DOM/native fetch types;
    // this test boundary only handles the transport's string URL + RequestInit.
    return { fetchImpl, transport: new ExpoPushTransport({ fetchImpl: fetchImpl as typeof fetch }) };
  }

  it.each([
    { availableBank: 2843, contribution: 547 },
    { availableBank: 188, contribution: -83 },
    { availableBank: 0, contribution: -2468 },
    { availableBank: 2843, contribution: 0 },
    { availableBank: 987654, contribution: 12345 },
  ])('sends the same generic envelope for $availableBank / $contribution', async (values) => {
    const { transport, fetchImpl } = expo();
    const logs = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const { service, getDelivery } = fixture({ ...values, transport });
    expect(await service.deliverForUser(userId, 'America/Chicago')).toEqual({ status: 'delivered' });
    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(fetchImpl.mock.calls[0]?.[0]).toBe('https://exp.host/--/api/v2/push/send');
    expect(JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body))).toEqual({
      to: 'ExpoPushToken[test-token]', title: 'CalorieBank',
      body: 'Your daily banking summary is ready.',
      data: { route: '/today', category: 'morning_bank_update' }, sound: 'default',
    });
    expect(getDelivery()).toMatchObject({ status: 'DELIVERED', attemptCount: 1 });
    for (const [line] of logs.mock.calls) {
      const event = JSON.parse(String(line)) as Record<string, unknown>;
      expect(Object.keys(event).every(key => ['level', 'event', 'attempt'].includes(key))).toBe(true);
    }
  });

  it('discards extra caller text, health metadata and deep-link query strings at the external boundary', async () => {
    const { transport, fetchImpl } = expo();
    const extraFields = {
      token: 'ExpoPushToken[test-token]', title: 'Private 8765 kcal', body: 'Recovery 4321',
      data: { route: '/today?bank=8765', completedLocalDate: '2026-09-04', provider: 'private-source', userId },
      analytics: { calorieIntake: 5678 },
    };
    await transport.send(extraFields);
    const body = String(fetchImpl.mock.calls[0]?.[1]?.body);
    for (const privateValue of ['8765', '4321', '5678', '2026-09-04', 'private-source', userId, '?bank', 'analytics']) {
      expect(body).not.toContain(privateValue);
    }
  });

  it.each(['DeviceNotRegistered', 'MessageTooBig', 'MessageRateExceeded', 'MismatchSenderId', 'InvalidCredentials'])(
    'preserves the documented operational category %s without forwarding error messages', async (code) => {
      const fetchImpl = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({
        data: { status: 'error', message: 'Private 8765 kcal ExpoPushToken[private]', details: { error: code } },
      }), { status: 200 }));
      expect(await new ExpoPushTransport({ fetchImpl: fetchImpl as typeof fetch }).send({ token: 'ExpoPushToken[test-token]' }))
        .toEqual({ status: code === 'DeviceNotRegistered' ? 'permanent_failure' : 'retryable_failure', code });
    },
  );

  it('reduces unknown send/receipt error content to fixed categories before persistence and logging', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async (url) => new Response(JSON.stringify({
      data: String(url).endsWith('getReceipts')
        ? { 'ticket-1': { status: 'error', details: { error: 'Private 8765 kcal ExpoPushToken[private]' } } }
        : { status: 'error', details: { error: 'Private 8765 kcal ExpoPushToken[private]' } },
    }), { status: 200 }));
    const transport = new ExpoPushTransport({ fetchImpl: fetchImpl as typeof fetch });
    const logs = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { service, getDelivery } = fixture({ transport });
    expect(await service.deliverForUser(userId, 'America/Chicago')).toEqual({ status: 'retryable_failure' });
    expect(getDelivery()).toMatchObject({ failureCode: 'expo_ticket_rejected' });
    expect(await transport.receipts(['ticket-1'])).toEqual(new Map([
      ['ticket-1', { status: 'retryable_failure', code: 'expo_receipt_failure' }],
    ]));
    expect(JSON.stringify(logs.mock.calls)).not.toMatch(/8765|ExpoPushToken|completedLocalDate|accountReference/);
  });
});
