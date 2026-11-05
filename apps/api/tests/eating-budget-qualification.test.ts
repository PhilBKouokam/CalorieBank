import {describe,it,expect} from 'vitest';
import {calculateEatingBudget,type BudgetContext,type BudgetExpenditure,type BudgetIntake} from '@caloriebank/domain';
import {assessBudgetQualification,budgetQualificationReason,planningQualificationReason,qualifiesBudgetBaseline,type ExpenditureQualificationEvidence} from '../src/modules/eating-budget/eating-budget.qualification';
import type {QualifiedBudgetPlanningModel} from '../src/modules/eating-budget/eating-budget.repository';
import {eatingBudgetReason,eatingComparison} from '../../mobile/lib/today/eating-budget-guidance';
import type {EatingBudgetResponse} from '@caloriebank/schemas';
const now=new Date('2026-02-10T12:00:00Z'),cutoff=new Date('2026-02-10T11:55:00Z'),expires=new Date('2026-02-10T12:25:00Z');
function fixture(){
 const context:BudgetContext={accountId:'synthetic-owner',expenditureSourceId:'google_health_fitbit',intakeSourceId:'synthetic-intake',localDate:'2026-02-10',timezone:'UTC',now,signedGoalAdjustmentCalories:-500,dailyBankTargetCalories:100};
 const identity={accountId:context.accountId,sourceId:context.expenditureSourceId,localDate:context.localDate,timezone:context.timezone};
 const expenditure:BudgetExpenditure={...identity,semantic:'accumulated',rawProviderCalories:2000,coverage:'verified',coverageAt:cutoff,planningExpiresAt:expires,remainingRest:{rawProviderCalories:1000,from:cutoff,through:new Date('2026-02-11T00:00:00Z'),qualified:true}};
 const rawEvidence:ExpenditureQualificationEvidence={present:true,sourceMatches:true,ready:true,coverageAt:cutoff,anchorAt:cutoff,anchorKind:'verified_coverage',expiresAt:expires};
 const intake:BudgetIntake={...identity,sourceId:context.intakeSourceId,semantic:'observed_current_day_intake',calories:1000,coverage:null,correction:null};
 const model:QualifiedBudgetPlanningModel={...identity,qualified:true,currentSteps:5000,currentStepsAt:cutoff,providerCaloriesPerAdditionalStep:.05,stepsPerMinute:100,evidence:{basis:'matched_total_above_selected_quiet',baselineModelVersion:'synthetic-baseline',calibrationVersion:'synthetic-walk',expiresAt:expires}};
 return {context,expenditure,rawEvidence,intake,model,baselineQualified:true,baselineModelVersion:'synthetic-baseline'};
}
describe('independent eating guidance qualification',()=>{
 it('keeps missing coverage, baseline, calibration and intake policy separate',()=>{
  const f=fixture(),q=assessBudgetQualification({...f,model:null,expenditure:null,rawEvidence:{...f.rawEvidence,coverageAt:null,anchorKind:'reported_interval'}});
  expect(q).toEqual({expenditure:'cutoff_unverified',stepAlignment:'unverified',walkingModel:{baseline:'qualified',baselineRequiredForBudget:true,calibration:'unavailable'},intakeComparison:'observed_coverage_unqualified'});
  expect(budgetQualificationReason(q)).toBe('expenditure_cutoff_unverified');expect(planningQualificationReason(q)).toBe('expenditure_cutoff_unverified');
 });
 it('does not describe absent calibration as a proven step-alignment defect',()=>{
  const q=assessBudgetQualification({...fixture(),model:null});expect(q.stepAlignment).toBe('unverified');expect(planningQualificationReason(q)).toBe('walking_calibration_unavailable');
 });
 it('separates valid calibration from unmatched current-step horizon',()=>{
  const f=fixture(),q=assessBudgetQualification({...f,model:{...f.model,currentStepsAt:new Date('2026-02-10T11:56:00Z')}});expect(q.walkingModel.calibration).toBe('qualified');expect(planningQualificationReason(q)).toBe('step_alignment_unverified');
  expect(planningQualificationReason(assessBudgetQualification(f))).toBeNull();
 });
 it('does not upgrade reported buckets, retrieval time or same-session readiness',()=>{
  for(const kind of ['reported_interval','sample_horizon','retrieval_assumption']){const f=fixture();expect(assessBudgetQualification({...f,rawEvidence:{...f.rawEvidence,coverageAt:null,anchorKind:kind}}).expenditure).toBe('cutoff_unverified');}
 });
 it('rejects future/stale/source-mismatched expenditure evidence independently',()=>{
  const f=fixture();expect(assessBudgetQualification({...f,rawEvidence:{...f.rawEvidence,coverageAt:new Date('2026-02-10T12:01:00Z'),anchorAt:new Date('2026-02-10T12:01:00Z')}}).expenditure).toBe('cutoff_unverified');
  expect(assessBudgetQualification({...f,rawEvidence:{...f.rawEvidence,expiresAt:now}}).expenditure).toBe('stale');expect(assessBudgetQualification({...f,rawEvidence:{...f.rawEvidence,sourceMatches:false}}).expenditure).toBe('identity_mismatch');
 });
 it('preserves existing v2/legacy and30day baseline admission without a7day display policy',()=>{
  const m={provider:'google_health_fitbit',evidenceType:'historical_low_activity_hours_v2',providerKcalPerHour:80,calculatedAt:new Date('2026-02-02T12:00:00Z')};
  expect(qualifiesBudgetBaseline(m,m.provider,now)).toBe(true);expect(qualifiesBudgetBaseline({...m,evidenceType:'historical_low_activity_hours'},m.provider,now)).toBe(false);
  expect(qualifiesBudgetBaseline({...m,calculatedAt:new Date('2026-01-10T12:00:00Z')},m.provider,now)).toBe(false);expect(qualifiesBudgetBaseline({...m,calculatedAt:new Date('2026-02-11T12:00:00Z')},m.provider,now)).toBe(false);expect(qualifiesBudgetBaseline(m,'apple_health',now)).toBe(false);
  expect(qualifiesBudgetBaseline({...m,provider:'apple_health',evidenceType:'provider_resting_energy'},'apple_health',now)).toBe(true);
  const f=fixture();expect(assessBudgetQualification({...f,baselineQualified:false,rawEvidence:{...f.rawEvidence,coverageAt:null}}).walkingModel.baseline).toBe('unqualified');expect(budgetQualificationReason(assessBudgetQualification({...f,baselineQualified:false}))).toBe('baseline_unqualified');
 });
 it('requires no observed-intake SLA for total Budget or manual whole-day comparisons',()=>{
  const f=fixture();expect(calculateEatingBudget(f.context,f.expenditure,f.intake)).toMatchObject({status:'ready',totalCalories:1800,comparison:null});
  expect(assessBudgetQualification({...f,intake:{...f.intake,semantic:'estimated_total_day_intake'}}).intakeComparison).toBe('manual_day_estimate');
 });
 it('reuses exact approved observed-intake validation rather than guessing freshness',()=>{
  const f=fixture(),intake={...f.intake,coverage:{verified:true,policyId:'synthetic-approved-policy',through:cutoff,expiresAt:expires}};
  expect(assessBudgetQualification({...f,intake}).intakeComparison).toBe('observed_qualified');expect(assessBudgetQualification({...f,intake:{...intake,coverage:{...intake.coverage,expiresAt:now}}}).intakeComparison).toBe('observed_coverage_unqualified');
  expect(assessBudgetQualification({...f,intake:{...intake,sourceId:'different-source'}}).intakeComparison).toBe('unavailable');
 });
 it('uses plain consumer reasons without promising another sync fixes unsupported evidence',()=>{
  for(const reason of ['expenditure_cutoff_unverified','baseline_unqualified','walking_calibration_unavailable','step_alignment_unverified']){const copy=eatingBudgetReason(reason);expect(copy).not.toMatch(/cutoff|SLA|model|sync|refresh/i);expect(copy).not.toContain('daily budget isn’t available yet');}
  const b={budget:{status:'ready',expiresAt:expires.toISOString(),comparison:null,comparisonExpiresAt:null},intake:{semantic:'observed_current_day_intake',calories:1000}} as EatingBudgetResponse;
  expect(eatingComparison(b,now)).toMatchObject({kind:'unavailable',text:'Food data doesn’t yet support a remaining amount.'});expect(eatingComparison({...b,intake:{semantic:'unknown',calories:null}},now)).toMatchObject({kind:'unavailable',text:'Food data isn’t available to show a remaining amount.'});
 });
});

