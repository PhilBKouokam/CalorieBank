import { getLocalDateForTimezone } from '../today/today.time';
import { openingImportDates } from '../bank-history/opening-bank-import';
import { intakeRefreshPlan, resolveIntakeAuthority, sameIntakeIdentity, selectionIdentity, transitionIntakeAuthority } from './intake-authority';
import { nativeIntakeSourceName } from '@caloriebank/schemas';
import type {
  HealthConnectionOption,
  HealthConnectionsResponse,
  ProviderSelectionInput,
  ProviderSelectionResponse,
} from '@caloriebank/schemas';
import type { Prisma, PrismaClient } from '@prisma/client';
import {
  canProvideAuthoritativeExpenditure,
  getProviderCapabilities,
  type ProviderId,
} from '@caloriebank/domain';

import type { DevelopmentUser } from '../goal-configuration/goal-configuration.repository';
import type { BankHistoryRepository } from '../bank-history/bank-history.repository';
import { AppError } from '../../errors';

export const DEFAULT_EXPENDITURE_PROVIDER = 'apple_health';
export const DEFAULT_ACTIVITY_PROVIDER = 'apple_health';
export const DEFAULT_INTAKE_PROVIDER = 'apple_health';

export type ProviderSelectionRecord = {
  expenditureSelected: boolean;
  intakeSelected: boolean;
  authoritativeExpenditureProvider: string;
  authoritativeActivityProvider: string;
  authoritativeIntakeProvider: string;
  appleHealthIntakeWriterBundleId: string | null;
  appleHealthIntakeWriterDisplayName: string | null;
  nativeIntakeSourceId: string | null;
  allowExpenditureFallback: boolean;
  allowActivityFallback: boolean;
};

export interface ProviderSelectionRepository {
  get(userId: string): Promise<ProviderSelectionResponse>;
  update(user: DevelopmentUser, input: ProviderSelectionInput): Promise<ProviderSelectionResponse>;
  getHealthConnections(userId: string): Promise<HealthConnectionsResponse>;
  selectBurned(user: DevelopmentUser, optionId: string): Promise<HealthConnectionsResponse>;
  selectEaten(user: DevelopmentUser, optionId: string): Promise<HealthConnectionsResponse>;
}

export const HEALTH_CONNECTION_OPTION_IDS = {
  burnedAppleHealth: 'burned-apple-health-v1',
  burnedFitbit: 'burned-fitbit-v1',
  eatenAppleHealthWriter: 'eaten-apple-health-writer-v1',
  eatenFatSecret: 'eaten-fatsecret-v1',
  eatenNative: 'eaten-health-connect-v1',
} as const;

function roleOption(
  optionId: string,
  label: string,
  status: HealthConnectionOption['status'],
  options: {
    transportLabel?: string | null;
    primaryAction?: HealthConnectionOption['primaryAction'];
    deviceManaged?: boolean;
  } = {},
): HealthConnectionOption {
  return {
    optionId,
    label,
    transportLabel: options.transportLabel ?? null,
    status,
    primaryAction: options.primaryAction ?? null,
    deviceManaged: options.deviceManaged ?? false,
  };
}

export async function readProviderSelection(
  db: Pick<PrismaClient, 'providerSelection'>,
  userId: string,
): Promise<ProviderSelectionRecord> {
  const stored = await db.providerSelection.findUnique({ where: { userId } });
  return {
    expenditureSelected: stored?.expenditureSelected ?? false,
    intakeSelected: stored?.intakeSelected ?? false,
    authoritativeExpenditureProvider:
      stored?.authoritativeExpenditureProvider ?? DEFAULT_EXPENDITURE_PROVIDER,
    authoritativeActivityProvider:
      stored?.authoritativeActivityProvider ?? DEFAULT_ACTIVITY_PROVIDER,
    authoritativeIntakeProvider:
      stored?.authoritativeIntakeProvider ?? DEFAULT_INTAKE_PROVIDER,
    appleHealthIntakeWriterBundleId: stored?.appleHealthIntakeWriterBundleId ?? null,
    appleHealthIntakeWriterDisplayName: stored?.appleHealthIntakeWriterDisplayName ?? null,
    nativeIntakeSourceId: stored?.nativeIntakeSourceId ?? null,
    allowExpenditureFallback: stored?.allowExpenditureFallback ?? false,
    allowActivityFallback: stored?.allowActivityFallback ?? false,
  };
}

