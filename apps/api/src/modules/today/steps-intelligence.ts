import type { GrossWalkingSample } from '@caloriebank/domain';
import type { DailyStepAggregate, PrismaClient } from '@prisma/client';
import { estimateWalkingTime, calibrateNetStepRate, type NetStepSample, type OrdinaryForecastHistory } from '@caloriebank/domain';

export async function estimateWalkingPace(db: Pick<PrismaClient, 'currentDayWorkout'>, userId: string, provider: string, now = new Date()) {
  const workouts = await db.currentDayWorkout.findMany({
    where: { userId, provider, activityType: 'walking', syncStatus: 'ready',
      startedAt: { gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) },
      endedAt: { lte: now }, durationMinutes: { gt: 0 }, totalSteps: { gt: 0 } },
    orderBy: { startedAt: 'desc' },
  });
  const estimate = estimateWalkingTime(100, workouts.map((workout) => ({
    id: workout.id, provider: workout.provider, activityType: workout.activityType,
    startedAt: workout.startedAt, durationMinutes: workout.durationMinutes, steps: workout.totalSteps ?? 0,
  })), { provider, now });
  return estimate ? { stepsPerMinute: estimate.stepsPerMinute, sampleCount: estimate.sampleCount } : null;
}

import { readProviderSelection } from '../provider-selection/provider-selection.repository';

export const MINIMUM_STEP_HISTORY_DAYS = 3;
export const INITIAL_STEP_VISIBILITY_LOOKBACK_DAYS = 7;
export const STEP_ESTIMATION_LOOKBACK_DAYS = 30;
export const MAXIMUM_CALIBRATION_WORKOUTS = 5;

type StepEstimate = {
  estimatedContributionCalories: number | null;
  estimatedCaloriesPer1000Steps: number | null;
  caloriesPerStep: number | null;
  calibrationWorkoutCount: number;
  calibrationTotalSteps: number;
  calibrationTotalCalories: number;
  estimationStatus: 'ready' | 'insufficient_data' | 'unavailable';
};

export type WalkingCalibrationSample = {
  startedAt: Date;
  activityType: 'walking' | 'running' | 'other';
  totalSteps: number;
  totalEnergyBurned: number;
  evidence?: NetStepSample;
};
export type VerifiedStepCalibration = {
  accountId: string; provider: string; localDate: string; timezone: string;
  sourceVersion: string; expiresAt: Date; samples: readonly NetStepSample[];
  grossWalkingSamples?: readonly GrossWalkingSample[];
  ordinaryHistory?: { history: OrdinaryForecastHistory; rawLowActivityTotalKcalPerHour: number | null };
};
export interface StepCalibrationReader {
  read(userId: string, localDate: string, timezone: string): Promise<VerifiedStepCalibration | null>;
  validate(db: Pick<PrismaClient, 'user' | 'currentDayWorkout'>, value: VerifiedStepCalibration): Promise<boolean>;
}

function roundTo(value: number, increment: number) {
  return Math.round(value / increment) * increment;
}

export function calculatePersonalizedStepEstimate(
  currentSteps: number | null,
  samples: readonly WalkingCalibrationSample[],
  now = new Date(),
): StepEstimate {
  if (currentSteps === null) {
    return {
      estimatedContributionCalories: null,
      estimatedCaloriesPer1000Steps: null,
      caloriesPerStep: null,
      calibrationWorkoutCount: 0,
      calibrationTotalSteps: 0,
      calibrationTotalCalories: 0,
      estimationStatus: 'unavailable',
    };
  }
  const evidence = samples.flatMap(s => s.evidence && s.activityType === s.evidence.activityType &&
    s.totalSteps === s.evidence.steps.count && s.totalEnergyBurned === s.evidence.energy.calories &&
    s.startedAt.getTime() === s.evidence.steps.start.getTime() ? [s.evidence] : []);
  const providers = new Set(evidence.map(s => s.provider));
  const calibration = providers.size === 1 ? calibrateNetStepRate({
    provider: evidence[0]!.provider, activityType: 'walking', now, samples: evidence,
  }) : null;
  if (!calibration) return {
    estimatedContributionCalories: null, estimatedCaloriesPer1000Steps: null,
    caloriesPerStep: null, calibrationWorkoutCount: 0, calibrationTotalSteps: 0,
    calibrationTotalCalories: 0, estimationStatus: 'unavailable',
  };
  const caloriesPerStep = calibration.caloriesPerStep;
  return {
    estimatedContributionCalories: roundTo(currentSteps * caloriesPerStep, 10),
    estimatedCaloriesPer1000Steps: Math.round(caloriesPerStep * 1000),
    caloriesPerStep,
    calibrationWorkoutCount: calibration.sampleCount,
    calibrationTotalSteps: calibration.steps,
    // Existing wire summary is integer kcal; the coefficient keeps full precision.
    calibrationTotalCalories: Math.round(calibration.calories),
    estimationStatus: 'ready',
  };
}

export function shouldShowStepsByDefault(stepCounts: readonly number[]) {
  return stepCounts.length >= MINIMUM_STEP_HISTORY_DAYS &&
    stepCounts.reduce((sum, count) => sum + count, 0) / stepCounts.length >= 10_000;
}

export async function estimateStepContribution(
  _db: Pick<PrismaClient, 'currentDayWorkout'>,
  userId: string,
  currentSteps: DailyStepAggregate | null,
  verified?: VerifiedStepCalibration | null,
  now = new Date(),
): Promise<StepEstimate> {
  if (!currentSteps) return calculatePersonalizedStepEstimate(null, []);
  // Legacy persisted scalars have no energy-basis/interval metadata. Never
  // promote them to verified net energy, regardless of the provider name.
  if (!verified || verified.accountId !== userId || verified.provider !== currentSteps.provider ||
    verified.localDate !== currentSteps.localDate.toISOString().slice(0,10) ||
    verified.timezone !== currentSteps.timezone || verified.expiresAt <= now) {
    return calculatePersonalizedStepEstimate(currentSteps.totalSteps, []);
  }
  return calculatePersonalizedStepEstimate(currentSteps.totalSteps, verified.samples.map(evidence => ({
    startedAt: evidence.steps.start, activityType: evidence.activityType,
    totalSteps: evidence.steps.count, totalEnergyBurned: evidence.energy.calories, evidence,
  })), now);
}

export async function inferInitialStepsVisibility(db: PrismaClient, userId: string) {
  const selection = await readProviderSelection(db, userId);
  const selectedProvider = selection.authoritativeActivityProvider;
  if (!selectedProvider) return null;

  let records = await db.dailyStepAggregate.findMany({
    where: {
      userId,
      provider: selectedProvider,
      isCurrentDay: false,
      syncStatus: 'ready',
    },
    orderBy: { localDate: 'desc' },
    take: INITIAL_STEP_VISIBILITY_LOOKBACK_DAYS,
  });
  if (
    records.length === 0 &&
    selection.allowActivityFallback &&
    selectedProvider !== 'apple_health'
  ) {
    records = await db.dailyStepAggregate.findMany({
      where: {
        userId,
        provider: 'apple_health',
        isCurrentDay: false,
        syncStatus: 'ready',
      },
      orderBy: { localDate: 'desc' },
      take: INITIAL_STEP_VISIBILITY_LOOKBACK_DAYS,
    });
  }
  if (records.length < MINIMUM_STEP_HISTORY_DAYS) return null;
  return shouldShowStepsByDefault(records.map((record) => record.totalSteps));
}