it('preserves the approved verified full-day semantic without requiring a future-rest baseline',()=>{
 const f=fixture(),full={...f.expenditure,semantic:'verified_full_day_estimate' as const,remainingRest:null};
 const q=assessBudgetQualification({...f,expenditure:full,baselineQualified:false,model:null});expect(q.walkingModel.baseline).toBe('unqualified');expect(q.walkingModel.baselineRequiredForBudget).toBe(false);expect(budgetQualificationReason(q)).toBeNull();expect(calculateEatingBudget(f.context,full,null).status).toBe('ready');
});

it('validates normalized fallback identity and freshness rather than trusting its verified label alone',()=>{
 const input=fixture();
 const f={context:input.context,expenditure:input.expenditure,intake:input.intake,model:input.model,baselineQualified:input.baselineQualified,baselineModelVersion:input.baselineModelVersion};
 for(const change of [{accountId:'different-owner'},{sourceId:'different-source'},{localDate:'2026-02-09'},{timezone:'America/Chicago'}])expect(assessBudgetQualification({...f,expenditure:{...f.expenditure,...change}}).expenditure).toBe('identity_mismatch');
 expect(assessBudgetQualification({...f,expenditure:{...f.expenditure,coverageAt:new Date('2026-02-10T12:01:00Z')}}).expenditure).toBe('cutoff_unverified');
 expect(assessBudgetQualification({...f,expenditure:{...f.expenditure,planningExpiresAt:now}}).expenditure).toBe('stale');
 expect(assessBudgetQualification({...f,expenditure:{...f.expenditure,coverage:'unverified'}}).expenditure).toBe('cutoff_unverified');
});