/** Current read projection follows the active civil-date boundary, including travel. */
async function readEffectiveCurrentSelection(db: Prisma.TransactionClient, userId: string, now: Date) {
  const [selection, profile] = await Promise.all([
    readProviderSelection(db, userId),
    db.userProfile.findUnique({ where: { userId }, select: { timezone: true } }),
  ]);
  const localDate = getLocalDateForTimezone(profile?.timezone ?? 'UTC', now);
  const identity = await resolveIntakeAuthority(db, userId, new Date(`${localDate}T00:00:00.000Z`), selection);
  if (sameIntakeIdentity(selectionIdentity(selection), identity)) return selection;
  if (identity.provider === 'unselected') return { ...selection, intakeSelected: false };
  const writer = identity.provider === 'apple_health' ? await db.dailyIntakeAggregate.findFirst({
    where: { userId, provider: 'apple_health', writerBundleIdentifier: identity.writerId },
    orderBy: { updatedAt: 'desc' }, select: { writerDisplayName: true },
  }) : null;
  return {
    ...selection,
    authoritativeIntakeProvider: identity.provider,
    ...(identity.provider === 'apple_health' ? {
      appleHealthIntakeWriterBundleId: identity.writerId,
      appleHealthIntakeWriterDisplayName: writer?.writerDisplayName ?? null,
    } : {}),
    ...(identity.provider === 'health_connect' ? { nativeIntakeSourceId: identity.sourceId } : {}),
  };
}

export class PrismaProviderSelectionRepository implements ProviderSelectionRepository {
  constructor(
    private readonly db: PrismaClient,
    private readonly bankHistory: BankHistoryRepository,
    private readonly now: () => Date = () => new Date(),
    private readonly transitionsEnabled = true,
  ) {}

