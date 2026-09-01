import type { DailyStepAggregate, PrismaClient } from '@prisma/client';

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
};

function roundTo(value: number, increment: number) {
  return Math.round(value / increment) * increment;
}

export function calculatePersonalizedStepEstimate(
  currentSteps: number | null,
  samples: readonly WalkingCalibrationSample[],
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
  const valid = samples
    .filter(
      (sample) =>
        (sample.activityType === 'walking' || sample.activityType === 'running') &&
        sample.totalSteps > 0 &&
        sample.totalEnergyBurned > 0,
    )
    .sort((left, right) => right.startedAt.getTime() - left.startedAt.getTime())
    .slice(0, MAXIMUM_CALIBRATION_WORKOUTS);
  if (valid.length === 0) {
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
  const totals = valid.reduce(
    (sum, sample) => ({
      calories: sum.calories + sample.totalEnergyBurned,
      steps: sum.steps + sample.totalSteps,
    }),
    { calories: 0, steps: 0 },
  );
  const caloriesPerStep = totals.calories / totals.steps;
  return {
    estimatedContributionCalories: roundTo(currentSteps * caloriesPerStep, 10),
    estimatedCaloriesPer1000Steps: Math.round(caloriesPerStep * 1000),
    caloriesPerStep,
    calibrationWorkoutCount: valid.length,
    calibrationTotalSteps: totals.steps,
    calibrationTotalCalories: totals.calories,
    estimationStatus: 'ready',
  };
}

export function shouldShowStepsByDefault(stepCounts: readonly number[]) {
  return stepCounts.length >= MINIMUM_STEP_HISTORY_DAYS &&
    stepCounts.reduce((sum, count) => sum + count, 0) / stepCounts.length >= 10_000;
}

export async function estimateStepContribution(
  db: PrismaClient,
  userId: string,
  currentSteps: DailyStepAggregate | null,
): Promise<StepEstimate> {
  if (!currentSteps) return calculatePersonalizedStepEstimate(null, []);

  const oldestDate = new Date(currentSteps.localDate);
  oldestDate.setUTCDate(oldestDate.getUTCDate() - STEP_ESTIMATION_LOOKBACK_DAYS);
  const walkingWorkouts = await db.currentDayWorkout.findMany({
    where: {
      userId,
      provider: currentSteps.provider,
      activityType: { in: ['walking', 'running'] },
      localDate: { gte: oldestDate, lte: currentSteps.localDate },
      endedAt: { lte: new Date() },
      totalSteps: { gt: 0 },
      totalEnergyBurned: { gt: 0 },
      syncStatus: 'ready',
    },
    orderBy: { startedAt: 'desc' },
    take: MAXIMUM_CALIBRATION_WORKOUTS,
  });
  return calculatePersonalizedStepEstimate(
    currentSteps.totalSteps,
    walkingWorkouts.map((workout) => ({
      startedAt: workout.startedAt,
      activityType: workout.activityType === 'walking' || workout.activityType === 'running'
        ? workout.activityType
        : 'other',
      totalSteps: workout.totalSteps ?? 0,
      totalEnergyBurned: workout.totalEnergyBurned ?? 0,
    })),
  );
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
