import { createHash } from 'node:crypto';
import { canProvideAuthoritativeExpenditure, getLocalDateUtcBounds, getProviderCapabilities, type ProviderId } from '@caloriebank/domain';
import type { Prisma } from '@prisma/client';

import { readProviderSelection } from '../provider-selection/provider-selection.repository';

const usableStatuses = new Set(['ready', 'stale', 'partial']);

function supportsExpenditure(provider: string) {
  try {
    return canProvideAuthoritativeExpenditure(provider as ProviderId);
  } catch {
    return false;
  }
}

function supportsIntake(provider: string) {
  try {
    return getProviderCapabilities(provider as ProviderId).intake;
  } catch {
    return false;
  }
}

export type HistoricalRole = 'EXPENDITURE' | 'INTAKE';

export async function hasCompletedDayQueryEvidence(
  db: Prisma.TransactionClient,
  input: {
    userId: string;
    localDate: string;
    timezone: string;
    provider: string;
    role: HistoricalRole;
    aggregateImportedAt?: Date;
    aggregateWasCurrentDay?: boolean;
  },
) {
  const dayEndedAt = getLocalDateUtcBounds(input.localDate, input.timezone).end;
  if (
    input.aggregateWasCurrentDay === false &&
    input.aggregateImportedAt &&
    input.aggregateImportedAt >= dayEndedAt
  ) {
    return true;
  }
  const categoryField = input.role === 'EXPENDITURE' ? 'expenditureStatus' : 'intakeStatus';
  const session = await db.ingestionSyncSession.findFirst({
    where: {
      userId: input.userId,
      provider: input.provider,
      datesQueried: { has: input.localDate },
      completedAt: { gte: dayEndedAt },
      status: { in: ['completed', 'partially_completed'] },
      [categoryField]: 'ready',
    },
    orderBy: { completedAt: 'desc' },
    select: { id: true },
  });
  return Boolean(session);
}

export type ExpenditureCandidate = {
  kind: 'expenditure';
  provider: string;
  label: string;
  optionId: string;
  record: Awaited<ReturnType<Prisma.TransactionClient['dailyExpenditureAggregate']['findFirstOrThrow']>>;
};

export type IntakeCandidate = {
  kind: 'intake';
  provider: string;
  label: string;
  optionId: string;
  writerBundleIdentifier: string | null;
  record: Awaited<ReturnType<Prisma.TransactionClient['dailyIntakeAggregate']['findFirstOrThrow']>>;
};

export function consumerProviderName(provider: string, intakeDisplayName?: string | null) {
  if (intakeDisplayName) return intakeDisplayName;
  if (provider === 'google_health_fitbit') return 'Fitbit';
  if (provider === 'apple_health') return 'Apple Health';
  if (provider === 'fatsecret') return 'FatSecret';
  return 'Connected source';
}

export function historicalOptionId(userId: string, localDate: string, role: HistoricalRole, provider: string, writer: string | null) {
  return createHash('sha256')
    .update(['historical-source-v1', userId, localDate, role, provider, writer ?? ''].join('|'))
    .digest('hex');
}

function dateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}

export async function resolveDaySourceAuthority(
  db: Prisma.TransactionClient,
  userId: string,
  localDate: Date,
  timezone: string,
) {
  const date = dateOnly(localDate);
  const [selection, overrides, expenditureRecords, intakeRecords] = await Promise.all([
    readProviderSelection(db, userId),
    db.historicalSourceAuthorityOverride.findMany({ where: { userId, localDate } }),
    db.dailyExpenditureAggregate.findMany({ where: { userId, localDate }, orderBy: { updatedAt: 'desc' } }),
    db.dailyIntakeAggregate.findMany({ where: { userId, localDate }, orderBy: { updatedAt: 'desc' } }),
  ]);

  const expenditure = expenditureRecords
    .filter((record) =>
      supportsExpenditure(record.provider) &&
      usableStatuses.has(record.syncStatus) &&
      record.rawTotalDailyExpenditure > 0 &&
      record.timezone === timezone,
    )
    .map((record): ExpenditureCandidate => ({
      kind: 'expenditure',
      provider: record.provider,
      label: consumerProviderName(record.provider),
      optionId: historicalOptionId(userId, date, 'EXPENDITURE', record.provider, null),
      record,
    }));

  const intake = intakeRecords
    .filter((record) =>
      supportsIntake(record.provider) &&
      usableStatuses.has(record.syncStatus) &&
      record.totalCaloriesConsumed >= 0 &&
      record.timezone === timezone &&
      (record.provider !== 'apple_health' || Boolean(record.writerBundleIdentifier && record.writerDisplayName)),
    )
    .map((record): IntakeCandidate => ({
      kind: 'intake',
      provider: record.provider,
      label: consumerProviderName(record.provider, record.provider === 'apple_health' ? record.writerDisplayName : null),
      optionId: historicalOptionId(userId, date, 'INTAKE', record.provider, record.writerBundleIdentifier),
      writerBundleIdentifier: record.writerBundleIdentifier,
      record,
    }));

  const expenditureOverride = overrides.find((item) => item.role === 'EXPENDITURE');
  const intakeOverride = overrides.find((item) => item.role === 'INTAKE');
  const selectedExpenditure = expenditureOverride
    ? expenditure.find((item) => item.provider === expenditureOverride.provider) ?? null
    : expenditure.find((item) => item.provider === selection.authoritativeExpenditureProvider) ?? null;
  const selectedIntake = intakeOverride
    ? intake.find((item) =>
        item.provider === intakeOverride.provider &&
        item.writerBundleIdentifier === intakeOverride.intakeWriterBundleIdentifier,
      ) ?? null
    : intake.find((item) =>
        item.provider === selection.authoritativeIntakeProvider &&
        (item.provider !== 'apple_health' || item.writerBundleIdentifier === selection.appleHealthIntakeWriterBundleId),
      ) ?? null;

  return {
    expenditure,
    intake,
    selectedExpenditure,
    selectedIntake,
    expenditureOverride: expenditureOverride ?? null,
    intakeOverride: intakeOverride ?? null,
  };
}
