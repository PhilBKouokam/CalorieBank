import type { DailyIntakeAggregate, Prisma, PrismaClient } from '@prisma/client';
import { manualIntakeMutationSchema, type ManualIntakeMutation, type AuthoritativeEaten } from '@caloriebank/schemas';
import { AppError } from '../../errors';
import { requireIntakeCapability } from '../../security/intake-capability';
import { lockIntakeAuthority, resolveIntakeAuthority, transitionIntakeAuthority } from '../provider-selection/intake-authority';
import { getLocalDateForTimezone } from '../today/today.time';

/** A preference is evidence only for dates from its explicit boundary onward. */
export async function resolveManualIntake(db: Prisma.TransactionClient, userId: string, localDate: Date) {
  const [usual, override] = await Promise.all([
    db.manualEstimateBoundary.findFirst({ where: { userId, effectiveFrom: { lte: localDate } }, orderBy: { effectiveFrom: 'desc' } }),
    db.manualIntakeOverride.findUnique({ where: { userId_localDate: { userId, localDate } } }),
  ]);
  if (!usual) return null;
  const evidence = override ?? usual;
  const value: AuthoritativeEaten = {
    localDate: localDate.toISOString().slice(0, 10), calories: evidence.calories,
    source: 'manual_estimate', semanticKind: 'estimated_total_day_intake',
    evidenceVersion: `manual:${override ? 'override' : 'usual'}:${evidence.revision}`,
    updatedAt: evidence.updatedAt.toISOString(),
  };
  return { value, usualCalories: usual.calories, overridden: Boolean(override) };
}

/** Adapter into the existing accounting input shape; never persisted as a provider aggregate. */
export async function manualAccountingEvidence(db: Prisma.TransactionClient, userId: string, localDate: Date, timezone: string): Promise<DailyIntakeAggregate | null> {
  const resolved = await resolveManualIntake(db, userId, localDate);
  if (!resolved) return null;
  const updatedAt = new Date(resolved.value.updatedAt);
  return {
    id: resolved.value.evidenceVersion, userId, localDate, timezone,
    provider: 'manual_estimate', providerRecordId: `${resolved.value.localDate}:${resolved.value.evidenceVersion}`,
    totalCaloriesConsumed: resolved.value.calories,
    writerBundleIdentifier: null, writerDisplayName: null, sourceId: '', sourceDisplayName: 'CalorieBank estimate',
    evidenceObservedAt: updatedAt, importedAt: updatedAt, providerUpdatedAt: null,
    syncStatus: 'ready', isCurrentDay: false, syncSessionId: null, createdAt: updatedAt, updatedAt,
  };
}

export class ManualIntakeRepository {
  constructor(private readonly db: PrismaClient, private readonly selectionEnabled = false, private readonly now = () => new Date()) {}

