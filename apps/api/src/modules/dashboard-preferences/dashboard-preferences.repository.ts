import type {
  DashboardPreferencesPatch,
  DashboardPreferencesResponse,
} from '@caloriebank/schemas';
import type { DashboardPreferences, PrismaClient } from '@prisma/client';

import type { DevelopmentUser } from '../goal-configuration/goal-configuration.repository';

export interface DashboardPreferencesRepository {
  get(user: DevelopmentUser): Promise<DashboardPreferencesResponse>;
  update(
    user: DevelopmentUser,
    patch: DashboardPreferencesPatch,
  ): Promise<DashboardPreferencesResponse>;
}

function response(preferences: DashboardPreferences): DashboardPreferencesResponse {
  return {
    showLatestFinalizedContribution: preferences.showLatestFinalizedContribution,
    showTodaySoFar: preferences.showTodaySoFar,
    showPlannedTreat: preferences.showPlannedTreat,
    showSteps: preferences.showSteps,
    showWorkouts: preferences.showWorkouts,
    showCurrentGoal: preferences.showCurrentGoal,
    updatedAt: preferences.updatedAt.toISOString(),
  };
}

export class PrismaDashboardPreferencesRepository implements DashboardPreferencesRepository {
  constructor(private readonly db: PrismaClient) {}

  private async ensureUser(user: DevelopmentUser) {
    await this.db.user.upsert({
      where: { id: user.id },
      update: { email: user.email },
      create: { id: user.id, email: user.email, profile: { create: { timezone: 'UTC' } } },
    });
  }

  async get(user: DevelopmentUser) {
    await this.ensureUser(user);
    const preferences = await this.db.dashboardPreferences.upsert({
      where: { userId: user.id },
      update: {},
      create: { userId: user.id },
    });
    return response(preferences);
  }

  async update(user: DevelopmentUser, patch: DashboardPreferencesPatch) {
    await this.ensureUser(user);
    const data = {
      ...(patch.showLatestFinalizedContribution !== undefined
        ? { showLatestFinalizedContribution: patch.showLatestFinalizedContribution }
        : {}),
      ...(patch.showTodaySoFar !== undefined ? { showTodaySoFar: patch.showTodaySoFar } : {}),
      ...(patch.showPlannedTreat !== undefined
        ? { showPlannedTreat: patch.showPlannedTreat }
        : {}),
      ...(patch.showSteps !== undefined ? { showSteps: patch.showSteps } : {}),
      ...(patch.showWorkouts !== undefined ? { showWorkouts: patch.showWorkouts } : {}),
      ...(patch.showCurrentGoal !== undefined
        ? { showCurrentGoal: patch.showCurrentGoal }
        : {}),
    };
    const preferences = await this.db.dashboardPreferences.upsert({
      where: { userId: user.id },
      update: data,
      create: { userId: user.id, ...data },
    });
    return response(preferences);
  }
}
