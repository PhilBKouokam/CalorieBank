import type {
  BankSummaryResponse,
  OnboardingStage,
  OnboardingStatusResponse,
  ProviderSelectionResponse,
} from '@caloriebank/schemas';
import type { PrismaClient } from '@prisma/client';

import { AppError } from '../../errors';
import type { BankHistoryRepository } from '../bank-history/bank-history.repository';
import type { DevelopmentUser } from '../goal-configuration/goal-configuration.repository';
import type { ProviderSelectionRepository } from '../provider-selection/provider-selection.repository';
import { readOpeningImportState } from '../bank-history/opening-bank-import';
import { getLocalDateForTimezone } from '../today/today.time';

export type OnboardingFacts = {
  welcomeCompleted: boolean;
  completed: boolean;
  providerSelection: ProviderSelectionResponse;
  goalConfigured: boolean;
  bankSummary: BankSummaryResponse;
  preparation: OnboardingStatusResponse['preparation'];
};

function selectedSource(
  role: ProviderSelectionResponse['expenditure'] | ProviderSelectionResponse['intake'],
  connectedProviders: ProviderSelectionResponse['connectedProviders'],
) {
  const connection = connectedProviders.find((item) => item.provider === role.authoritativeProvider);
  return {
    provider: role.authoritativeProvider,
    displayName: role.displayName,
    connected: connection?.status === 'connected' || connection?.status === 'needs_attention',
    status: role.status,
    readiness: 'not_connected' as OnboardingStatusResponse['expenditure']['readiness'],
  };
}

export function sourceSelectionSatisfiesSetup(
  source: OnboardingStatusResponse['expenditure'] | OnboardingStatusResponse['intake'],
) {
  return source.connected
    && (source.readiness === 'ready' || source.readiness === 'connected_waiting_for_data');
}

export function deriveOnboardingStatus(facts: OnboardingFacts): OnboardingStatusResponse {
  const expenditure = selectedSource(
    facts.providerSelection.expenditure,
    facts.providerSelection.connectedProviders,
  );
  const intake = selectedSource(
    facts.providerSelection.intake,
    facts.providerSelection.connectedProviders,
  );
  expenditure.readiness = !expenditure.connected
    ? 'not_connected'
    : facts.providerSelection.expenditure.status === 'needs_attention'
      ? 'needs_attention'
      : facts.providerSelection.expenditure.status === 'ready'
        ? 'ready'
        : 'connected_waiting_for_data';
  intake.readiness = !intake.connected
    ? 'not_connected'
    : facts.providerSelection.intake.status === 'needs_attention'
      ? 'needs_attention'
      : facts.providerSelection.intake.status === 'ready'
        ? 'ready'
        : 'connected_waiting_for_data';
  let stage: OnboardingStage;
  if (facts.completed) stage = 'complete';
  else if (!facts.welcomeCompleted) stage = 'welcome';
  else if (!sourceSelectionSatisfiesSetup(expenditure)) stage = 'calories_burned';
  else if (!sourceSelectionSatisfiesSetup(intake)) stage = 'calories_eaten';
  else if (!facts.goalConfigured) stage = 'goal';
  else if (
    facts.bankSummary.openingBankStatus === 'waiting_for_opening_data' &&
    facts.preparation.history !== 'no_history'
  ) stage = 'preparing_bank';
  else stage = 'ready';

  return {
    stage,
    welcomeCompleted: facts.welcomeCompleted,
    completed: facts.completed,
    expenditure,
    intake,
    goalConfigured: facts.goalConfigured,
    openingBankStatus: facts.bankSummary.openingBankStatus,
    openingBankCalories: facts.bankSummary.openingBankCalories,
    preparation: facts.preparation,
  };
}

export interface OnboardingRepository {
  getStatus(user: DevelopmentUser): Promise<OnboardingStatusResponse>;
  completeWelcome(user: DevelopmentUser): Promise<OnboardingStatusResponse>;
  completeOnboarding(user: DevelopmentUser): Promise<OnboardingStatusResponse>;
}

