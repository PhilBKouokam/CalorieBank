import {projectedBurnGuidance} from './projected-burn-guidance';
import type {EatingBudgetResponse,EatPlanningResponse,TodayResponse} from '@caloriebank/schemas';
import {currentDateSnapshot} from './current-date';
import {selectQuietWalkingForecast} from './quiet-walking-forecast';
/** Equality is a coherence token, never authorization or proof of coverage. */
export function selectEatingBudget(today:TodayResponse|null,budget:EatingBudgetResponse|null,now:Date,allowed:boolean){
 if(!allowed||!today||!currentDateSnapshot(today,now)||!budget||!today.guidanceContextVersion||budget.guidanceContextVersion!==today.guidanceContextVersion||budget.localDate!==today.date||budget.timezone!==today.timezone||budget.budget.status==='unavailable'||Date.parse(budget.budget.expiresAt)<=now.getTime())return null;
 return budget;
}
function selectCoherentPlan(today:TodayResponse|null,budget:EatingBudgetResponse|null,response:EatPlanningResponse|null,now:Date,allowed:boolean){
 const b=selectEatingBudget(today,budget,now,allowed),returned=selectEatingBudget(today,response?.snapshot??null,now,allowed),q=today?selectQuietWalkingForecast(today,now):null,m=b?.planningModel;
 if(!b||!returned||!returned.planningAvailable||!returned.planningModel||!b.planningAvailable||!m||!q||!response||response.plan.status!=='ready'||response.localDate!==b.localDate||response.timezone!==b.timezone||response.snapshot.guidanceContextVersion!==b.guidanceContextVersion||Date.parse(response.plan.expiresAt)<=now.getTime()||Date.parse(m.expiresAt)<=now.getTime()||m.baselineModelVersion!==q.baselineModelVersion||m.calibrationVersion!==q.calibrationVersion||m.rawProviderCaloriesPerAdditionalStep!==q.rawIncrementalKcalPerStep||m.coverageAt!==q.planningAnchorAt||m.currentSteps!==today!.steps.count)return null;
 const rm=returned.planningModel;
 if(rm.basis!==m.basis||rm.baselineModelVersion!==m.baselineModelVersion||rm.calibrationVersion!==m.calibrationVersion||rm.rawProviderCaloriesPerAdditionalStep!==m.rawProviderCaloriesPerAdditionalStep||rm.stepsPerMinute!==m.stepsPerMinute||rm.currentSteps!==m.currentSteps||rm.coverageAt!==m.coverageAt||rm.expiresAt!==m.expiresAt||Date.parse(rm.expiresAt)<=now.getTime()||response.plan.totalSteps<m.currentSteps||response.plan.additionalSteps!==response.plan.totalSteps-m.currentSteps)return null;
 return response.plan;
}
export function selectEatingPlan(today:TodayResponse|null,budget:EatingBudgetResponse|null,response:EatPlanningResponse|null,totalSteps:number,now:Date,allowed:boolean){
 const plan=selectCoherentPlan(today,budget,response,now,allowed);
 return plan&&budget?.planningModel&&plan.totalSteps===Math.max(totalSteps,budget.planningModel.currentSteps)?plan:null;
}
export type BoundIntakePlan={requestedTotalIntakeCalories:number;response:EatPlanningResponse|null};
export function selectStepsForIntake(today:TodayResponse|null,budget:EatingBudgetResponse|null,bound:BoundIntakePlan|null,desired:number,now:Date,allowed:boolean){
 if(!Number.isSafeInteger(desired)||desired<0||bound?.requestedTotalIntakeCalories!==desired)return null;
 const plan=selectCoherentPlan(today,budget,bound.response,now,allowed);
 return plan&&plan.totalIntakeCalories>=desired?plan:null;
}
export function eatingComparison(budget:EatingBudgetResponse|null,now:Date){
 if(!budget||budget.budget.status!=='ready')return {kind:'unavailable' as const,text:'Your daily eating estimate is unavailable.'};
 const b=budget.budget,c=b.comparison;
 if(Date.parse(b.expiresAt)<=now.getTime())return {kind:'unavailable' as const,text:'Refresh your daily eating estimate.'};
 if(!c||!b.comparisonExpiresAt||Date.parse(b.comparisonExpiresAt)<=now.getTime())return {kind:'unavailable' as const,text:budget.intake.semantic==='estimated_total_day_intake'?'Your whole-day food estimate cannot be compared right now.':budget.intake.semantic==='unknown'||budget.intake.calories===null?'Food data isn’t available to show a remaining amount.':'Food data doesn’t yet support a remaining amount.'};
 if(c.kind==='remaining_today'&&budget.intake.semantic==='observed_current_day_intake')return {kind:'remaining_today' as const,calories:c.calories};
 if(c.kind==='estimated_day_difference'&&budget.intake.semantic==='estimated_total_day_intake')return {kind:'estimated_day_difference' as const,calories:c.calories};
 return {kind:'unavailable' as const,text:'Your food estimate cannot be compared right now.'};
}
export function eatingBudgetReason(reason?:string|null){
 if(reason==='projected_burn_unavailable')return 'Your projected burn isn’t available for an eating estimate yet.';
 if(reason==='projected_burn_stale')return 'Your projected burn estimate is out of date.';
 if(reason==='non_positive_projected_budget')return 'Review your goal and banking target before using this eating estimate.';
 if(reason==='goal_not_configured')return 'Set your fitness goal to see an eating estimate.';
 if(reason==='expenditure_cutoff_unverified'||reason==='expenditure_not_ready')return 'Your burn data doesn’t yet support an eating estimate.';
 if(reason==='baseline_unqualified'||reason==='baseline_calibration_mismatch')return 'Your daily burn estimate isn’t ready for eating planning.';
 if(reason==='walking_calibration_unavailable'||reason==='walking_calibration_unqualified'||reason==='walking_calibration_stale')return 'Your walking estimate isn’t ready for eating planning.';
 if(reason==='stale_expenditure')return 'This eating estimate is out of date.';
 if(reason==='step_alignment_unverified'||reason==='shared_step_alignment_unverified'||reason==='qualified_activity_model_unavailable')return 'Your eating estimate needs matching steps and calorie-burn data.';
 if(reason)return 'Your eating estimate needs a reliable, up-to-date burn estimate.';
 return 'Your eating budget isn’t available yet.';
}

/** Separate estimate selector: never casts this basis into verified step/intake guidance. */
export function selectProjectedEatingBudget(today:TodayResponse|null,budget:EatingBudgetResponse|null,now:Date,allowed:boolean){
 const p=budget?.projectedEstimate;
 if(!allowed||!today||!budget||!today.guidanceContextVersion||today.guidanceContextVersion!==budget.guidanceContextVersion||today.date!==budget.localDate||today.timezone!==budget.timezone||!currentDateSnapshot(today,now)||!p||p.status==='unavailable'||Date.parse(p.expiresAt)<=now.getTime()||p.projectedAdjustedBurnCalories!==projectedBurnGuidance(today,now,allowed))return null;
 return p;
}
