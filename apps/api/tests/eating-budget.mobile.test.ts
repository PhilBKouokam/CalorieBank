import {describe,it,expect,vi} from 'vitest';
import type {TodayResponse,EatingBudgetResponse,EatPlanningResponse} from '@caloriebank/schemas';
import {selectEatingBudget,selectEatingPlan,eatingBudgetReason,selectEatingPlanningReason,eatingPlanningReason,selectEatingBudgetReason} from '../../mobile/lib/today/eating-budget-guidance';
vi.mock('../../mobile/lib/api/client',()=>({apiRequest:vi.fn()}));
import {fetchEatingBudget,fetchEatingPlan} from '../../mobile/lib/api/eating-budget';
const now=new Date('2026-02-10T12:05:00Z'),anchor='2026-02-10T12:00:00Z',expiry='2026-02-10T12:30:00Z',version=`g1:${'a'.repeat(64)}`;
function fixtures(){
 const q={status:'ready',baselineModelVersion:'r2',calibrationVersion:'walk1',baselineProviderKcalPerHour:60,rawProjectedBurnBeforeWalking:1920,planningAnchorAt:anchor,localDate:'2026-02-10',timezone:'UTC',source:'Synthetic',expiresAt:expiry,rawIncrementalKcalPerStep:.04};
 const today={date:q.localDate,timezone:q.timezone,guidanceContextVersion:version,steps:{source:q.source,count:10000,quietWalkingForecast:q},restOfDayProjection:{status:'ready',evidenceType:'historical_low_activity_hours',modelVersion:'r2',providerKcalPerHour:60,unroundedProjectedProviderBurnCalories:1920,planningAnchorAt:anchor}} as unknown as TodayResponse;
 const budget={version:1,localDate:q.localDate,timezone:q.timezone,guidanceContextVersion:version,signedGoalAdjustmentCalories:0,dailyBankTargetCalories:0,intake:{calories:null,semantic:'unknown'},budget:{status:'ready',estimated:true,totalCalories:1536,comparison:null,expiresAt:expiry,comparisonExpiresAt:null},planningAvailable:true,planningModel:{basis:'matched_total_above_selected_quiet',baselineModelVersion:'r2',calibrationVersion:'walk1',expiresAt:expiry,coverageAt:anchor,currentSteps:10000,rawProviderCaloriesPerAdditionalStep:.04,stepsPerMinute:100}} as EatingBudgetResponse;
 const response={version:1,localDate:q.localDate,timezone:q.timezone,snapshot:budget,plan:{status:'ready',hypothetical:true,totalSteps:12000,additionalSteps:2000,totalIntakeCalories:1600,expiresAt:expiry}} as EatPlanningResponse;
 return {today,budget,response};
}
describe('typed default-off Budget client boundary',()=>{
 it('makes zero transport calls with either client operation disabled',async()=>{const request=vi.fn();expect(await fetchEatingBudget('UTC',false,request)).toBeNull();expect(await fetchEatingPlan({direction:'steps_to_intake',totalSteps:12000},'UTC',false,request)).toBeNull();expect(request).not.toHaveBeenCalled();});
 it('treats old API 404 as unavailable',async()=>{const request=vi.fn(async()=>({status:404} as Response));expect(await fetchEatingBudget('UTC',true,request)).toBeNull();});
 it('admits total Budget without intake SLA, rejects stale and context/date generations',()=>{const {today,budget}=fixtures();expect(selectEatingBudget(today,budget,now,true)).toBe(budget);expect(selectEatingBudget(today,budget,now,false)).toBeNull();expect(selectEatingBudget(today,budget,new Date(expiry),true)).toBeNull();expect(selectEatingBudget(today,budget,new Date('2026-02-11T00:00:00Z'),true)).toBeNull();for(const token of [null,`g1:${'b'.repeat(64)}`])expect(selectEatingBudget({...today,guidanceContextVersion:token},budget,now,true)).toBeNull();expect(selectEatingBudget(today,{...budget,timezone:'America/Chicago'},now,true)).toBeNull();});
 it('admits only matching total-intake response and quiet calibration',()=>{const {today,budget,response}=fixtures();expect(selectEatingPlan(today,budget,response,12000,now,true)?.totalIntakeCalories).toBe(1600);expect(selectEatingPlan(today,budget,response,13000,now,true)).toBeNull();expect(selectEatingPlan(today,budget,response,12000,now,false)).toBeNull();expect(selectEatingPlan(today,budget,response,12000,new Date(expiry),true)).toBeNull();expect(selectEatingPlan(today,{...budget,planningModel:{...budget.planningModel!,baselineModelVersion:'old'}},response,12000,now,true)).toBeNull();expect(selectEatingPlan(today,budget,{...response,snapshot:{...budget,guidanceContextVersion:null}},12000,now,true)).toBeNull();for(const patch of [{calibrationVersion:'other'},{rawProviderCaloriesPerAdditionalStep:.06},{currentSteps:10001},{expiresAt:'2026-02-10T12:04:00Z'}])expect(selectEatingPlan(today,budget,{...response,snapshot:{...budget,planningModel:{...budget.planningModel!,...patch}}},12000,now,true)).toBeNull();});
 it('gives plain alignment and goal reasons',()=>{expect(eatingBudgetReason('shared_step_alignment_unverified')).toContain('matching steps');expect(eatingBudgetReason('goal_not_configured')).toContain('fitness goal');});
});


