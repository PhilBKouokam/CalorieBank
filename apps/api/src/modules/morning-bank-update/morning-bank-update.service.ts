import { createHash } from 'node:crypto';
import { Prisma, type PrismaClient } from '@prisma/client';

import type { BankHistoryRepository } from '../bank-history/bank-history.repository';
import { structuredLog } from '../../logger';
import { getLocalDateForTimezone } from '../today/today.time';

const MORNING_START_HOUR = 7;
const MORNING_END_HOUR = 12;
const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 60 * 60 * 1000;
const RECEIPT_DELAY_MS = 15 * 60 * 1000;

function shiftDate(localDate: string, days: number) {
  const date = new Date(`${localDate}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function parseLocalDate(localDate: string) {
  return new Date(`${localDate}T00:00:00.000Z`);
}

function safeAccountReference(userId: string) {
  return createHash('sha256').update(userId).digest('hex').slice(0, 12);
}

export function localHour(timezone: string, now: Date) {
  const part = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now).find((item) => item.type === 'hour')?.value;
  return Number(part);
}

export function isMorningBankUpdateWindow(timezone: string, now: Date) {
  const hour = localHour(timezone, now);
  return Number.isInteger(hour) && hour >= MORNING_START_HOUR && hour < MORNING_END_HOUR;
}

export function morningBankUpdateCopy(availableBankCalories: number, contributionCalories: number) {
  const title = `Available Bank: ${availableBankCalories.toLocaleString('en-US')} kcal`;
  const magnitude = Math.abs(contributionCalories).toLocaleString('en-US');
  const body = contributionCalories > 0
    ? `You banked ${magnitude} kcal yesterday.`
    : contributionCalories < 0
      ? `You enjoyed ${magnitude} kcal yesterday.`
      : 'You were right on target yesterday.';
  return { title, body };
}

type PushResult =
  | { status: 'accepted'; ticketId: string }
  | { status: 'permanent_failure'; code: string }
  | { status: 'retryable_failure'; code: string };

type ReceiptResult = { status: 'ok' | 'retryable_failure' | 'permanent_failure'; code?: string };

export interface PushTransport {
  send(input: { token: string; title: string; body: string; data: Record<string, string> }): Promise<PushResult>;
  receipts(ticketIds: string[]): Promise<Map<string, ReceiptResult>>;
}

type ExpoPushTransportOptions = { accessToken?: string; fetchImpl?: typeof fetch };

export class ExpoPushTransport implements PushTransport {
  private readonly fetchImpl: typeof fetch;
  constructor(private readonly options: ExpoPushTransportOptions = {}) {
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  private headers() {
    return {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(this.options.accessToken ? { Authorization: `Bearer ${this.options.accessToken}` } : {}),
    };
  }

  async send(input: { token: string; title: string; body: string; data: Record<string, string> }): Promise<PushResult> {
    try {
      const response = await this.fetchImpl('https://exp.host/--/api/v2/push/send', {
        method: 'POST', headers: this.headers(),
        body: JSON.stringify({ to: input.token, title: input.title, body: input.body, data: input.data, sound: 'default' }),
      });
      if (response.status === 429 || response.status >= 500) return { status: 'retryable_failure', code: `expo_http_${response.status}` };
      if (!response.ok) return { status: 'permanent_failure', code: `expo_http_${response.status}` };
      const payload = await response.json() as { data?: { status?: string; id?: string; details?: { error?: string } } };
      if (payload.data?.status === 'ok' && payload.data.id) return { status: 'accepted', ticketId: payload.data.id };
      const code = payload.data?.details?.error ?? 'expo_ticket_rejected';
      return code === 'DeviceNotRegistered'
        ? { status: 'permanent_failure', code }
        : { status: 'retryable_failure', code };
    } catch {
      return { status: 'retryable_failure', code: 'expo_network_failure' };
    }
  }

  async receipts(ticketIds: string[]) {
    const results = new Map<string, ReceiptResult>();
    if (ticketIds.length === 0) return results;
    try {
      const response = await this.fetchImpl('https://exp.host/--/api/v2/push/getReceipts', {
        method: 'POST', headers: this.headers(), body: JSON.stringify({ ids: ticketIds }),
      });
      if (!response.ok) return results;
      const payload = await response.json() as { data?: Record<string, { status?: string; details?: { error?: string } }> };
      for (const ticketId of ticketIds) {
        const receipt = payload.data?.[ticketId];
        if (!receipt) continue;
        if (receipt.status === 'ok') results.set(ticketId, { status: 'ok' });
        else {
          const code = receipt.details?.error ?? 'expo_receipt_failure';
          results.set(ticketId, {
            status: code === 'DeviceNotRegistered' ? 'permanent_failure' : 'retryable_failure', code,
          });
        }
      }
    } catch {
      // A later hourly run can check missing receipts while Expo retains them.
    }
    return results;
  }
}

export class MorningBankUpdateService {
  constructor(
    private readonly db: PrismaClient,
    private readonly bankHistory: BankHistoryRepository,
    private readonly transport: PushTransport,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async settings(userId: string) {
    const [preference, device] = await Promise.all([
      this.db.morningBankUpdatePreference.findUnique({ where: { userId } }),
      this.db.pushDeviceRegistration.findUnique({ where: { userId } }),
    ]);
    return {
      enabled: preference?.enabled ?? false,
      deviceRegistered: Boolean(device),
      deviceActive: device?.active ?? false,
      lastRegisteredAt: device?.lastRegisteredAt.toISOString() ?? null,
    };
  }

  async setPreference(userId: string, enabled: boolean) {
    await this.db.morningBankUpdatePreference.upsert({
      where: { userId }, create: { userId, enabled }, update: { enabled },
    });
    return this.settings(userId);
  }

  async registerDevice(userId: string, input: { expoPushToken: string; platform: string }) {
    const now = this.now();
    await this.db.$transaction(async (transaction) => {
      await transaction.pushDeviceRegistration.deleteMany({
        where: { expoPushToken: input.expoPushToken, userId: { not: userId } },
      });
      await transaction.pushDeviceRegistration.upsert({
        where: { userId },
        create: { userId, expoPushToken: input.expoPushToken, platform: input.platform, active: true, lastRegisteredAt: now },
        update: { expoPushToken: input.expoPushToken, platform: input.platform, active: true, invalidatedAt: null, lastRegisteredAt: now },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return this.settings(userId);
  }

  async unregisterDevice(userId: string) {
    await this.db.pushDeviceRegistration.deleteMany({ where: { userId } });
  }

  private async recordNoToken(userId: string, localDate: string) {
    await this.db.morningBankUpdateDelivery.upsert({
      where: { userId_completedLocalDate: { userId, completedLocalDate: parseLocalDate(localDate) } },
      create: { userId, completedLocalDate: parseLocalDate(localDate), status: 'NO_TOKEN' },
      update: { status: 'NO_TOKEN', failureCode: 'no_active_token' },
    });
  }

  private async claim(userId: string, localDate: string) {
    const now = this.now();
    try {
      return await this.db.$transaction(async (transaction) => {
        const date = parseLocalDate(localDate);
        const existing = await transaction.morningBankUpdateDelivery.findUnique({
          where: { userId_completedLocalDate: { userId, completedLocalDate: date } },
        });
        if (existing?.status === 'DELIVERED' || existing?.status === 'PERMANENT_FAILURE' || existing?.status === 'ATTEMPTING') return null;
        if (existing && existing.attemptCount >= MAX_ATTEMPTS) return null;
        if (existing?.nextRetryAt && existing.nextRetryAt > now) return null;
        return transaction.morningBankUpdateDelivery.upsert({
          where: { userId_completedLocalDate: { userId, completedLocalDate: date } },
          create: { userId, completedLocalDate: date, status: 'ATTEMPTING', attemptCount: 1, lastAttemptAt: now },
          update: { status: 'ATTEMPTING', attemptCount: { increment: 1 }, lastAttemptAt: now, nextRetryAt: null, failureCode: null },
        });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && ['P2002', 'P2034'].includes(error.code)) return null;
      throw error;
    }
  }

  async deliverForUser(userId: string, timezone: string) {
    const now = this.now();
    const accountReference = safeAccountReference(userId);
    if (!isMorningBankUpdateWindow(timezone, now)) {
      structuredLog('info', 'morning_bank_update_skipped', { accountReference, reason: 'outside_morning_window' });
      return { status: 'outside_window' as const };
    }
    const currentLocalDate = getLocalDateForTimezone(timezone, now);
    const completedLocalDate = shiftDate(currentLocalDate, -1);
    const [preference, device, completedDay, existingDelivery] = await Promise.all([
      this.db.morningBankUpdatePreference.findUnique({ where: { userId } }),
      this.db.pushDeviceRegistration.findUnique({ where: { userId } }),
      this.db.finalizedDailyBankRecord.findUnique({
        where: { userId_logDate: { userId, logDate: parseLocalDate(completedLocalDate) } },
        select: { effectiveDailyBankChange: true },
      }),
      this.db.morningBankUpdateDelivery.findUnique({
        where: { userId_completedLocalDate: { userId, completedLocalDate: parseLocalDate(completedLocalDate) } },
        select: { status: true },
      }),
    ]);
    if (!preference?.enabled) {
      structuredLog('info', 'morning_bank_update_skipped', { accountReference, completedLocalDate, reason: 'preference_off' });
      return { status: 'preference_off' as const };
    }
    if (!completedDay) {
      structuredLog('info', 'morning_bank_update_skipped', { accountReference, completedLocalDate, reason: 'completed_accounting_unavailable' });
      return { status: 'not_eligible' as const };
    }
    if (existingDelivery?.status === 'DELIVERED' || existingDelivery?.status === 'PERMANENT_FAILURE' || existingDelivery?.status === 'ATTEMPTING') {
      return { status: 'already_handled' as const };
    }
    structuredLog('info', 'morning_bank_update_eligible', { accountReference, completedLocalDate });
    if (!device?.active) {
      await this.recordNoToken(userId, completedLocalDate);
      structuredLog('info', 'morning_bank_update_skipped', { accountReference, completedLocalDate, reason: 'no_active_token' });
      return { status: 'no_token' as const };
    }
    const delivery = await this.claim(userId, completedLocalDate);
    if (!delivery) return { status: 'already_handled' as const };
    const summary = await this.bankHistory.getSummary(userId);
    const copy = morningBankUpdateCopy(summary.availableBankCalories, completedDay.effectiveDailyBankChange);
    structuredLog('info', 'morning_bank_update_delivery_started', { accountReference, completedLocalDate, attempt: delivery.attemptCount });
    const result = await this.transport.send({
      token: device.expoPushToken,
      ...copy,
      data: { route: '/today', completedLocalDate, category: 'morning_bank_update' },
    });
    if (result.status === 'accepted') {
      await this.db.morningBankUpdateDelivery.update({
        where: { id: delivery.id },
        data: { status: 'DELIVERED', deliveredAt: now, expoTicketId: result.ticketId, failureCode: null },
      });
      structuredLog('info', 'morning_bank_update_delivered', { accountReference, completedLocalDate });
      return { status: 'delivered' as const };
    }
    if (result.status === 'permanent_failure') {
      await this.db.$transaction([
        this.db.morningBankUpdateDelivery.update({ where: { id: delivery.id }, data: { status: 'PERMANENT_FAILURE', failureCode: result.code } }),
        this.db.pushDeviceRegistration.update({ where: { userId }, data: { active: false, invalidatedAt: now } }),
      ]);
      structuredLog('warn', 'morning_bank_update_token_invalidated', { accountReference, completedLocalDate, failureCategory: result.code });
      return { status: 'permanent_failure' as const };
    }
    await this.db.morningBankUpdateDelivery.update({
      where: { id: delivery.id },
      data: { status: 'RETRYABLE_FAILURE', nextRetryAt: new Date(now.getTime() + RETRY_DELAY_MS), failureCode: result.code },
    });
    structuredLog('warn', delivery.attemptCount < MAX_ATTEMPTS ? 'morning_bank_update_retry_scheduled' : 'morning_bank_update_failed', {
      accountReference, completedLocalDate, failureCategory: result.code, attempt: delivery.attemptCount,
    });
    return { status: 'retryable_failure' as const };
  }

  async reconcileReceipts() {
    const cutoff = new Date(this.now().getTime() - RECEIPT_DELAY_MS);
    const deliveries = await this.db.morningBankUpdateDelivery.findMany({
      where: { status: 'DELIVERED', expoTicketId: { not: null }, receiptCheckedAt: null, deliveredAt: { lte: cutoff } },
      select: { id: true, userId: true, expoTicketId: true }, take: 100,
    });
    const receipts = await this.transport.receipts(deliveries.flatMap((item) => item.expoTicketId ? [item.expoTicketId] : []));
    for (const delivery of deliveries) {
      if (!delivery.expoTicketId) continue;
      const receipt = receipts.get(delivery.expoTicketId);
      if (!receipt) continue;
      await this.db.morningBankUpdateDelivery.update({ where: { id: delivery.id }, data: { receiptCheckedAt: this.now(), failureCode: receipt.code ?? null } });
      if (receipt.status === 'permanent_failure') {
        await this.db.pushDeviceRegistration.updateMany({ where: { userId: delivery.userId }, data: { active: false, invalidatedAt: this.now() } });
        structuredLog('warn', 'morning_bank_update_token_invalidated', {
          accountReference: safeAccountReference(delivery.userId), failureCategory: receipt.code ?? 'receipt_permanent_failure',
        });
      }
    }
  }
}
