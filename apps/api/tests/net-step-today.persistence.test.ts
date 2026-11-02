import {PrismaClient} from '@prisma/client';
import {randomUUID} from 'node:crypto';
import express from 'express';
import request from 'supertest';
import {afterAll,describe,it,expect,vi} from 'vitest';
import {normalizeDailyExpenditureAggregate,calculateBurnToStepPlan} from '@caloriebank/domain';
import {PrismaTodayAggregateRepository} from '../src/modules/today/today.repository';
import {createTodayRouter} from '../src/modules/today/today.routes';
import {GoogleHealthNetStepReader} from '../src/modules/google-health/google-health-net-step-reader';
import {encryptGoogleHealthSecret} from '../src/modules/google-health/token-crypto';
import {parseApiEnv} from '../src/env';
const db=new PrismaClient();afterAll(()=>db.$disconnect());
describe('explicit net calibration through the real Today route and database',()=>{
 it('keeps provider burn/accounting intact, exposes raw net rate once adjusted, and preserves timestamp/catch-up behavior',async()=>{
  const user={id:randomUUID(),email:`${randomUUID()}@caloriebank.local`},other={id:randomUUID(),email:`${randomUUID()}@caloriebank.local`};
  const provider='google_health_fitbit',date='2026-10-30',localDate=new Date(date+'T00:00:00Z');let now=new Date(date+'T08:00:00Z');
  const key=Buffer.alloc(32,8).toString('base64'),encrypted=encryptGoogleHealthSecret('synthetic',key);
  const config=parseApiEnv({NODE_ENV:'test',APP_ENV:'local',AUTH_MODE:'clerk',CLERK_SECRET_KEY:'sk_test_synthetic',CLERK_PUBLISHABLE_KEY:'pk_test_synthetic',GOOGLE_HEALTH_TOKEN_ENCRYPTION_KEY:key});
  vi.useFakeTimers({toFake:['Date']});vi.setSystemTime(now);
  try{
   for(const u of [user,other])await db.user.create({data:{...u,profile:{create:{timezone:'UTC'}},providerSelection:{create:{authoritativeExpenditureProvider:provider,authoritativeActivityProvider:provider,authoritativeIntakeProvider:'fatsecret'}}}});
   await db.googleHealthConnection.create({data:{userId:user.id,healthUserId:'synthetic',encryptedAccessToken:encrypted,encryptedRefreshToken:encrypted,accessTokenExpiresAt:new Date(date+'T12:00:00Z'),scopes:['https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly']}});
   await db.currentDayWorkout.create({data:{userId:user.id,provider,providerWorkoutId:'synthetic',localDate:new Date('2026-10-29T00:00:00Z'),timezone:'UTC',activityType:'walking',displayName:'Synthetic',startedAt:new Date('2026-10-29T08:00:00Z'),endedAt:new Date('2026-10-29T09:00:00Z'),durationMinutes:60,totalSteps:6000,totalEnergyBurned:400,importedAt:now,isCurrentDay:false,syncStatus:'ready'}});
   const fetcher=vi.fn(async(url:string|URL|Request)=>new Response(JSON.stringify({dataPoints:Array.from({length:60},(_,i)=>{const interval={startTime:new Date(Date.parse('2026-10-29T08:00:00Z')+i*60000).toISOString(),endTime:new Date(Date.parse('2026-10-29T08:01:00Z')+i*60000).toISOString()};return String(url).includes('active-energy-burned')?{activeEnergyBurned:{interval,kcal:320/60}}:{steps:{interval,count:100}};})}),{status:200})) as unknown as typeof fetch;
   const reader=new GoogleHealthNetStepReader(db,config,fetcher,()=>now);
   const repo=new PrismaTodayAggregateRepository(db,{allowSyntheticProviders:false,now:()=>now,stepCalibrationReader:reader});
   await db.restingBurnEstimate.create({data:{userId:user.id,provider,providerKcalPerHour:80,evidenceType:'historical_low_activity_hours',observationCount:20,lookbackStartDate:localDate,lookbackEndDate:localDate,calculatedAt:now}});
   const session=await db.ingestionSyncSession.create({data:{userId:user.id,provider,localDate,timezone:'UTC',trigger:'app_foreground',startedAt:now,completedAt:now,status:'completed'}});
   const write=async(raw:number,steps:number)=>{
    vi.setSystemTime(now);
    await repo.upsertExpenditureAggregate(user,normalizeDailyExpenditureAggregate({userId:user.id,provider,providerRecordId:'synthetic',localDate:date,timezone:'UTC',rawTotalDailyExpenditure:raw,reportedIntervalEndAt:now,importedAt:now,providerUpdatedAt:now,isCurrentDay:true,syncStatus:'ready',syncSessionId:session.id}));
    await db.dailyStepAggregate.upsert({where:{userId_localDate_provider:{userId:user.id,localDate,provider}},create:{userId:user.id,localDate,provider,timezone:'UTC',providerRecordId:'synthetic',totalSteps:steps,importedAt:now,providerUpdatedAt:now,isCurrentDay:true,syncStatus:'ready',syncSessionId:session.id},update:{totalSteps:steps,providerUpdatedAt:now}});
   };
   const app=express();app.use('/v1/me',createTodayRouter(repo,()=>user));
   const read=async()=>{const response=await request(app).get('/v1/me/today?timezone=UTC');if(response.status!==200)throw Error(response.text);return response.body;};
   await write(2260,2000);const a=await read();
   expect(a.burned).toMatchObject({raw:2260,adjusted:1808});expect(a.steps.caloriesPerStep).toBeCloseTo(320/6000);expect(a.steps.adjustedCaloriesPerStep).toBeCloseTo(256/6000);expect(a.steps.calibrationTotalCalories).toBeCloseTo(320);
   const plan=(t:typeof a)=>calculateBurnToStepPlan({currentSteps:t.steps.count,projectedProviderBurnAtRest:t.restOfDayProjection.unroundedProjectedProviderBurnCalories,providerCaloriesPerStep:t.steps.caloriesPerStep,adjustmentFactor:.8,targetActualBurnCalories:4000});
   now=new Date(date+'T08:15:00Z');await write(2260,2000);const b=await read();expect(plan(b)).toEqual(plan(a));
   now=new Date(date+'T09:00:00Z');await write(2660,8000);const c=await read();expect(plan(c).remainingSteps).toBe(plan(a).remainingSteps-6000);
   expect(c.burned).toMatchObject({raw:2660,adjusted:2128});
   // No calibration leakage to a different account, even with the same provider.
   expect((await repo.getTodayForUser(other.id,date,'UTC')).steps.caloriesPerStep).toBeNull();
   await db.providerSelection.update({where:{userId:user.id},data:{authoritativeActivityProvider:'apple_health'}});
   expect((await repo.getTodayForUser(user.id,date,'UTC')).steps.caloriesPerStep).toBeNull();
   expect(await db.calorieLedgerTransaction.count({where:{userId:user.id}})).toBe(0);
   expect(await db.finalizedDailyBankRecord.count({where:{userId:user.id}})).toBe(0);
   expect(await db.bankAccountInitialization.count({where:{userId:user.id}})).toBe(0);
   expect((await db.currentDayWorkout.findFirstOrThrow({where:{userId:user.id}})).totalEnergyBurned).toBe(400);
  }finally{try{await db.user.deleteMany({where:{id:{in:[user.id,other.id]}}});}finally{vi.useRealTimers();}}
 });
});
