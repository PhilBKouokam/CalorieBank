import {resolveBudgetIntakeComparison,getLocalDateUtcBounds,type BudgetContext,type BudgetExpenditure,type BudgetIntake} from '@caloriebank/domain';
import {qualifiedRestingModelProvenance,GOOGLE_LOW_ACTIVITY_EVIDENCE_V2} from '../google-health/google-health-model-provenance';
import type {QualifiedBudgetPlanningModel} from './eating-budget.repository';
export type BudgetQualification={
 expenditure:'qualified'|'missing'|'identity_mismatch'|'cutoff_unverified'|'stale'|'not_ready';
 stepAlignment:'qualified'|'unverified';
 walkingModel:{baseline:'qualified'|'unqualified';baselineRequiredForBudget:boolean;calibration:'qualified'|'unavailable'|'unqualified'|'stale'|'baseline_mismatch'};
 intakeComparison:'unavailable'|'manual_day_estimate'|'observed_qualified'|'observed_coverage_unqualified';
};
export type ExpenditureQualificationEvidence={present:boolean;sourceMatches:boolean;ready:boolean;coverageAt:Date|null;anchorAt:Date|null;anchorKind:string|null;expiresAt:Date|null};
export function qualifiesBudgetBaseline(model:{provider:string;evidenceType:string;providerKcalPerHour:number;calculatedAt:Date}|null,provider:string,now:Date){
 if(!model||model.provider!==provider||!qualifiedRestingModelProvenance(model)||!Number.isFinite(model.providerKcalPerHour)||model.providerKcalPerHour<=0)return false;
 const age=now.getTime()-model.calculatedAt.getTime();
 return Number.isFinite(age)&&age<=30*86400000&&(model.evidenceType!==GOOGLE_LOW_ACTIVITY_EVIDENCE_V2||age>=0);
}
/** Evidence classification only; never synthesizes coverage, calibrations or an intake policy. */
export function assessBudgetQualification(input:{context:BudgetContext;expenditure:BudgetExpenditure|null;rawEvidence?:ExpenditureQualificationEvidence;baselineQualified:boolean;baselineModelVersion:string|null;model:QualifiedBudgetPlanningModel|null;intake:BudgetIntake|null}):BudgetQualification{
 const {context:c,model:m,intake}=input,x=input.expenditure;
 // Normalized BudgetExpenditure already carries an explicit coverage contract.
 const e=input.rawEvidence??(x?{present:true,sourceMatches:x.accountId===c.accountId&&x.sourceId===c.expenditureSourceId&&x.localDate===c.localDate&&x.timezone===c.timezone,ready:x.semantic!=='unknown',coverageAt:x.coverage==='verified'?x.coverageAt:null,anchorAt:x.coverageAt,anchorKind:x.coverage==='verified'?'verified_coverage':null,expiresAt:x.planningExpiresAt}:undefined);
 let expenditure:BudgetQualification['expenditure'];
 if(!e)expenditure='missing';
 else if(!e.present)expenditure='missing';
 else if(!e.sourceMatches)expenditure='identity_mismatch';
 else if(!e.coverageAt||!e.anchorAt||e.anchorKind!=='verified_coverage'||e.coverageAt.getTime()!==e.anchorAt.getTime())expenditure='cutoff_unverified';
 else {
  const bounds=getLocalDateUtcBounds(c.localDate,c.timezone),cutoff=e.coverageAt.getTime();
  if(!Number.isFinite(cutoff)||cutoff<bounds.start.getTime()||cutoff>c.now.getTime())expenditure='cutoff_unverified';
  else if(!e.expiresAt||!Number.isFinite(e.expiresAt.getTime())||c.now.getTime()>=Math.min(cutoff+30*60000,e.expiresAt.getTime(),bounds.end.getTime()))expenditure='stale';
  else expenditure=e.ready?'qualified':'not_ready';
 }
 const identity=Boolean(m&&m.accountId===c.accountId&&m.sourceId===c.expenditureSourceId&&m.localDate===c.localDate&&m.timezone===c.timezone);
 const cutoff=e?.coverageAt??input.expenditure?.coverageAt;
 const aligned=Boolean(m&&m.qualified&&Number.isSafeInteger(m.currentSteps)&&m.currentSteps>=0&&identity&&expenditure==='qualified'&&cutoff&&m.currentStepsAt?.getTime()===cutoff.getTime());
 let calibration:BudgetQualification['walkingModel']['calibration']='unavailable';
 if(m){
  const proof=m.evidence;
  if(!identity||!proof||proof.basis!=='matched_total_above_selected_quiet'||!proof.calibrationVersion||!Number.isFinite(m.providerCaloriesPerAdditionalStep)||m.providerCaloriesPerAdditionalStep<=0||m.stepsPerMinute===null||!Number.isFinite(m.stepsPerMinute)||m.stepsPerMinute<=0)calibration='unqualified';
  else if(!Number.isFinite(proof.expiresAt.getTime())||proof.expiresAt<=c.now)calibration='stale';
  else if(proof.baselineModelVersion!==input.baselineModelVersion)calibration='baseline_mismatch';
  else calibration='qualified';
 }
 let intakeComparison:BudgetQualification['intakeComparison']='unavailable';
 if(intake&&intake.accountId===c.accountId&&intake.sourceId===c.intakeSourceId&&intake.localDate===c.localDate&&intake.timezone===c.timezone){
  // Reuse the approved domain's intake validation independently of missing burn/steps.
  const checked=resolveBudgetIntakeComparison(c,0,intake);
  if(checked?.kind==='estimated_day_difference')intakeComparison='manual_day_estimate';
  else if(intake.semantic==='observed_current_day_intake')intakeComparison=checked?.kind==='remaining_today'?'observed_qualified':'observed_coverage_unqualified';
 }
 return {expenditure,stepAlignment:aligned?'qualified':'unverified',walkingModel:{baseline:input.baselineQualified?'qualified':'unqualified',baselineRequiredForBudget:input.expenditure?.semantic!=='verified_full_day_estimate',calibration},intakeComparison};
}
export function budgetQualificationReason(q:BudgetQualification){
 if(q.expenditure!=='qualified')return q.expenditure==='cutoff_unverified'?'expenditure_cutoff_unverified':q.expenditure==='stale'?'stale_expenditure':q.expenditure==='identity_mismatch'?'identity_mismatch':q.expenditure==='not_ready'?'expenditure_not_ready':'missing_expenditure';
 return q.walkingModel.baselineRequiredForBudget&&q.walkingModel.baseline!=='qualified'?'baseline_unqualified':null;
}
export function planningQualificationReason(q:BudgetQualification){
 const burn=budgetQualificationReason(q);if(burn)return burn;
 const c=q.walkingModel.calibration;
 if(c!=='qualified')return c==='unavailable'?'walking_calibration_unavailable':c==='stale'?'walking_calibration_stale':c==='baseline_mismatch'?'baseline_calibration_mismatch':'walking_calibration_unqualified';
 return q.stepAlignment!=='qualified'?'step_alignment_unverified':null;
}
