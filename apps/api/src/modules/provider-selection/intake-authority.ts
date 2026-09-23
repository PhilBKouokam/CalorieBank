import type { Prisma } from '@prisma/client';
import { AppError } from '../../errors';
import { requireIntakeCapability } from '../../security/intake-capability';
import { getLocalDateForTimezone } from '../today/today.time';

export type IntakeAuthorityIdentity = {
  provider: string;
  writerId: string | null;
  sourceId: string | null;
};

type Selection = {
  authoritativeIntakeProvider: string;
  appleHealthIntakeWriterBundleId: string | null;
  nativeIntakeSourceId: string | null;
};

export function selectionIdentity(selection: Selection): IntakeAuthorityIdentity {
  return {
    provider: selection.authoritativeIntakeProvider,
    writerId: selection.authoritativeIntakeProvider === 'apple_health' ? selection.appleHealthIntakeWriterBundleId : null,
    sourceId: selection.authoritativeIntakeProvider === 'health_connect' ? selection.nativeIntakeSourceId : null,
  };
}

export function sameIntakeIdentity(a: IntakeAuthorityIdentity, b: IntakeAuthorityIdentity) {
  return a.provider === b.provider && a.writerId === b.writerId && a.sourceId === b.sourceId;
}

export async function lockIntakeAuthority(db: Prisma.TransactionClient, userId: string) {
  // Same lock and order as Opening Bank / source projection writes.
  await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}), hashtext('opening-bank'))`;
}

export async function resolveIntakeAuthority(
  db: Prisma.TransactionClient, userId: string, localDate: Date, legacy: Selection,
): Promise<IntakeAuthorityIdentity> {
  const boundary = await db.intakeAuthorityBoundary.findFirst({
    where: { userId, OR: [{ effectiveFrom: { lte: localDate } }, { effectiveFrom: null }] },
    orderBy: { effectiveFrom: { sort: 'desc', nulls: 'last' } },
  });
  // A migration baseline remains a legacy bridge until the first dated transition.
  const dated = boundary?.effectiveFrom ?? await db.intakeAuthorityBoundary.findFirst({
    where: { userId, effectiveFrom: { not: null } }, select: { id: true },
  });
  return dated ? boundary ?? selectionIdentity(legacy) : selectionIdentity(legacy);
}

/** Called inside the source projection transaction with the account lock held. */
export async function transitionIntakeAuthority(
  db: Prisma.TransactionClient, userId: string, prior: Selection | null,
  next: IntakeAuthorityIdentity, now: Date, enabled = true,
) {
  requireIntakeCapability(prior?.authoritativeIntakeProvider, next.provider);
  if (!enabled && (!prior || !sameIntakeIdentity(selectionIdentity(prior), next))) {
    throw new AppError('Sources are updating. Try again shortly.', 409, { code: 'INTAKE_AUTHORITY_ROLLOUT_HOLD' });
  }
  const profile = await db.userProfile.findUnique({ where: { userId }, select: { timezone: true } });
  const timezone = profile?.timezone ?? 'UTC';
  const effectiveFrom = new Date(`${getLocalDateForTimezone(timezone, now)}T00:00:00.000Z`);
  const latest = await db.intakeAuthorityBoundary.findFirst({
    where: { userId, effectiveFrom: { not: null } }, orderBy: { effectiveFrom: 'desc' },
  });
  const posted = await db.finalizedDailyBankRecord.findUnique({ where: { userId_logDate: { userId, logDate: effectiveFrom } }, select: { id: true } });
  if ((latest?.effectiveFrom && latest.effectiveFrom > effectiveFrom) || posted) {
    throw new AppError('Your local day has already been recorded. Try changing sources on your next day.', 409, { code: 'INTAKE_AUTHORITY_DATE_CONFLICT' });
  }
  if (prior && sameIntakeIdentity(selectionIdentity(prior), next)) return;
  if (!latest) {
    const identity = prior ? selectionIdentity(prior) : { provider: 'unselected', writerId: null, sourceId: null };
    const valid = identity.provider === 'apple_health' ? Boolean(identity.writerId)
      : identity.provider === 'health_connect' ? Boolean(identity.sourceId) : true;
    const baseline = valid ? identity : { provider: 'unselected', writerId: null, sourceId: null };
    const existing = await db.intakeAuthorityBoundary.findFirst({ where: { userId, effectiveFrom: null } });
    if (existing) await db.intakeAuthorityBoundary.update({ where: { id: existing.id }, data: baseline });
    else await db.intakeAuthorityBoundary.create({ data: { userId, ...baseline } });
  }
  await db.intakeAuthorityBoundary.upsert({
    where: { userId_effectiveFrom: { userId, effectiveFrom } },
    create: { userId, effectiveFrom, timezone, ...next },
    update: { timezone, ...next },
  });
}

/** Bounded rolling-window resolution: five queries, independent of date count. */
export async function intakeRefreshPlan(
  db: Prisma.TransactionClient, userId: string, dates: string[], legacy: Selection,
) {
  const values = dates.map((date) => new Date(`${date}T00:00:00.000Z`));
  const last = [...values].sort((a, b) => b.getTime() - a.getTime())[0];
  if (!last) return [];
  const [boundaries, snapshots, overrides, initialization, dated] = await Promise.all([
    db.intakeAuthorityBoundary.findMany({
      where: { userId, OR: [{ effectiveFrom: { lte: last } }, { effectiveFrom: null }] },
      orderBy: { effectiveFrom: { sort: 'desc', nulls: 'last' } }, take: dates.length + 1,
    }),
    db.bankCalculationSnapshot.findMany({
      where: { userId, finalizedDailyBankRecord: { logDate: { in: values } } },
      include: { finalizedDailyBankRecord: { select: { logDate: true } } }, orderBy: { version: 'desc' },
    }),
    db.historicalSourceAuthorityOverride.findMany({ where: { userId, localDate: { in: values }, role: 'INTAKE' } }),
    db.bankAccountInitialization.findUnique({ where: { userId }, select: { status: true } }),
    db.intakeAuthorityBoundary.findFirst({ where: { userId, effectiveFrom: { not: null } }, select: { id: true } }),
  ]);
  return dates.map((localDate) => {
    const date = new Date(`${localDate}T00:00:00.000Z`);
    const override = overrides.find((row) => row.localDate.getTime() === date.getTime());
    const snapshot = snapshots.find((row) => row.finalizedDailyBankRecord.logDate.getTime() === date.getTime());
    const boundary = boundaries.find((row) => row.effectiveFrom === null || row.effectiveFrom <= date);
    // Explicit historical import is allowed only while Opening Bank is incomplete.
    const identity = override ? { provider: override.provider, writerId: override.intakeWriterBundleIdentifier, sourceId: override.intakeSourceId }
      : snapshot ? { provider: snapshot.intakeProvider, writerId: snapshot.intakeWriterBundleIdentifier, sourceId: snapshot.intakeSourceId }
      : initialization?.status !== 'INITIALIZED' && legacy.authoritativeIntakeProvider !== 'manual_estimate' ? selectionIdentity(legacy)
      : dated ? boundary ?? selectionIdentity(legacy) : selectionIdentity(legacy);
    return { localDate, provider: identity.provider, writerId: identity.writerId, sourceId: identity.sourceId };
  });
}