export class PrismaOnboardingRepository implements OnboardingRepository {
  constructor(
    private readonly db: PrismaClient,
    private readonly providers: ProviderSelectionRepository,
    private readonly bankHistory: BankHistoryRepository,
  ) {}

  private async facts(user: DevelopmentUser): Promise<OnboardingFacts> {
    const [profile, providerSelection, goal, bankSummary] = await Promise.all([
      this.db.userProfile.upsert({
        where: { userId: user.id },
        update: {},
        create: { userId: user.id },
      }),
      this.providers.get(user.id),
      this.db.goalConfiguration.findUnique({ where: { userId: user.id }, select: { userId: true } }),
      this.bankHistory.getSummary(user.id),
    ]);
    const [selection, initialization] = await Promise.all([
      this.db.providerSelection.findUnique({ where: { userId: user.id } }),
      this.db.bankAccountInitialization.findUnique({ where: { userId: user.id } }),
    ]);
    const timezone = profile.timezone || 'UTC';
    const importState = await readOpeningImportState(
      this.db,
      user.id,
      getLocalDateForTimezone(timezone),
    );
    const preparation: OnboardingStatusResponse['preparation'] = {
      expenditure: importState.expenditure,
      intake: importState.intake,
      history: importState.expenditure === 'retry_needed' || importState.intake === 'retry_needed'
        ? 'retry_needed'
        : importState.complete
          ? bankSummary.openingBankStatus === 'initialized'
            ? 'complete'
            : initialization?.accountingStartsOn
              ? 'no_history'
              : 'preparing'
          : 'preparing',
    };
    if (selection) {
      const usableStatuses = ['ready', 'stale', 'partial'] as const;
      const [burnData, intakeData] = await Promise.all([
        this.db.dailyExpenditureAggregate.findFirst({
          where: {
            userId: user.id,
            provider: selection.authoritativeExpenditureProvider,
            syncStatus: { in: [...usableStatuses] },
            rawTotalDailyExpenditure: { gt: 0 },
          },
          select: { id: true },
        }),
        this.db.dailyIntakeAggregate.findFirst({
          where: {
            userId: user.id,
            provider: selection.authoritativeIntakeProvider,
            syncStatus: { in: [...usableStatuses] },
            ...(selection.authoritativeIntakeProvider === 'apple_health'
              ? selection.appleHealthIntakeWriterBundleId
                ? { writerBundleIdentifier: selection.appleHealthIntakeWriterBundleId }
                : { writerBundleIdentifier: '__writer_required__' }
              : {}),
          },
          select: { id: true },
        }),
      ]);
      if (!burnData && providerSelection.expenditure.status === 'ready') {
        providerSelection.expenditure.status = 'unavailable';
      }
      if (!intakeData && providerSelection.intake.status === 'ready') {
        providerSelection.intake.status = 'unavailable';
      }
    }
    return {
      welcomeCompleted: profile.onboardingWelcomeCompleted,
      completed: Boolean(profile.onboardingCompletedAt),
      providerSelection,
      goalConfigured: Boolean(goal),
      bankSummary,
      preparation,
    };
  }

  async getStatus(user: DevelopmentUser) {
    return deriveOnboardingStatus(await this.facts(user));
  }

  async completeWelcome(user: DevelopmentUser) {
    await this.db.userProfile.upsert({
      where: { userId: user.id },
      update: { onboardingWelcomeCompleted: true },
      create: { userId: user.id, onboardingWelcomeCompleted: true },
    });
    return this.getStatus(user);
  }

  async completeOnboarding(user: DevelopmentUser) {
    const current = await this.getStatus(user);
    if (current.stage !== 'ready' && current.stage !== 'complete') {
      throw new AppError('Setup is not ready to complete.', 409);
    }
    await this.db.userProfile.update({
      where: { userId: user.id },
      data: { onboardingWelcomeCompleted: true, onboardingCompletedAt: new Date() },
    });
    return this.getStatus(user);
  }
}
