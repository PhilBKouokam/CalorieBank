import type { DailyIntakeAdjustment, DailyIntakeAggregate, Prisma, PrismaClient } from '@prisma/client';
import { adjustedIntakeCalories } from '@caloriebank/domain';
import { intakeAdjustmentMutationSchema, type IntakeAdjustmentMutation, type IntakeAdjustmentState } from '@caloriebank/schemas';
import { requireAdjustmentCapability } from '../../security/intake-capability';
import { AppError } from '../../errors';
import { lockIntakeAuthority, resolveIntakeAuthority, sameIntakeIdentity, type IntakeAuthorityIdentity } from '../provider-selection/intake-authority';
import { readProviderSelection } from '../provider-selection/provider-selection.repository';
import { manualAccountingEvidence } from '../manual-intake/manual-intake.repository';
import { getLocalDateForTimezone } from '../today/today.time';

export function activeAdjustment(row: DailyIntakeAdjustment | null, identity: IntakeAuthorityIdentity) {
  return row && row.mode !== 'none' && sameIntakeIdentity(row, identity) ? row : null;
}
export function adjustmentValue(row: DailyIntakeAdjustment | null): { mode: 'replace' | 'add'; calories: number } | null {
  return row?.mode === 'replace' || row?.mode === 'add' ? { mode: row.mode, calories: row.calories } : null;
}
/** A view of independent evidence; never writes a synthetic provider record. */
export function adjustAccountingRecord(base: DailyIntakeAggregate | null, row: DailyIntakeAdjustment | null): DailyIntakeAggregate | null {
  const adjustment = adjustmentValue(row);
  if (!adjustment || !row) return base;
  const calories = adjustedIntakeCalories(base?.totalCaloriesConsumed ?? null, adjustment);
  if (calories === null) return null;
  if (adjustment.mode === 'add' && base) return {
    ...base, totalCaloriesConsumed: calories,
    sourceDisplayName: `${base.writerDisplayName ?? base.sourceDisplayName ?? (base.provider === 'fatsecret' ? 'FatSecret' : 'Your estimate')} + ${row.calories.toLocaleString('en-US')} kcal added`,
    providerRecordId: `${base.providerRecordId}:adjustment:${row.revision}:${row.calories}`,
  };
  return {
    id: `adjustment:${row.revision}`, userId: row.userId, localDate: row.localDate, timezone: row.timezone,
    provider: 'manual_estimate', providerRecordId: `replacement:adjustment:${row.revision}:${row.calories}`,
    totalCaloriesConsumed: calories, writerBundleIdentifier: null, writerDisplayName: null,
    sourceId: '', sourceDisplayName: 'Your total for today', evidenceObservedAt: row.updatedAt,
    importedAt: row.updatedAt, providerUpdatedAt: null, syncStatus: 'ready', isCurrentDay: false,
    syncSessionId: null, createdAt: row.updatedAt, updatedAt: row.updatedAt,
  };
}

export async function readAdjustmentState(db: Prisma.TransactionClient, userId: string, now: Date) {
  const profile = await db.userProfile.findUnique({ where: { userId }, select: { timezone: true } });
  const timezone = profile?.timezone ?? 'UTC', localDate = getLocalDateForTimezone(timezone, now);
  const date = new Date(`${localDate}T00:00:00Z`), selection = await readProviderSelection(db, userId);
  const identity = await resolveIntakeAuthority(db, userId, date, selection);
  const [stored, manualState, storedSelection] = await Promise.all([
    db.dailyIntakeAdjustment.findUnique({ where: { userId_localDate: { userId, localDate: date } } }),
    db.manualIntakeState.findUnique({ where: { userId } }),
    db.providerSelection.findUnique({ where: { userId } }),
  ]);
  const base = identity.provider === 'manual_estimate' ? await manualAccountingEvidence(db, userId, date, timezone)
    : await db.dailyIntakeAggregate.findFirst({ where: {
      userId, localDate: date, timezone, provider: identity.provider,
      ...(identity.provider === 'apple_health' ? { writerBundleIdentifier: identity.writerId ?? '' } : {}),
      ...(identity.provider === 'health_connect' ? { sourceId: identity.sourceId ?? '' } : {}),
      syncStatus: { in: ['ready', 'stale', 'partial'] },
    }, orderBy: { updatedAt: 'desc' } });
  const row = activeAdjustment(stored, identity);
  const source = identity.provider === 'manual_estimate' ? 'Your estimate'
    : base?.writerDisplayName ?? base?.sourceDisplayName ?? (identity.provider === 'fatsecret' ? 'FatSecret' : 'Your tracker');
  const state: IntakeAdjustmentState = {
    localDate, revision: stored?.revision ?? 0, selectionRevision: storedSelection?.updatedAt.toISOString() ?? null,
    manualRevision: manualState?.revision ?? 0, source, baseCalories: base?.totalCaloriesConsumed ?? null,
    calories: adjustedIntakeCalories(base?.totalCaloriesConsumed ?? null, adjustmentValue(row)), adjustment: adjustmentValue(row),
  };
  return { state, identity, timezone, date, selection };
}

export class IntakeAdjustmentRepository {
  constructor(private readonly db: PrismaClient, private readonly now = () => new Date()) {}
  async read(userId: string) {
    return this.db.$transaction(async tx => (await readAdjustmentState(tx, userId, this.now())).state, { isolationLevel: 'RepeatableRead' });
  }
  async mutate(userId: string, raw: IntakeAdjustmentMutation) {
    requireAdjustmentCapability();
    const input = intakeAdjustmentMutationSchema.parse(raw);
    return this.db.$transaction(async tx => {
      await lockIntakeAuthority(tx, userId);
      const { state, identity, timezone, date, selection } = await readAdjustmentState(tx, userId, this.now());
      if (input.localDate !== state.localDate) throw new AppError('The day changed. Reopen the editor.', 409);
      if (!selection.intakeSelected || !['manual_estimate', 'apple_health', 'health_connect', 'fatsecret'].includes(identity.provider)) throw new AppError('Choose a calorie source first.', 409);
      if (input.selectionRevision !== state.selectionRevision || input.manualRevision !== state.manualRevision) throw new AppError('Your source or estimate changed. Reopen the editor.', 409);
      const later = await tx.dailyIntakeAdjustment.findFirst({ where: { userId, localDate: { gt: date } } });
      if (later) throw new AppError('This day has already ended.', 409);
      if (await tx.finalizedDailyBankRecord.findUnique({ where: { userId_logDate: { userId, logDate: date } } })) throw new AppError('This day has already been recorded.', 409);
      const same = input.mode === 'none' ? !state.adjustment : state.adjustment?.mode === input.mode && state.adjustment.calories === input.calories;
      if (state.revision !== input.expectedRevision) {
        if (state.revision === input.expectedRevision + 1 && same) return state;
        throw new AppError('Your adjustment changed. Reopen the editor.', 409);
      }
      if (input.mode === 'add' && state.baseCalories === null) throw new AppError('Wait for tracker calories, or replace today’s total.', 409);
      if (same) return state;
      const data = { mode: input.mode, calories: input.mode === 'none' ? 0 : input.calories, revision: state.revision + 1, ...identity, timezone, updatedAt: this.now() };
      await tx.dailyIntakeAdjustment.upsert({ where: { userId_localDate: { userId, localDate: date } }, create: { userId, localDate: date, ...data }, update: data });
      return (await readAdjustmentState(tx, userId, this.now())).state;
    });
  }
}