  private async responseInTransaction(userId: string, db: Prisma.TransactionClient): Promise<ProviderSelectionResponse> {
    const selection = await readEffectiveCurrentSelection(db, userId, this.now());
    const [googleHealth, externalConnections, appleSync, appleExpenditure, appleIntake, fatSecretIntake, appleSteps, appleWorkout, fitbitExpenditure] = await Promise.all([
      db.googleHealthConnection.findUnique({ where: { userId } }),
      db.externalProviderConnection.findMany({ where: { userId } }),
      db.ingestionSyncSession.findFirst({
        where: { userId, provider: 'apple_health', completedAt: { not: null } },
        orderBy: { completedAt: 'desc' },
      }),
      db.dailyExpenditureAggregate.findFirst({
        where: { userId, provider: 'apple_health', syncStatus: { in: ['ready', 'stale', 'partial'] } },
        orderBy: { updatedAt: 'desc' },
      }),
      db.dailyIntakeAggregate.findFirst({
        where: {
          userId,
          provider: 'apple_health',
          ...(selection.appleHealthIntakeWriterBundleId
            ? { writerBundleIdentifier: selection.appleHealthIntakeWriterBundleId }
            : { writerBundleIdentifier: '__writer_selection_required__' }),
          syncStatus: { in: ['ready', 'stale', 'partial'] },
        },
        orderBy: { updatedAt: 'desc' },
      }),
      db.dailyIntakeAggregate.findFirst({
        where: { userId, provider: 'fatsecret', syncStatus: { in: ['ready', 'stale', 'partial'] } },
        orderBy: { updatedAt: 'desc' },
      }),
      db.dailyStepAggregate.findFirst({
        where: { userId, provider: 'apple_health' }, orderBy: { updatedAt: 'desc' },
      }),
      db.currentDayWorkout.findFirst({
        where: { userId, provider: 'apple_health' }, orderBy: { updatedAt: 'desc' },
      }),
      db.dailyExpenditureAggregate.findFirst({
        where: { userId, provider: 'google_health_fitbit', syncStatus: { in: ['ready', 'stale', 'partial'] } },
        select: { id: true },
      }),
    ]);
    const externalConnection = (provider: string) => externalConnections.find((item) => item.provider === provider);
    const appleConnected = Boolean(appleSync || appleExpenditure || appleIntake || appleSteps || appleWorkout);
    const fitbitStatus = googleHealth?.status === 'connected' ? 'connected' : googleHealth ? 'needs_attention' : 'not_connected';
    const externalStatus = (provider: string) => {
      const connection = externalConnection(provider);
      return connection?.status === 'connected' ? 'connected' : connection ? 'needs_attention' : 'not_connected';
    };
    const expenditureReady = selection.authoritativeExpenditureProvider === 'google_health_fitbit'
      ? googleHealth?.status === 'connected' && Boolean(fitbitExpenditure)
      : Boolean(appleExpenditure);
    const activityReady = selection.authoritativeActivityProvider === 'google_health_fitbit'
      ? googleHealth?.status === 'connected'
      : selection.authoritativeActivityProvider === 'apple_health'
        ? Boolean(appleSteps || appleWorkout)
        : externalConnection(selection.authoritativeActivityProvider)?.status === 'connected';
    const providerDetails = (provider: ProviderId) => ({
      provider,
      displayName: {
        google_health_fitbit: 'Fitbit',
        apple_health: 'Apple Health',
        whoop: 'WHOOP',
        garmin: 'Garmin',
        fatsecret: 'FatSecret',
        health_connect: 'Health Connect',
      }[provider],
      capabilities: getProviderCapabilities(provider),
    });
    const selectedActivityProvider = selection.authoritativeActivityProvider as Exclude<ProviderId, 'fatsecret' | 'health_connect'>;
    const nativeIntake = selection.nativeIntakeSourceId ? await db.dailyIntakeAggregate.findFirst({
      where: { userId, provider: 'health_connect', sourceId: selection.nativeIntakeSourceId, syncStatus: { in: ['ready', 'stale', 'partial'] } },
    }) : null;
    const storedSelection = await db.providerSelection.findUnique({ where: { userId } });
    const profile = await db.userProfile.findUnique({ where: { userId }, select: { timezone: true } });
    const refreshPlan = await intakeRefreshPlan(db, userId,
      openingImportDates(getLocalDateForTimezone(profile?.timezone ?? 'UTC', this.now())), selection);

    return {
      expenditure: {
        selected: selection.expenditureSelected,
        authoritativeProvider: selection.authoritativeExpenditureProvider as 'apple_health' | 'google_health_fitbit',
        displayName: selection.authoritativeExpenditureProvider === 'google_health_fitbit' ? 'Fitbit' : 'Apple Health',
        status: expenditureReady ? 'ready' : selection.authoritativeExpenditureProvider === 'google_health_fitbit' ? fitbitStatus : 'unavailable',
        fallbackActive: false,
      },
      activityContext: {
        authoritativeProvider: selectedActivityProvider,
        displayName: providerDetails(selectedActivityProvider).displayName,
        status: activityReady
          ? 'ready'
          : selectedActivityProvider === 'google_health_fitbit'
            ? fitbitStatus
            : selectedActivityProvider === 'apple_health'
              ? 'unavailable'
              : externalStatus(selectedActivityProvider),
        fallbackActive: false,
      },
      intake: {
        selected: selection.intakeSelected && (selection.authoritativeIntakeProvider !== 'apple_health' || Boolean(selection.appleHealthIntakeWriterBundleId)),
        authoritativeProvider: selection.authoritativeIntakeProvider as 'apple_health' | 'fatsecret' | 'health_connect',
        displayName: selection.authoritativeIntakeProvider === 'health_connect'
          ? nativeIntakeSourceName(selection.nativeIntakeSourceId ?? '')
          : selection.authoritativeIntakeProvider === 'fatsecret'
          ? 'FatSecret'
          : selection.appleHealthIntakeWriterDisplayName ?? 'Apple Health',
        status: selection.authoritativeIntakeProvider === 'health_connect'
          ? nativeIntake ? 'ready' : 'unavailable'
          : selection.authoritativeIntakeProvider === 'fatsecret'
          ? fatSecretIntake
            ? 'ready'
            : externalStatus('fatsecret') === 'connected'
              ? 'unavailable'
              : externalStatus('fatsecret')
          : appleIntake
            ? 'ready'
            : 'unavailable',
        writerBundleIdentifier: selection.appleHealthIntakeWriterBundleId,
        writerDisplayName: selection.appleHealthIntakeWriterDisplayName,
        refreshPlan,
        ...(storedSelection && refreshPlan.some((entry) => entry.provider === 'health_connect') ? { selectionRevision: storedSelection.updatedAt.toISOString() } : {}),
        ...(selection.authoritativeIntakeProvider === 'health_connect' ? { nativeIntakeSource: selection.nativeIntakeSourceId ? { namespace: 'android_package' as const, id: selection.nativeIntakeSourceId } : null, selectionRevision: storedSelection!.updatedAt.toISOString() } : {}),
      },
      connectedProviders: [
        ...(selection.nativeIntakeSourceId ? [{ ...providerDetails('health_connect'), status: 'connected' as const, lastSyncedAt: nativeIntake?.importedAt.toISOString() ?? null }] : []),
        {
          ...providerDetails('apple_health'),
          status: appleConnected ? 'connected' : 'not_connected',
          lastSyncedAt: [appleSync?.completedAt, appleExpenditure?.updatedAt, appleIntake?.updatedAt, appleSteps?.updatedAt, appleWorkout?.updatedAt]
            .filter((value): value is Date => Boolean(value))
            .sort((left, right) => right.getTime() - left.getTime())[0]?.toISOString() ?? null,
        },
        {
          ...providerDetails('google_health_fitbit'),
          status: fitbitStatus,
          lastSyncedAt: googleHealth?.lastSyncedAt?.toISOString() ?? null,
        },
        {
          ...providerDetails('garmin'),
          status: externalStatus('garmin'),
          lastSyncedAt: externalConnection('garmin')?.lastSyncedAt?.toISOString() ?? null,
        },
        {
          ...providerDetails('whoop'),
          status: externalStatus('whoop'),
          lastSyncedAt: externalConnection('whoop')?.lastSyncedAt?.toISOString() ?? null,
        },
        {
          ...providerDetails('fatsecret'),
          status: externalStatus('fatsecret'),
          lastSyncedAt: externalConnection('fatsecret')?.lastSyncedAt?.toISOString() ?? null,
        },
      ],
    };
  }

