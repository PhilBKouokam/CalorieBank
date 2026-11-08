import { adjustedIntakeCalories, getPreviousCompletedLocalDates } from '@caloriebank/domain';
import { intakeAdjustmentMutationSchema, type IntakeAdjustmentMutation, type IntakeAdjustmentState } from '@caloriebank/schemas';
import type { Prisma, PrismaClient } from '@prisma/client';
import { AppError } from '../../errors';
import { requireAdjustmentCapability } from '../../security/intake-capability';
import { PrismaBankHistoryRepository } from '../bank-history/bank-history.repository';
import { resolveDaySourceAuthority } from '../bank-history/day-source-authority';
import type { DevelopmentUser } from '../goal-configuration/goal-configuration.repository';
import { manualAccountingEvidence } from '../manual-intake/manual-intake.repository';
import { lockIntakeAuthority } from '../provider-selection/intake-authority';
import { getLocalDateForTimezone } from '../today/today.time';
import { activeAdjustment, adjustmentValue } from './intake-adjustment.repository';

function parseDate(value: string) {
  const date = new Date(`${value}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new AppError('Choose a valid completed day.', 400);
  }
  return date;
}

async function readHistoricalState(db: Prisma.TransactionClient, userId: string, localDate: string, now: Date) {
  const date = parseDate(localDate);
  const [opening, record, stored] = await Promise.all([
    db.openingBankCalculationDay.findUnique({ where: { userId_logDate: { userId, logDate: date } } }),
    db.finalizedDailyBankRecord.findUnique({ where: { userId_logDate: { userId, logDate: date } }, include: { calculationSnapshots: { orderBy: { version: 'desc' }, take: 1 } } }),
    db.dailyIntakeAdjustment.findUnique({ where: { userId_localDate: { userId, localDate: date } } }),
  ]);
  if (opening) throw new AppError('Your starting bank cannot be edited.', 409, { code: 'DAY_NO_LONGER_CHANGEABLE' });
  if (!record) throw new AppError('This day is not ready yet. Refresh your sources first.', 404, { code: 'BANK_DAY_NOT_FOUND' });
  if (record.status !== 'PROVISIONAL' || now >= record.lockAt || !getPreviousCompletedLocalDates(getLocalDateForTimezone(record.timezone, now), 2).includes(localDate)) {
    throw new AppError('Only the previous two days can be edited.', 409, { code: 'DAY_NO_LONGER_CHANGEABLE' });
  }
  const latest = record.calculationSnapshots[0];
  if (!latest) throw new AppError('This day is unavailable. Try again.', 409);
  const authority = await resolveDaySourceAuthority(db, userId, date, record.timezone);
  const identity = authority.intakeOverride ? {
    provider: authority.intakeOverride.provider,
    writerId: authority.intakeOverride.intakeWriterBundleIdentifier,
    sourceId: authority.intakeOverride.intakeSourceId,
  } : authority.intakeIdentity;
  if (!['manual_estimate', 'apple_health', 'health_connect', 'fatsecret'].includes(identity.provider)) {
    throw new AppError('This calorie source cannot be edited.', 409);
  }
  const base = identity.provider === 'manual_estimate' ? await manualAccountingEvidence(db, userId, date, record.timezone)
    : await db.dailyIntakeAggregate.findFirst({ where: {
      userId, localDate: date, timezone: record.timezone, provider: identity.provider,
      ...(identity.provider === 'apple_health' ? { writerBundleIdentifier: identity.writerId ?? '' } : {}),
      ...(identity.provider === 'health_connect' ? { sourceId: identity.sourceId ?? '' } : {}),
      syncStatus: { in: ['ready', 'stale', 'partial'] },
    }, orderBy: { updatedAt: 'desc' } });
  const adjustment = adjustmentValue(activeAdjustment(stored, identity));
  // Monotonic snapshot + override revisions also catch equal-calorie source changes.
  const state: IntakeAdjustmentState = {
    localDate, revision: stored?.revision ?? 0, selectionRevision: latest.createdAt.toISOString(), manualRevision: latest.version + (authority.intakeOverride?.revision ?? 0) + (authority.expenditureOverride?.revision ?? 0),
    source: identity.provider === 'manual_estimate' ? 'Your estimate' : base?.writerDisplayName ?? base?.sourceDisplayName ?? (identity.provider === 'fatsecret' ? 'FatSecret' : 'Your tracker'),
    baseCalories: base?.totalCaloriesConsumed ?? null,
    calories: adjustedIntakeCalories(base?.totalCaloriesConsumed ?? null, adjustment), adjustment,
  };
  return { state, identity, date, timezone: record.timezone };
}

export class HistoricalIntakeAdjustmentRepository {
  constructor(private readonly db: PrismaClient, private readonly bank: PrismaBankHistoryRepository, private readonly now = () => new Date()) {}
  async read(userId: string, localDate: string) {
    requireAdjustmentCapability();
    return this.db.$transaction(async tx => (await readHistoricalState(tx, userId, localDate, this.now())).state, { isolationLevel: 'RepeatableRead' });
  }
  async mutate(user: DevelopmentUser, localDate: string, raw: IntakeAdjustmentMutation) {
    requireAdjustmentCapability();
    const input = intakeAdjustmentMutationSchema.parse(raw);
    if (input.localDate !== localDate) throw new AppError('The selected day changed. Reopen the editor.', 409);
    return this.db.$transaction(async tx => {
      await lockIntakeAuthority(tx, user.id);
      const { state, identity, date, timezone } = await readHistoricalState(tx, user.id, localDate, this.now());
      const same = input.mode === 'none' ? !state.adjustment : state.adjustment?.mode === input.mode && state.adjustment.calories === input.calories;
      if (state.revision !== input.expectedRevision) {
        if (state.revision === input.expectedRevision + 1 && same) return state;
        throw new AppError('Your adjustment changed. Reopen the editor.', 409);
      }
      if (input.selectionRevision !== state.selectionRevision || input.manualRevision !== state.manualRevision) throw new AppError('This day changed. Reopen the editor.', 409);
      if (input.mode === 'add' && state.baseCalories === null) throw new AppError('Refresh your tracker, or replace the total.', 409);
      if (same) return state;
      const data = { mode: input.mode, calories: input.mode === 'none' ? 0 : input.calories, revision: state.revision + 1, ...identity, timezone, updatedAt: this.now() };
      await tx.dailyIntakeAdjustment.upsert({ where: { userId_localDate: { userId: user.id, localDate: date } }, create: { userId: user.id, localDate: date, ...data }, update: data });
      const result = await this.bank.reconcileStoredDayInTransaction(tx, user, localDate, timezone);
      if (!['corrected', 'unchanged'].includes(result.outcome)) throw new AppError('Couldn’t update your bank. Refresh and try again.', 409);
      return (await readHistoricalState(tx, user.id, localDate, this.now())).state;
    });
  }
}
