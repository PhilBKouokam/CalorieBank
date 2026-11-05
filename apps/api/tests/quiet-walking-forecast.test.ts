import { describe, expect, it } from 'vitest';
import { calibrateQuietWalkingRate, calibrateNetStepRate, calculateBurnToStepPlan, calculateStepToBurnPlan, calculateAnchoredRestProjection, prepareStepPlanningSnapshot, traceBurnToStepPlan, type GrossWalkingSample } from '@caloriebank/domain';
import { buildQuietWalkingForecast, quietBaselineVersion } from '../src/modules/today/quiet-walking-forecast';
import { selectQuietWalkingForecast } from '../../mobile/lib/today/quiet-walking-forecast';
import type { TodayResponse } from '@caloriebank/schemas';
const now=new Date('2026-02-10T12:00:00Z'),start=new Date('2026-02-09T10:00:00Z'),end=new Date('2026-02-09T11:00:00Z');
const sample:GrossWalkingSample={id:'synthetic-walk',provider:'google_health_fitbit',activityType:'walking',steps:{count:6000,start,end},totalEnergy:{calories:300,start,end}};
const model={provider:sample.provider,evidenceType:'historical_low_activity_hours_v2',providerKcalPerHour:60,calculatedAt:now};
const input=()=>({accountId:'synthetic-account',provider:sample.provider,source:'Fitbit',localDate:'2026-02-10',timezone:'UTC',now,
 currentInputsQualified:true,baselineQualified:true,model,modelVersion:quietBaselineVersion(model),rawProjectedBurnBeforeWalking:1920,planningAnchorAt:now,planningExpiresAt:new Date(now.getTime()+30*60000),
 calibration:{accountId:'synthetic-account',provider:sample.provider,localDate:'2026-02-10',timezone:'UTC',sourceVersion:'synthetic-version',expiresAt:new Date(now.getTime()+5*60000),samples:[],grossWalkingSamples:[sample]}});