  private response(userId: string) {
    return this.db.$transaction((transaction) => this.responseInTransaction(userId, transaction), { isolationLevel: 'RepeatableRead' });
  }

  get(userId: string) {
    return this.response(userId);
  }

  async getHealthConnections(userId: string): Promise<HealthConnectionsResponse> {
    const selection = await readEffectiveCurrentSelection(this.db, userId, this.now());
    const [fitbit, fatSecret, appleExpenditure, appleIntake, appleEvidence] = await Promise.all([
      this.db.googleHealthConnection.findUnique({ where: { userId } }),
      this.db.externalProviderConnection.findUnique({
        where: { userId_provider: { userId, provider: 'fatsecret' } },
      }),
      this.db.dailyExpenditureAggregate.findFirst({
        where: {
          userId,
          provider: 'apple_health',
          rawTotalDailyExpenditure: { gt: 0 },
          syncStatus: { in: ['ready', 'stale', 'partial'] },
        },
        select: { id: true },
      }),
      selection.appleHealthIntakeWriterBundleId
        ? this.db.dailyIntakeAggregate.findFirst({
            where: {
              userId,
              provider: 'apple_health',
              writerBundleIdentifier: selection.appleHealthIntakeWriterBundleId,
              syncStatus: { in: ['ready', 'stale', 'partial'] },
            },
            select: { id: true },
          })
        : null,
      this.db.ingestionSyncSession.findFirst({
        where: { userId, provider: 'apple_health', completedAt: { not: null } },
        select: { id: true },
      }),
    ]);

    const fitbitStatus: HealthConnectionOption['status'] = fitbit?.status === 'connected'
      ? 'connected'
      : fitbit
        ? 'needs_attention'
        : 'not_connected';
    const fatSecretStatus: HealthConnectionOption['status'] = fatSecret?.status === 'connected'
      ? 'connected'
      : fatSecret
        ? 'needs_attention'
        : 'not_connected';
    const appleBurnStatus: HealthConnectionOption['status'] = appleExpenditure ? 'connected' : 'no_data';
    const appleIntakeStatus: HealthConnectionOption['status'] = !selection.appleHealthIntakeWriterBundleId
      ? 'needs_attention'
      : appleIntake
        ? 'connected'
        : 'no_data';

    const burnedOptions = [
      roleOption(
        HEALTH_CONNECTION_OPTION_IDS.burnedAppleHealth,
        'Apple Health',
        appleBurnStatus,
        {
          deviceManaged: true,
          primaryAction: appleBurnStatus === 'connected' ? null : 'refresh_apple_health',
        },
      ),
      roleOption(
        HEALTH_CONNECTION_OPTION_IDS.burnedFitbit,
        'Fitbit',
        fitbitStatus,
        { primaryAction: fitbitStatus === 'needs_attention' ? 'reconnect' : fitbitStatus === 'not_connected' ? 'connect' : null },
      ),
    ];
    const appleWriterLabel = selection.appleHealthIntakeWriterDisplayName ?? 'Apple Health food tracker';
    const eatenOptions = [
      roleOption(
        HEALTH_CONNECTION_OPTION_IDS.eatenAppleHealthWriter,
        appleWriterLabel,
        appleIntakeStatus,
        {
          transportLabel: 'Apple Health',
          deviceManaged: true,
          primaryAction: appleIntakeStatus === 'connected' ? null : 'refresh_apple_health',
        },
      ),
      roleOption(
        HEALTH_CONNECTION_OPTION_IDS.eatenFatSecret,
        'FatSecret',
        fatSecretStatus,
        { primaryAction: fatSecretStatus === 'needs_attention' ? 'reconnect' : fatSecretStatus === 'not_connected' ? 'connect' : null },
      ),
    ];
    const burnedSelected = !selection.expenditureSelected ? null : selection.authoritativeExpenditureProvider === 'google_health_fitbit'
      ? burnedOptions[1]!
      : selection.authoritativeExpenditureProvider === 'apple_health'
        ? burnedOptions[0]!
        : null;
    const eatenSelected = !selection.intakeSelected || (selection.authoritativeIntakeProvider === 'apple_health' && !selection.appleHealthIntakeWriterBundleId) ? null : selection.authoritativeIntakeProvider === 'fatsecret'
      ? eatenOptions[1]!
      : selection.authoritativeIntakeProvider === 'apple_health'
        ? eatenOptions[0]!
        : null;
    const nativeData = selection.nativeIntakeSourceId ? await this.db.dailyIntakeAggregate.findFirst({ where: { userId, provider: 'health_connect', sourceId: selection.nativeIntakeSourceId, syncStatus: { in: ['ready', 'stale', 'partial'] } } }) : null;
    const nativeOption = selection.nativeIntakeSourceId ? roleOption(HEALTH_CONNECTION_OPTION_IDS.eatenNative, nativeIntakeSourceName(selection.nativeIntakeSourceId), nativeData ? 'connected' : 'no_data', { transportLabel: 'Health Connect', deviceManaged: true, primaryAction: 'check_native_health' }) : null;
    if (nativeOption && (selection.authoritativeIntakeProvider === 'health_connect' || selection.nativeIntakeSourceId !== 'com.fatsecret.android' || fatSecretStatus !== 'connected')) eatenOptions.push(nativeOption);
    const effectiveEatenSelected = selection.intakeSelected && selection.authoritativeIntakeProvider === 'health_connect' ? nativeOption : eatenSelected;
    const selectable = (option: HealthConnectionOption) => option.status === 'connected';

    const connectedServices: HealthConnectionOption[] = [];
    if (appleEvidence || appleExpenditure || appleIntake) {
      connectedServices.push(roleOption(
        'service-apple-health-v1',
        'Apple Health',
        appleExpenditure || appleIntake ? 'connected' : 'no_data',
        {
          deviceManaged: true,
          primaryAction: appleExpenditure || appleIntake ? null : 'refresh_apple_health',
        },
      ));
    }
    if (fitbit) {
      connectedServices.push(roleOption(
        'service-fitbit-v1',
        'Fitbit',
        fitbitStatus,
        { primaryAction: fitbitStatus === 'needs_attention' ? 'reconnect' : null },
      ));
    }
    if (fatSecret) {
      connectedServices.push(roleOption(
        'service-fatsecret-v1',
        'FatSecret',
        fatSecretStatus,
        { primaryAction: fatSecretStatus === 'needs_attention' ? 'reconnect' : null },
      ));
    }

    // Keep known-but-not-ready sources visible so clients can offer the correct
    // recovery action. `canChange` still permits only usable sources.
    const burnedAlternatives = burnedOptions.filter((option) =>
      option.optionId !== burnedSelected?.optionId && option.status !== 'not_connected',
    );
    const eatenAlternatives = eatenOptions.filter((option) =>
      option.optionId !== effectiveEatenSelected?.optionId && option.status !== 'not_connected',
    );
    return {
      burned: {
        selected: burnedSelected,
        alternatives: burnedAlternatives,
        canChange: burnedAlternatives.some(selectable),
        canAddSource: burnedOptions.some((option) =>
          option.optionId !== burnedSelected?.optionId && option.status !== 'connected'),
      },
      eaten: {
        selected: effectiveEatenSelected,
        alternatives: eatenAlternatives,
        canChange: eatenAlternatives.some(selectable),
        canAddSource: eatenOptions.some((option) =>
          option.optionId !== effectiveEatenSelected?.optionId && option.status !== 'connected'),
      },
      connectedServices,
    };
  }

