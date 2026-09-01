import type { TodaySoFarDataFreshnessStatus } from '@caloriebank/schemas';

import { getConsumerSourceName } from '../providers/presentation';

export function emptyTodayValue(status: TodaySoFarDataFreshnessStatus, noun: string) {
  if (status === 'not_connected') return 'Not connected';
  if (status === 'syncing') return 'Refreshing…';
  if (status === 'stale') return 'Out of date';
  if (status === 'error') return 'Needs attention';
  if (status === 'partial') return `Some ${noun} unavailable`;
  return `No ${noun} today`;
}

export function emptyTodayDetail(
  status: TodaySoFarDataFreshnessStatus,
  source: string | null,
  noun: string,
) {
  const provider = source ?? 'Your selected source';
  if (status === 'not_connected') return `Connect a source for ${noun}`;
  if (status === 'syncing') return `${provider} is refreshing`;
  if (status === 'stale') return `${provider} has not refreshed recently`;
  if (status === 'error') return `${provider} needs attention`;
  return `${provider} has not reported ${noun} today`;
}

export function formatStepContributions(input: {
  providerContributionCalories: number;
  actualContributionCalories: number;
  providerTotalBurnCalories: number;
  actualTotalBurnCalories: number;
  burnSource: string | null;
}) {
  const source = getConsumerSourceName(input.burnSource);
  const providerPercentage = formatContributionPercentage(
    input.providerContributionCalories,
    input.providerTotalBurnCalories,
  );
  const actualPercentage = formatContributionPercentage(
    input.actualContributionCalories,
    input.actualTotalBurnCalories,
  );
  return {
    providerContribution: `Contributed ~${input.providerContributionCalories.toLocaleString()} kcal${
      providerPercentage === null ? '' : ` (${providerPercentage}%)`
    }`,
    providerContext: `out of your ${input.providerTotalBurnCalories.toLocaleString()} kcal ${source} burn`,
    actualContribution: `Contributed ~${input.actualContributionCalories.toLocaleString()} kcal${
      actualPercentage === null ? '' : ` (${actualPercentage}%)`
    }`,
    actualContext: `out of your ${input.actualTotalBurnCalories.toLocaleString()} kcal estimated actual burn`,
  };
}

export function formatContributionPercentage(contribution: number, total: number) {
  if (!Number.isFinite(contribution) || !Number.isFinite(total) || contribution < 0 || total <= 0) return null;
  if (contribution > total) return null;
  return Math.round((contribution / total) * 100);
}

export function formatWorkoutCalorieLines(input: {
  totalSteps?: number | null;
  rawCalories: number;
  adjustmentFactor: number;
}) {
  const rawCalories = input.rawCalories.toLocaleString();
  return {
    reported: input.totalSteps === null || input.totalSteps === undefined
      ? `${rawCalories} kcal`
      : `${input.totalSteps.toLocaleString()} steps · ${rawCalories} kcal`,
    estimated: `${rawCalories} × ${input.adjustmentFactor.toFixed(1)} = ${Math.round(
      input.rawCalories * input.adjustmentFactor,
    ).toLocaleString()} kcal est. actual burn`,
  };
}