  async mutate(userId: string, raw: ManualIntakeMutation) {
    requireIntakeCapability('manual_estimate');
    const parsed = manualIntakeMutationSchema.safeParse(raw);
    if (!parsed.success) throw new AppError('Enter a valid whole-calorie amount.', 400, { code: 'INVALID_MANUAL_INTAKE' });
    const input = parsed.data;
    return this.db.$transaction(async (tx) => {
      await lockIntakeAuthority(tx, userId);
      const [profile, selection, state] = await Promise.all([
        tx.userProfile.findUnique({ where: { userId }, select: { timezone: true } }),
        tx.providerSelection.findUnique({ where: { userId } }),
        tx.manualIntakeState.findUnique({ where: { userId } }),
      ]);
      const now = this.now(), timezone = profile?.timezone ?? 'UTC';
      const today = getLocalDateForTimezone(timezone, now), date = new Date(`${today}T00:00:00Z`);
      if (input.operation !== 'select' && input.localDate !== today) {
        throw new AppError('The day changed. Refresh and try again.', 409, { code: 'MANUAL_DATE_CHANGED' });
      }
      const [posted, latest] = await Promise.all([
        tx.finalizedDailyBankRecord.findUnique({ where: { userId_logDate: { userId, logDate: date } }, select: { id: true } }),
        tx.manualEstimateBoundary.findFirst({ where: { userId }, orderBy: { effectiveFrom: 'desc' } }),
      ]);
      if (posted || (latest && latest.effectiveFrom > date)) {
        throw new AppError('This day has already been recorded.', 409, { code: 'MANUAL_DATE_CLOSED' });
      }
      const current = await resolveManualIntake(tx, userId, date);
      const revision = state?.revision ?? 0;
      const sameValue = input.operation === 'reset' ? current && !current.overridden
        : input.operation === 'today' ? current?.overridden && current.value.calories === input.calories
        : current?.usualCalories === input.calories;
      // Retry of one acknowledged-or-lost response converges without a second write.
      // A later intervening mutation always conflicts, even if its number matches.
      if (revision !== input.expectedRevision) {
        if (revision === input.expectedRevision + 1 && sameValue && selection?.authoritativeIntakeProvider === 'manual_estimate') {
          return { revision, ...current };
        }
        throw new AppError('Your estimate changed. Refresh and try again.', 409, { code: 'MANUAL_REVISION_CONFLICT' });
      }
      if (input.operation === 'select') {
        if (!this.selectionEnabled && selection?.authoritativeIntakeProvider !== 'manual_estimate') {
          throw new AppError('This option is not available yet.', 409, { code: 'MANUAL_SELECTION_DISABLED' });
        }
        if ((selection?.updatedAt.toISOString() ?? null) !== input.selectionRevision) {
          throw new AppError('Your source changed. Refresh and try again.', 409, { code: 'MANUAL_SELECTION_CHANGED' });
        }
        await transitionIntakeAuthority(tx, userId, selection, { provider: 'manual_estimate', writerId: null, sourceId: null }, now);
      } else {
        if (!selection || (await resolveIntakeAuthority(tx, userId, date, selection)).provider !== 'manual_estimate') {
          throw new AppError('Change your calorie source before editing an estimate.', 409, { code: 'MANUAL_NOT_AUTHORITATIVE' });
        }
      }
      if (sameValue && selection?.authoritativeIntakeProvider === 'manual_estimate') return { revision, ...current };
      const nextRevision = revision + 1;
      if (input.operation === 'select' || input.operation === 'usual') {
        await tx.manualEstimateBoundary.upsert({
          where: { userId_effectiveFrom: { userId, effectiveFrom: date } },
          create: { userId, effectiveFrom: date, calories: input.calories, revision: nextRevision, timezone, updatedAt: now },
          update: { calories: input.calories, revision: nextRevision, timezone, updatedAt: now },
        });
      } else if (input.operation === 'today') {
        await tx.manualIntakeOverride.upsert({
          where: { userId_localDate: { userId, localDate: date } },
          create: { userId, localDate: date, calories: input.calories, revision: nextRevision, timezone, updatedAt: now },
          update: { calories: input.calories, revision: nextRevision, timezone, updatedAt: now },
        });
      } else {
        await tx.manualIntakeOverride.deleteMany({ where: { userId, localDate: date } });
      }
      if (input.operation === 'select') {
        await tx.providerSelection.upsert({
          where: { userId },
          create: { userId, intakeSelected: true, authoritativeIntakeProvider: 'manual_estimate', selectedAt: now },
          update: { intakeSelected: true, authoritativeIntakeProvider: 'manual_estimate', selectedAt: now, updatedAt: now },
        });
      }
      await tx.manualIntakeState.upsert({ where: { userId }, create: { userId, revision: nextRevision, updatedAt: now }, update: { revision: nextRevision, updatedAt: now } });
      return { revision: nextRevision, ...await resolveManualIntake(tx, userId, date) };
    });
  }
}
