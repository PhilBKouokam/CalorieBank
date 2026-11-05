import {describe,it,expect} from 'vitest';
import type {TodayResponse} from '@caloriebank/schemas';
import {walkingPlanVisible} from '../../mobile/lib/today/walking-plan-visibility';
import {projectedBurnGuidance} from '../../mobile/lib/today/projected-burn-guidance';
describe('new Today presentation evidence and visibility',()=>{
 it('shows the new walking surface by default while preserving explicit choices',()=>{
  expect(walkingPlanVisible(null)).toBe(true);
  for(const stepsVisibilitySource of ['unset','inferred'] as const)expect(walkingPlanVisible({showSteps:false,stepsVisibilitySource})).toBe(true);
  expect(walkingPlanVisible({showSteps:false,stepsVisibilitySource:'explicit'})).toBe(false);
  expect(walkingPlanVisible({showSteps:true,stepsVisibilitySource:'explicit'})).toBe(true);
 });
 it('requires qualified current unexpired projection and a coherent successful current read',()=>{
  const now=new Date('2026-02-10T12:00:00Z');
  const today={date:'2026-02-10',timezone:'UTC',burned:{status:'ready'},restOfDayProjection:{status:'ready',planningAnchorKind:'reported_interval',planningAnchorAt:now.toISOString(),planningExpiresAt:new Date(now.getTime()+30*60000).toISOString(),projectedAdjustedBurnCalories:1540}} as unknown as TodayResponse;
  expect(projectedBurnGuidance(today,now)).toBe(1540);
  expect(projectedBurnGuidance(today,now,false)).toBeNull();
  expect(projectedBurnGuidance(today,new Date('2026-02-10T12:30:00Z'))).toBeNull();
  expect(projectedBurnGuidance({...today,date:'2026-02-09'},now)).toBeNull();
  expect(projectedBurnGuidance({...today,restOfDayProjection:{...today.restOfDayProjection,planningAnchorKind:'retrieval_assumption'}},now)).toBeNull();
 });
});
