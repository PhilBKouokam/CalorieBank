import type { NormalizedCurrentDayWorkout, NormalizedDailyIntakeAggregate, NormalizedDailyStepAggregate } from '@caloriebank/domain';

/** Read-only qualification, separate from capability to become a selected bank source. */
export type EvidenceCategory = 'nutrition' | 'steps' | 'workouts' | 'active_energy' | 'total_energy' | 'resting_rate' | 'distance';
export type NativeAvailability = 'available' | 'setup_required' | 'permissions_missing' | 'partial_permissions' | 'unavailable' | 'unsupported_version' | 'native_query_failed';
export type NativeAccess = { state: NativeAvailability; granted: EvidenceCategory[]; missing: EvidenceCategory[] };
export type SourceIdentity = { namespace: 'android_package'; id: string };
export type EvidenceWindow = { localDate: string; timezone: string; start: string; end: string; isCurrentDay: boolean };
export type EvidenceQuality = 'usable_evidence' | 'empty' | 'permission_missing' | 'query_failed' | 'ambiguous_overlap' | 'boundary_ambiguous' | 'invalid_records' | 'no_calorie_records';
export type QualifiedIntake = Pick<NormalizedDailyIntakeAggregate, 'totalCaloriesConsumed' | 'providerUpdatedAt'>;
export type QualifiedSteps = Pick<NormalizedDailyStepAggregate, 'totalSteps' | 'providerUpdatedAt'>;
export type QualifiedActivity = Pick<NormalizedCurrentDayWorkout, 'providerWorkoutId' | 'activityType' | 'displayName' | 'startedAt' | 'endedAt' | 'durationMinutes' | 'totalEnergyBurned' | 'totalSteps' | 'totalDistance' | 'distanceUnit' | 'providerUpdatedAt'>;
export type DayEvidence = {
  window: EvidenceWindow; source: SourceIdentity;
  intake: { quality: EvidenceQuality; value: QualifiedIntake | null };
  steps: { quality: EvidenceQuality; value: QualifiedSteps | null };
  activityEvidence: QualifiedActivity[];
  // Session records have no reliable calorie/step association in the selected bridge.
  walkingCalibration: 'insufficient_paired_evidence';
  caloriesBurned: null; burnQualification: 'not_qualified';
  burnEvidence: { totalRecordCount: number; activeRecordCount: number; restingRateRecordCount: number; coverage: 'complete_intervals' | 'gaps' | 'none' | 'ambiguous'; quality: EvidenceQuality };
  providerUpdatedAt: string | null;
};
export type QualificationReport = {
  state: 'complete' | 'no_records' | 'access_required' | 'query_failed' | 'changed_during_read' | 'cancelled';
  access: NativeAccess; observedAt: string; queryStartedAt: string; generation: number;
  windows: EvidenceWindow[]; origins: SourceIdentity[];
  originState: 'not_selected' | 'observed' | 'not_observed' | 'previously_observed_now_absent';
  providerUpdatedAt: string | null;
  counts: Partial<Record<EvidenceCategory, number>>;
  days: DayEvidence[];
  readConsistency: 'stable_read' | 'unproven';
  forecastEligible: false; authoritative: false;
};
export interface NativeHealthQualification {
  access(request?: boolean): Promise<NativeAccess>;
  inspect(origin?: string): Promise<QualificationReport>;
  openSettings(): Promise<boolean>;
  cancel(): void;
}