  async selectBurned(user: DevelopmentUser, optionId: string) {
    const current = await readProviderSelection(this.db, user.id);
    const provider = optionId === HEALTH_CONNECTION_OPTION_IDS.burnedFitbit
      ? 'google_health_fitbit'
      : optionId === HEALTH_CONNECTION_OPTION_IDS.burnedAppleHealth
        ? 'apple_health'
        : null;
    if (!provider) throw new AppError('That calories burned source is unavailable.', 400, { code: 'HEALTH_CONNECTION_OPTION_INVALID' });
    if (provider === 'apple_health' && !await this.db.dailyExpenditureAggregate.findFirst({
      where: { userId: user.id, provider, syncStatus: { in: ['ready', 'stale', 'partial'] } },
      select: { id: true },
    })) {
      throw new AppError('Refresh Apple Health before using it for calorie burn.', 409);
    }
    await this.update(user, {
      selectionRole: 'burned',
      authoritativeExpenditureProvider: provider,
      authoritativeActivityProvider: provider,
      authoritativeIntakeProvider: current.authoritativeIntakeProvider as 'apple_health' | 'fatsecret' | 'health_connect',
    });
    return this.getHealthConnections(user.id);
  }

  async selectEaten(user: DevelopmentUser, optionId: string) {
    const current = await readProviderSelection(this.db, user.id);
    const provider = optionId === HEALTH_CONNECTION_OPTION_IDS.eatenFatSecret
      ? 'fatsecret'
      : optionId === HEALTH_CONNECTION_OPTION_IDS.eatenNative
        ? 'health_connect'
        : optionId === HEALTH_CONNECTION_OPTION_IDS.eatenAppleHealthWriter
        ? 'apple_health'
        : null;
    if (!provider) throw new AppError('That calories eaten source is unavailable.', 400, { code: 'HEALTH_CONNECTION_OPTION_INVALID' });
    if (provider === 'apple_health') {
      if (!current.appleHealthIntakeWriterBundleId) {
        throw new AppError('Choose a food tracker in Apple Health first.', 409, { code: 'APPLE_HEALTH_INTAKE_WRITER_REQUIRED' });
      }
      const aggregate = await this.db.dailyIntakeAggregate.findFirst({
        where: {
          userId: user.id,
          provider: 'apple_health',
          writerBundleIdentifier: current.appleHealthIntakeWriterBundleId,
          syncStatus: { in: ['ready', 'stale', 'partial'] },
        },
        select: { id: true },
      });
      if (!aggregate) {
        throw new AppError('The selected Apple Health food tracker has no usable calorie data.', 409, {
          code: 'APPLE_HEALTH_INTAKE_WRITER_UNAVAILABLE',
        });
      }
    }
    await this.update(user, {
      selectionRole: 'eaten',
      authoritativeExpenditureProvider: current.authoritativeExpenditureProvider as 'apple_health' | 'google_health_fitbit',
      authoritativeActivityProvider: current.authoritativeActivityProvider as 'apple_health' | 'google_health_fitbit' | 'garmin' | 'whoop',
      authoritativeIntakeProvider: provider,
    });
    return this.getHealthConnections(user.id);
  }

