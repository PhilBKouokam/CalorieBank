import { canonicalRestingEvidenceType, qualifiedRestingModelProvenance } from '../google-health/google-health-model-provenance';
import { createHash } from 'node:crypto';
import { calibrateQuietWalkingRate } from '@caloriebank/domain';
import type { TodayResponse } from '@caloriebank/schemas';
import type { VerifiedStepCalibration } from './steps-intelligence';
export function quietBaselineVersion(model: { provider: string; evidenceType: string; providerKcalPerHour: number; calculatedAt: Date }) {
  return createHash('sha256').update(JSON.stringify([model.provider,model.evidenceType,model.providerKcalPerHour,model.calculatedAt.toISOString()])).digest('hex');
}
/** Re-derive from raw matched totals inside the same Today snapshot as the baseline.
 * Never cache a coupled coefficient across a model-rate/version change. */
export function buildQuietWalkingForecast(input: {
  accountId: string; provider: string | null; source: string | null; localDate: string; timezone: string; now: Date;
  currentInputsQualified: boolean; baselineQualified: boolean;
  model: { provider: string; evidenceType: string; providerKcalPerHour: number; calculatedAt: Date } | null;
  modelVersion: string | null; rawProjectedBurnBeforeWalking: number | null;
  planningAnchorAt: Date | null; planningExpiresAt: Date | null; calibration: VerifiedStepCalibration | null;
}): NonNullable<TodayResponse['steps']['quietWalkingForecast']> {
  const m=input.model,c=input.calibration;
  if (!input.baselineQualified || !m || !input.modelVersion || !Number.isFinite(m.calculatedAt.getTime()) || !qualifiedRestingModelProvenance(m) || canonicalRestingEvidenceType(m.evidenceType)!=='historical_low_activity_hours' || !Number.isFinite(m.providerKcalPerHour) || m.providerKcalPerHour<=0 ||
    input.rawProjectedBurnBeforeWalking===null || !Number.isFinite(input.rawProjectedBurnBeforeWalking) || input.rawProjectedBurnBeforeWalking<0 || input.modelVersion!==quietBaselineVersion(m)) return {status:'unavailable',reason:'unqualified_baseline'};
  if (!input.currentInputsQualified || !input.source || !input.provider || !input.planningAnchorAt || !input.planningExpiresAt ||
    !Number.isFinite(input.now.getTime()) || !Number.isFinite(input.planningAnchorAt.getTime()) || !Number.isFinite(input.planningExpiresAt.getTime()) || input.planningAnchorAt>input.now || input.planningExpiresAt<=input.now || m.provider!==input.provider) return {status:'unavailable',reason:'unqualified_current_inputs'};
  if (!c || !c.sourceVersion || !Number.isFinite(c.expiresAt.getTime()) || c.accountId!==input.accountId || c.provider!==input.provider || c.localDate!==input.localDate || c.timezone!==input.timezone || c.expiresAt<=input.now) return {status:'unavailable',reason:'unqualified_calibration'};
  const paired=calibrateQuietWalkingRate({provider:input.provider,now:input.now,providerQuietKcalPerHour:m.providerKcalPerHour,samples:c.grossWalkingSamples??[]});
  if (!paired) return {status:'unavailable',reason:'unqualified_calibration'};
  return {status:'ready',basis:'matched_total_above_selected_quiet',rawIncrementalKcalPerStep:paired.caloriesPerStep,
    baselineModelVersion:input.modelVersion,calibrationVersion:c.sourceVersion,baselineProviderKcalPerHour:m.providerKcalPerHour,
    rawProjectedBurnBeforeWalking:input.rawProjectedBurnBeforeWalking,planningAnchorAt:input.planningAnchorAt.toISOString(),
    expiresAt:new Date(Math.min(input.planningExpiresAt.getTime(),c.expiresAt.getTime())).toISOString(),
    localDate:input.localDate,timezone:input.timezone,source:input.source,stepsPerMinute:paired.stepsPerMinute,walkingSampleCount:paired.sampleCount};
}