describe('planning-only diagnostics',()=>{
 it('preserves a coherent unavailable reason without admitting its numeric budget',()=>{
  const {today,budget}=fixtures();const unavailable={...budget,budget:{status:'unavailable',reason:'expenditure_cutoff_unverified'},planningAvailable:false,planningModel:null} as EatingBudgetResponse;
  const before=JSON.stringify({today,unavailable});
  expect(selectEatingBudget(today,unavailable,now,true)).toBeNull();
  expect(selectEatingPlanningReason(today,unavailable,now,true)).toBe('expenditure_cutoff_unverified');
  expect(eatingPlanningReason(selectEatingPlanningReason(today,unavailable,now,true))).toContain('link food totals with walking steps');
  expect(JSON.stringify({today,unavailable})).toBe(before);
 });
 it('does not present reasons from disallowed, mismatched, previous-day or stale context',()=>{
  const {today,budget}=fixtures();const unavailable={...budget,budget:{status:'unavailable',reason:'expenditure_cutoff_unverified'}} as EatingBudgetResponse;
  expect(selectEatingPlanningReason(today,unavailable,now,false)).toBeNull();
  for(const t of [{...today,guidanceContextVersion:null},{...today,guidanceContextVersion:`g1:${'b'.repeat(64)}`},{...today,date:'2026-02-09'},{...today,timezone:'America/Chicago'},{...today,restOfDayProjection:{...today.restOfDayProjection,status:'stale'}},{...today,restOfDayProjection:{...today.restOfDayProjection,planningExpiresAt:now.toISOString()}},{...today,restOfDayProjection:{...today.restOfDayProjection,coverageAt:'2026-02-10T11:00:00Z'}},{...today,restOfDayProjection:{...today.restOfDayProjection,planningAnchorAt:'2026-02-10T13:00:00Z'}}] as TodayResponse[])expect(selectEatingPlanningReason(t,unavailable,now,true)).toBeNull();
  expect(selectEatingPlanningReason(today,budget,new Date(expiry),true)).toBe('stale_expenditure');
  expect(selectEatingPlanningReason(today,{...budget,planningModel:{...budget.planningModel!,expiresAt:now.toISOString()}},now,true)).toBe('stale_expenditure');
 });
 it('keeps projected and unknown errors out of food-linked explanations',()=>{
  expect(eatingPlanningReason('projected_burn_unavailable')).toBe('Food-and-walking planning isn’t available yet.');
  expect(eatingPlanningReason('walking_calibration_unavailable')).not.toContain('matching steps');
  expect(eatingPlanningReason('shared_step_alignment_unverified')).toContain('matching steps');
  expect(eatingPlanningReason('stale_expenditure')).toContain('out of date');
 });
});


it('keeps expired projected-total copy separate from an unavailable strict Budget',()=>{
 const {today,budget}=fixtures();today.burned={status:'ready'} as TodayResponse['burned'];today.restOfDayProjection={...today.restOfDayProjection,planningExpiresAt:expiry,projectedAdjustedBurnCalories:3000};
 const projected={...budget,budget:{status:'unavailable',reason:'expenditure_cutoff_unverified'},projectedEstimate:{status:'ready',estimated:true,basis:'caloriebank_adjusted_projection',totalCalories:2200,projectedAdjustedBurnCalories:3000,expiresAt:expiry}} as EatingBudgetResponse;
 expect(selectEatingBudgetReason(today,projected,now,true)).toBeNull();
 expect(selectEatingBudgetReason(today,projected,new Date(expiry),true)).toBe('projected_burn_stale');
 expect(selectEatingBudgetReason({...today,guidanceContextVersion:null},projected,now,true)).toBeNull();
 expect(selectEatingBudgetReason(today,projected,now,false)).toBeNull();
 expect(selectEatingBudgetReason(today,{...projected,projectedEstimate:{status:'unavailable',basis:'caloriebank_adjusted_projection',estimated:true,reason:'projected_burn_unavailable'}},now,true)).toBe('projected_burn_unavailable');
 expect(selectEatingBudgetReason(today,{...projected,projectedEstimate:undefined},now,true)).toBe('expenditure_cutoff_unverified');
});