  async update(user: DevelopmentUser, input: ProviderSelectionInput) {
    const changesBurn = input.selectionRole !== 'eaten';
    const changesIntake = input.selectionRole !== 'burned';
    if (changesBurn && !canProvideAuthoritativeExpenditure(input.authoritativeExpenditureProvider)) {
      throw new AppError('The selected provider cannot supply total daily expenditure.', 400);
    }
    if (changesBurn && input.authoritativeExpenditureProvider === 'google_health_fitbit') {
      const googleHealth = await this.db.googleHealthConnection.findUnique({ where: { userId: user.id } });
      if (!googleHealth || googleHealth.status !== 'connected') {
        throw new AppError('Connect Fitbit before selecting it for calorie burn.', 409);
      }
    }
    if (changesBurn && !input.selectionRole && input.authoritativeExpenditureProvider === 'apple_health') {
      const appleExpenditure = await this.db.dailyExpenditureAggregate.findFirst({
        where: { userId: user.id, provider: 'apple_health', syncStatus: { in: ['ready', 'stale', 'partial'] } },
        select: { id: true },
      });
      if (!appleExpenditure) {
        throw new AppError(
          'Apple Health needs both active and resting energy before it can provide calorie burn.',
          409,
        );
      }
    }
    await this.db.user.upsert({
      where: { id: user.id },
      update: { email: user.email },
      create: { id: user.id, email: user.email },
    });
    const authoritativeActivityProvider = input.authoritativeActivityProvider
      ?? input.authoritativeExpenditureProvider;
    const activityCapabilities = getProviderCapabilities(authoritativeActivityProvider);
    if (changesBurn && !activityCapabilities.steps && !activityCapabilities.workouts) {
      throw new AppError('The selected provider cannot supply activity context.', 400);
    }
    if (changesBurn && authoritativeActivityProvider === 'google_health_fitbit') {
      const googleHealth = await this.db.googleHealthConnection.findUnique({ where: { userId: user.id } });
      if (!googleHealth || googleHealth.status !== 'connected') {
        throw new AppError('Connect Fitbit before selecting it for activity.', 409);
      }
    } else if (changesBurn && (authoritativeActivityProvider === 'garmin' || authoritativeActivityProvider === 'whoop')) {
      const connection = await this.db.externalProviderConnection.findUnique({
        where: { userId_provider: { userId: user.id, provider: authoritativeActivityProvider } },
      });
      if (!connection || connection.status !== 'connected') {
        throw new AppError(`Connect ${authoritativeActivityProvider === 'whoop' ? 'WHOOP' : 'Garmin'} before selecting it for activity.`, 409);
      }
    }
    if (changesIntake && input.authoritativeIntakeProvider === 'fatsecret') {
      const connection = await this.db.externalProviderConnection.findUnique({
        where: { userId_provider: { userId: user.id, provider: 'fatsecret' } },
      });
      if (!connection || connection.status !== 'connected') {
        throw new AppError('Connect FatSecret before selecting it for calories eaten.', 409);
      }
    }
    const existingSelection = await this.db.providerSelection.findUnique({ where: { userId: user.id } });
    const selectedWriter = input.appleHealthIntakeWriter === undefined
      ? existingSelection?.appleHealthIntakeWriterBundleId
        ? {
            bundleIdentifier: existingSelection.appleHealthIntakeWriterBundleId,
            displayName: existingSelection.appleHealthIntakeWriterDisplayName ?? 'Apple Health app',
          }
        : null
      : input.appleHealthIntakeWriter;
    if (
      changesIntake && input.authoritativeIntakeProvider === 'apple_health'
      && (input.appleHealthIntakeWriter === null || (input.selectionRole === 'eaten' && !selectedWriter))
    ) {
      throw new AppError('Choose the food tracker that supplies Apple Health calories.', 409, {
        code: 'APPLE_HEALTH_INTAKE_WRITER_REQUIRED',
      });
    }
    const nativeSourceId = input.nativeIntakeSource === undefined ? existingSelection?.nativeIntakeSourceId ?? null : input.nativeIntakeSource?.id ?? null;
    if (changesIntake && input.authoritativeIntakeProvider === 'health_connect' && !nativeSourceId) {
      throw new AppError('Choose a food tracker first.', 409, { code: 'NATIVE_INTAKE_SOURCE_REQUIRED' });
    }
    const roleChanges = {
      ...(changesBurn ? {
        expenditureSelected: true,
        authoritativeExpenditureProvider: input.authoritativeExpenditureProvider,
        authoritativeActivityProvider,
        allowExpenditureFallback: false,
        allowActivityFallback: false,
      } : {}),
      ...(changesIntake ? {
        intakeSelected: input.authoritativeIntakeProvider === 'health_connect' ? Boolean(nativeSourceId) : input.authoritativeIntakeProvider === 'fatsecret' || Boolean(selectedWriter),
        authoritativeIntakeProvider: input.authoritativeIntakeProvider,
        nativeIntakeSourceId: nativeSourceId,
        appleHealthIntakeWriterBundleId: selectedWriter?.bundleIdentifier ?? null,
        appleHealthIntakeWriterDisplayName: selectedWriter?.displayName ?? null,
      } : {}),
    };
    await this.db.$transaction(async (transaction) => {
      await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${user.id}), hashtext('opening-bank'))`;
      const stored = await transaction.providerSelection.findUnique({ where: { userId: user.id } });
      const changed = Object.entries(roleChanges).filter(([key, value]) =>
        !stored || stored[key as keyof typeof stored] !== value);
      if (changed.length === 0) return;
      if (changesIntake && roleChanges.intakeSelected) {
        await transitionIntakeAuthority(transaction, user.id, stored,
          selectionIdentity({
            authoritativeIntakeProvider: input.authoritativeIntakeProvider,
            appleHealthIntakeWriterBundleId: roleChanges.appleHealthIntakeWriterBundleId ?? null,
            nativeIntakeSourceId: roleChanges.nativeIntakeSourceId ?? null,
          }), this.now(), this.transitionsEnabled);
      }
      const materialChange = changed.some(([key]) => key !== 'appleHealthIntakeWriterDisplayName');
      await transaction.providerSelection.upsert({
        where: { userId: user.id },
        create: { userId: user.id, ...roleChanges },
        update: {
          ...roleChanges,
          selectedAt: materialChange ? this.now() : stored!.selectedAt,
          updatedAt: materialChange ? this.now() : stored!.updatedAt,
        },
      });
    });

    const provisional = changesBurn ? await this.db.finalizedDailyBankRecord.findMany({
      where: { userId: user.id, status: 'PROVISIONAL' },
      select: { logDate: true, timezone: true },
    }) : [];
    for (const record of provisional) {
      await this.bankHistory.reconcileStoredDay(
        user,
        record.logDate.toISOString().slice(0, 10),
        record.timezone,
      );
    }
    return this.response(user.id);
  }
}
