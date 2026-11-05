import type {EatingBudgetResponse,EatPlanningResponse,TodayResponse} from '@caloriebank/schemas';
import {currentDateSnapshot} from './current-date';
import {selectQuietWalkingForecast} from './quiet-walking-forecast';
/** Equality is a coherence token, never authorization or proof of coverage. */
export function selectEatingBudget(today:TodayResponse|null,budget:EatingBudgetResponse|null,now:Date,allowed:boolean){
 if(!allowed||!today||!currentDateSnapshot(today,now)||!budget||!today.guidanceContextVersion||budget.guidanceContextVersion!==today.guidanceContextVersion||budget.localDate!==today.date||budget.timezone!==today.timezone||budget.budget.status==='unavailable'||Date.parse(budget.budget.expiresAt)<=now.getTime())return null;
 return budget;
}
export function selectEatingPlan(today:TodayResponse|null,budget:EatingBudgetResponse|null,response:EatPlanningResponse|null,totalSteps:number,now:Date,allowed:boolean){
 const b=selectEatingBudget(today,budget,now,allowed),returned=selectEatingBudget(today,response?.snapshot??null,now,allowed),q=today?selectQuietWalkingForecast(today,now):null,m=b?.planningModel;
 if(!b||!returned||!returned.planningAvailable||!returned.planningModel||!b.planningAvailable||!m||!q||!response||response.plan.status!=='ready'||response.localDate!==b.localDate||response.timezone!==b.timezone||response.snapshot.guidanceContextVersion!==b.guidanceContextVersion||response.plan.totalSteps!==Math.max(totalSteps,m.currentSteps)||Date.parse(response.plan.expiresAt)<=now.getTime()||Date.parse(m.expiresAt)<=now.getTime()||m.baselineModelVersion!==q.baselineModelVersion||m.calibrationVersion!==q.calibrationVersion||m.rawProviderCaloriesPerAdditionalStep!==q.rawIncrementalKcalPerStep||m.coverageAt!==q.planningAnchorAt||m.currentSteps!==today!.steps.count)return null;
 const rm=returned.planningModel;
 if(rm.basis!==m.basis||rm.baselineModelVersion!==m.baselineModelVersion||rm.calibrationVersion!==m.calibrationVersion||rm.rawProviderCaloriesPerAdditionalStep!==m.rawProviderCaloriesPerAdditionalStep||rm.stepsPerMinute!==m.stepsPerMinute||rm.currentSteps!==m.currentSteps||rm.coverageAt!==m.coverageAt||rm.expiresAt!==m.expiresAt||Date.parse(rm.expiresAt)<=now.getTime())return null;
 return response.plan;
}
export function eatingBudgetReason(reason?:string|null){
 if(reason==='goal_not_configured')return 'Set your fitness goal to see an eating estimate.';
 if(reason==='shared_step_alignment_unverified'||reason==='qualified_activity_model_unavailable')return 'Your eating estimate needs matching steps and calorie-burn data.';
 if(reason)return 'Your eating estimate needs a reliable, up-to-date burn estimate.';
 return 'Your daily budget isn’t available yet.';
}