describe('quiet-baseline-compatible walking planning',()=>{
 it('subtracts the chosen quiet counterfactual from matched TOTAL, keeping active contribution unchanged',()=>{
  expect(calibrateQuietWalkingRate({provider:sample.provider,now,providerQuietKcalPerHour:60,samples:[sample]})?.caloriesPerStep).toBe(.04);
  const active=calibrateNetStepRate({provider:sample.provider,activityType:'walking',now,samples:[{id:sample.id,provider:sample.provider,activityType:'walking',steps:sample.steps,energy:{calories:120,start,end,basis:'active_above_rest'}}]});
  expect(active?.caloriesPerStep).toBe(.02);expect(buildQuietWalkingForecast(input()).status).toBe('ready');
 });
 it.each(['missing_end','running','overlap','nonpositive'] as const)('rejects %s evidence without imputing missing measurements',mode=>{
  let samples=[sample],rate=60;
  if(mode==='missing_end')samples=[{...sample,totalEnergy:{...sample.totalEnergy,end:new Date(end.getTime()-60000)}}];
  if(mode==='running')samples=[{...sample,activityType:'running'}];
  if(mode==='overlap')samples=[sample,{...sample,id:'synthetic-other'}];
  if(mode==='nonpositive')rate=300;
  expect(calibrateQuietWalkingRate({provider:sample.provider,now,providerQuietKcalPerHour:rate,samples})).toBeNull();
 });
 it('binds provider/account/date/timezone/expiry and withholds unavailable complete gross evidence',()=>{
  for(const patch of [{accountId:'another'}, {provider:'apple_health'}, {localDate:'2026-02-11'}, {timezone:'America/Chicago'}, {expiresAt:now}, {grossWalkingSamples:[]}]){
   const i=input();i.calibration={...i.calibration,...patch};expect(buildQuietWalkingForecast(i).status).toBe('unavailable');
  }
  expect(buildQuietWalkingForecast({...input(),currentInputsQualified:false}).status).toBe('unavailable');
  expect(buildQuietWalkingForecast({...input(),baselineQualified:false}).status).toBe('unavailable');
 });
 it('re-derives against a new baseline version instead of caching the old coupled coefficient',()=>{
  const a=buildQuietWalkingForecast(input()),m={...model,providerKcalPerHour:120};
  const b=buildQuietWalkingForecast({...input(),model:m,modelVersion:quietBaselineVersion(m)});
  expect(a.status==='ready'&&a.rawIncrementalKcalPerStep).toBe(.04);expect(b.status==='ready'&&b.rawIncrementalKcalPerStep).toBe(.03);
  expect(a.status==='ready'&&b.status==='ready'&&a.baselineModelVersion!==b.baselineModelVersion).toBe(true);
 });
 it('keeps TOTAL stable through a matched walk, remaining steps decrease, and forward/inverse use .8 once',()=>{
  const before={currentSteps:10000,projectedProviderBurnAtRest:1200+60*12,providerCaloriesPerStep:.04,adjustmentFactor:.8,targetActualBurnCalories:2000};
  const a=calculateBurnToStepPlan(before),b=calculateBurnToStepPlan({...before,currentSteps:16000,projectedProviderBurnAtRest:1500+60*11});
  expect(a.totalDailyStepsNeeded).toBe(24500);expect(b.totalDailyStepsNeeded).toBe(24500);expect(a.remainingSteps-b.remainingSteps).toBe(6000);
  expect(calculateStepToBurnPlan({...before,targetSteps:a.totalDailyStepsNeeded}).projectedAdjustedBurnCalories).toBe(2000);
  expect(calculateBurnToStepPlan({...before,providerCaloriesPerStep:.02}).totalDailyStepsNeeded).toBe(39000);
  expect(calculateBurnToStepPlan({...before,currentSteps:16000,projectedProviderBurnAtRest:2160,providerCaloriesPerStep:.02}).totalDailyStepsNeeded).toBe(33000);
 });
 it('rejects mixed client versions, changed model, expiry or a stale baseline; absence never means compatible active fallback',()=>{
  const q=buildQuietWalkingForecast(input());if(q.status!=='ready')throw Error('fixture');
  const today={date:'2026-02-10',timezone:'UTC',steps:{source:'Fitbit',quietWalkingForecast:q},restOfDayProjection:{status:'ready',evidenceType:'historical_low_activity_hours',providerKcalPerHour:60,modelVersion:q.baselineModelVersion,unroundedProjectedProviderBurnCalories:1920,planningAnchorAt:now.toISOString()}} as unknown as TodayResponse;
  expect(selectQuietWalkingForecast(today,now)).toEqual(q);
  expect(selectQuietWalkingForecast({...today,steps:{...today.steps,quietWalkingForecast:undefined}},now)).toBeNull();
  expect(selectQuietWalkingForecast({...today,restOfDayProjection:{...today.restOfDayProjection,modelVersion:'changed'}},now)).toBeNull();
  expect(selectQuietWalkingForecast(today,new Date(q.expiresAt))).toBeNull();
  expect(selectQuietWalkingForecast({...today,restOfDayProjection:{...today.restOfDayProjection,unroundedProjectedProviderBurnCalories:2000}},now)).toBeNull();
 });
});

it('quiet-compatible clock/verified bridge/catch-up replaces credit once',()=>{
 const anchor=new Date('2026-02-10T12:00:00Z');
 const projected=(at:Date)=>calculateAnchoredRestProjection({observedProviderCalories:1200,providerRestCaloriesPerHour:60,anchor,now:at,localDate:'2026-02-10',timezone:'UTC'})!.unroundedProjectedProviderBurnCalories;
 expect(projected(new Date('2026-02-10T12:10:00Z'))).toBe(projected(anchor));
 const common={providerCaloriesPerStep:.04,adjustmentFactor:.8};
 const reference={version:'synthetic-old',kind:'verified_shared_cutoff' as const,rawObservedProviderKcal:1200,referenceAt:anchor.toISOString(),baselineKind:'low_activity_total' as const,walkingEnergyBasis:'matched_quiet_background_replacement' as const};
 const pending=prepareStepPlanningSnapshot({...common,currentSteps:11000,projectedProviderBurnAtRest:1920,reference,bridge:{referenceVersion:'synthetic-old',stepsAtReference:10000,walkingSteps:1000,incidentalSteps:0}})!;
 const caught=prepareStepPlanningSnapshot({...common,currentSteps:11000,projectedProviderBurnAtRest:1960,reference:{...reference,version:'synthetic-new',rawObservedProviderKcal:1250,referenceAt:'2026-02-10T12:10:00Z'}})!;
 expect(traceBurnToStepPlan(pending,2000).plan).toEqual(traceBurnToStepPlan(caught,2000).plan);
 expect(pending.trace.energyCompatibility).toBe('matched_quiet_background_replacement');
});
