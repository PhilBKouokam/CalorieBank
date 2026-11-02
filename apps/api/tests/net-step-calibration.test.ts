import {describe,it,expect} from 'vitest';
import {calibrateNetStepRate,calculateAnchoredRestProjection,calculateBurnToStepPlan,type NetStepSample} from '@caloriebank/domain';
const start=new Date('2026-10-30T08:00:00Z'),end=new Date('2026-10-30T09:00:00Z'),now=new Date('2026-10-30T10:00:00Z');
const sample=(basis:NetStepSample['energy']['basis']='active_above_rest'):NetStepSample=>({id:'synthetic',provider:'synthetic',activityType:'walking',steps:{count:6000,start,end},energy:{calories:320,start,end,basis},restingEnergy:{calories:80,start,end}});
const rate=(samples:NetStepSample[],activityType:'walking'|'running'='walking')=>calibrateNetStepRate({provider:'synthetic',activityType,now,samples});
describe('explicit raw net step calibration',()=>{
 it('subtracts matching rest once from gross and never from already-active energy',()=>{
  const gross=sample('gross');gross.energy.calories=400;
  expect(rate([gross])?.caloriesPerStep).toBeCloseTo(320/6000);
  expect(rate([sample()])?.caloriesPerStep).toBeCloseTo(320/6000);
  expect(rate([sample()])?.calories).toBe(320);
 });
 it('withholds unknown basis, missing gross rest, mismatched intervals and incompatible sources',()=>{
  const unknown=sample('unknown'),missing=sample('gross');delete missing.restingEnergy;
  const stepMismatch=sample();stepMismatch.steps.end=new Date(end.getTime()+60000);
  const restMismatch=sample('gross');restMismatch.restingEnergy!.start=new Date(start.getTime()+1);
  const source=sample();source.provider='another';
  for(const s of [unknown,missing,stepMismatch,restMismatch,source])expect(rate([s])).toBeNull();
 });
 it('does not reuse a running rate for a walking recommendation',()=>{
  const running=sample();running.activityType='running';running.energy.calories=600;
  expect(rate([running])).toBeNull();expect(rate([sample(),running])?.caloriesPerStep).toBeCloseTo(320/6000);
  expect(rate([running],'running')?.caloriesPerStep).toBe(.1);
 });
 it('deduplicates identical samples and rejects conflicting or overlapping samples',()=>{
  expect(rate([sample(),sample()])?.sampleCount).toBe(1);
  const revised=sample();revised.energy.calories=321;expect(rate([sample(),revised])).toBeNull();
  const overlapping=sample();overlapping.id='another';expect(rate([sample(),overlapping])).toBeNull();
 });
 it('keeps the 0.8 conversion once and preserves clock/catch-up behavior with the net coefficient',()=>{
  const c=rate([sample()])!.caloriesPerStep;
  const plan=(raw:number,steps:number,anchor:Date,t:Date)=>{
   const p=calculateAnchoredRestProjection({observedProviderCalories:raw,providerRestCaloriesPerHour:80,anchor,now:t,localDate:'2026-10-30',timezone:'UTC'})!;
   return calculateBurnToStepPlan({currentSteps:steps,projectedProviderBurnAtRest:p.unroundedProjectedProviderBurnCalories,providerCaloriesPerStep:c,adjustmentFactor:.8,targetActualBurnCalories:4000});
  };
  const a=plan(2260,2000,start,start),b=plan(2260,2000,start,new Date('2026-10-30T08:15:00Z'));
  expect(b).toEqual(a);
  // Reported catch-up contains 80rest+320net activity. No estimate is added to it.
  const after=plan(2660,8000,end,end);expect(after.remainingSteps).toBe(a.remainingSteps-6000);
  expect(c*.8*6000).toBeCloseTo(256);
  expect(plan(2640,8000,end,end).remainingSteps).toBeGreaterThan(after.remainingSteps);
 });
 it('rejects expired and future calibration without refitting it',()=>{
  const old=sample();old.steps.start=new Date('2026-08-01T08:00:00Z');old.steps.end=new Date('2026-08-01T09:00:00Z');old.energy.start=old.steps.start;old.energy.end=old.steps.end;expect(rate([old])).toBeNull();
  expect(calibrateNetStepRate({provider:'synthetic',activityType:'walking',now:start,samples:[sample()]})).toBeNull();
 });
});
