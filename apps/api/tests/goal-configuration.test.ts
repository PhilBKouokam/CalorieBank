import {
  formatGoalAdjustmentMagnitude,
  formatWeeklyWeightChange,
  getAdjustmentSourceLabel,
  getAdjustmentSummaryLabel,
  getGoalModeLabel,
  goalConfigurationInputSchema,
  type GoalConfigurationInput,
  type GoalConfigurationResponse,
} from '@caloriebank/schemas';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from '../src/app';
import type {
  DevelopmentUser,
  GoalConfigurationRepository,
} from '../src/modules/goal-configuration/goal-configuration.repository';

class MemoryGoalConfigurationRepository implements GoalConfigurationRepository {
  private configuration: GoalConfigurationResponse | null = null;

  async findByUserId(userId: string) {
    return this.configuration?.userId === userId ? this.configuration : null;
  }

  async upsertForUser(user: DevelopmentUser, input: GoalConfigurationInput) {
    this.configuration = {
      userId: user.id,
      ...input,
      desiredWeeklyWeightChange: input.desiredWeeklyWeightChange ?? null,
      updatedAt: new Date('2026-07-19T12:00:00.000Z').toISOString(),
    };
    return this.configuration;
  }
}

describe('goal configuration schema', () => {
  it('accepts cut with a valid negative adjustment', () => {
    expect(
      goalConfigurationInputSchema.safeParse({
        goalMode: 'cut',
        dailyEnergyAdjustment: -500,
        adjustmentSource: 'manual_calories',
      }).success,
    ).toBe(true);
  });

  it('accepts maintain with exactly zero', () => {
    expect(
      goalConfigurationInputSchema.safeParse({
        goalMode: 'maintain',
        dailyEnergyAdjustment: 0,
        adjustmentSource: 'manual_calories',
      }).success,
    ).toBe(true);
  });

  it('accepts bulk with a valid positive adjustment', () => {
    expect(
      goalConfigurationInputSchema.safeParse({
        goalMode: 'bulk',
        dailyEnergyAdjustment: 300,
        adjustmentSource: 'manual_calories',
      }).success,
    ).toBe(true);
  });

  it('rejects cut with zero or positive adjustments', () => {
    for (const dailyEnergyAdjustment of [0, 250]) {
      expect(
        goalConfigurationInputSchema.safeParse({
          goalMode: 'cut',
          dailyEnergyAdjustment,
          adjustmentSource: 'manual_calories',
        }).success,
      ).toBe(false);
    }
  });

  it('rejects maintain with nonzero adjustments', () => {
    for (const dailyEnergyAdjustment of [-250, 250]) {
      expect(
        goalConfigurationInputSchema.safeParse({
          goalMode: 'maintain',
          dailyEnergyAdjustment,
          adjustmentSource: 'manual_calories',
        }).success,
      ).toBe(false);
    }
  });

  it('rejects bulk with zero or negative adjustments', () => {
    for (const dailyEnergyAdjustment of [0, -250]) {
      expect(
        goalConfigurationInputSchema.safeParse({
          goalMode: 'bulk',
          dailyEnergyAdjustment,
          adjustmentSource: 'manual_calories',
        }).success,
      ).toBe(false);
    }
  });

  it('allows manual calorie adjustment without weekly rate', () => {
    expect(
      goalConfigurationInputSchema.safeParse({
        goalMode: 'cut',
        dailyEnergyAdjustment: -300,
        adjustmentSource: 'manual_calories',
      }).success,
    ).toBe(true);
  });

  it('requires weekly rate for estimated-rate adjustment', () => {
    expect(
      goalConfigurationInputSchema.safeParse({
        goalMode: 'cut',
        dailyEnergyAdjustment: -500,
        adjustmentSource: 'estimated_weight_rate',
      }).success,
    ).toBe(false);
  });

  it('accepts supported estimated weight-rate conversions', () => {
    expect(
      goalConfigurationInputSchema.safeParse({
        goalMode: 'cut',
        dailyEnergyAdjustment: -750,
        adjustmentSource: 'estimated_weight_rate',
        desiredWeeklyWeightChange: 1.5,
      }).success,
    ).toBe(true);

    expect(
      goalConfigurationInputSchema.safeParse({
        goalMode: 'bulk',
        dailyEnergyAdjustment: 500,
        adjustmentSource: 'estimated_weight_rate',
        desiredWeeklyWeightChange: 1,
      }).success,
    ).toBe(true);
  });
});

describe('goal configuration display helpers', () => {
  it('returns conditional adjustment-card labels', () => {
    expect(getAdjustmentSummaryLabel('cut')).toBe('Daily Deficit');
    expect(getAdjustmentSummaryLabel('maintain')).toBe('Maintenance');
    expect(getAdjustmentSummaryLabel('bulk')).toBe('Daily Surplus');
  });

  it('formats goal modes and adjustment sources for Today and settings screens', () => {
    expect(getGoalModeLabel('cut')).toBe('Cut');
    expect(getGoalModeLabel('maintain')).toBe('Maintain');
    expect(getGoalModeLabel('bulk')).toBe('Bulk');
    expect(getAdjustmentSourceLabel('manual_calories')).toBe('Manual calories');
    expect(getAdjustmentSourceLabel('estimated_weight_rate')).toBe('Estimated weight rate');
  });

  it('shows cut and bulk adjustment magnitudes as positive user-facing values', () => {
    expect(formatGoalAdjustmentMagnitude({ dailyEnergyAdjustment: -500 })).toBe('500 kcal');
    expect(formatGoalAdjustmentMagnitude({ dailyEnergyAdjustment: 300 })).toBe('300 kcal');
  });

  it('formats optional weekly weight-rate estimates', () => {
    expect(formatWeeklyWeightChange(1)).toBe('1.0 lb/week');
    expect(formatWeeklyWeightChange(null)).toBe('Not set');
  });
});

describe('/v1/me/goal-configuration', () => {
  it('returns 404 before the development user has configured a goal', async () => {
    const repository = new MemoryGoalConfigurationRepository();
    const response = await request(createApp(undefined, { goalConfigurationRepository: repository }))
      .get('/v1/me/goal-configuration')
      .expect(404);

    expect(response.body).toEqual({
      error: { message: 'Goal configuration has not been configured.' },
    });
  });

  it('saves and retrieves the development user goal configuration', async () => {
    const repository = new MemoryGoalConfigurationRepository();
    const app = createApp(undefined, { goalConfigurationRepository: repository });

    const saved = await request(app)
      .put('/v1/me/goal-configuration')
      .send({
        goalMode: 'cut',
        dailyEnergyAdjustment: -500,
        adjustmentSource: 'manual_calories',
      })
      .expect(200);

    expect(saved.body).toMatchObject({
      goalMode: 'cut',
      dailyEnergyAdjustment: -500,
      adjustmentSource: 'manual_calories',
      desiredWeeklyWeightChange: null,
    });

    const retrieved = await request(app).get('/v1/me/goal-configuration').expect(200);
    expect(retrieved.body).toEqual(saved.body);
  });

  it('rejects invalid goal configurations', async () => {
    const repository = new MemoryGoalConfigurationRepository();
    const response = await request(createApp(undefined, { goalConfigurationRepository: repository }))
      .put('/v1/me/goal-configuration')
      .send({
        goalMode: 'cut',
        dailyEnergyAdjustment: 500,
        adjustmentSource: 'manual_calories',
      })
      .expect(400);

    expect(response.body.error.message).toBe('Goal configuration is invalid.');
  });
});
