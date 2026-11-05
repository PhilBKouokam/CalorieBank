/** Run directly with Node20 --import tsx --test; no npm pretest/build. */
import test from 'node:test';
import assert from 'node:assert/strict';
import type { PrismaClient } from '@prisma/client';
import { GoogleHealthNetStepReader } from '../src/modules/google-health/google-health-net-step-reader';
import { encryptGoogleHealthSecret } from '../src/modules/google-health/token-crypto';
import { parseApiEnv } from '../src/env';
const now=new Date('2026-02-10T20:00:00Z'),key=Buffer.alloc(32,7).toString('base64');
const config=parseApiEnv({NODE_ENV:'test',APP_ENV:'local',AUTH_MODE:'clerk',CLERK_SECRET_KEY:'sk_test_synthetic',CLERK_PUBLISHABLE_KEY:'pk_test_synthetic',GOOGLE_HEALTH_TOKEN_ENCRYPTION_KEY:key});
function fixture(modes:string[],activeFails=false,totalFails=false){
 const workouts=modes.map((mode,i)=>{const start=new Date(now.getTime()-(i+1)*3600000);return{id:`synthetic-${i}`,mode,activityType:'walking',startedAt:start,endedAt:new Date(start.getTime()+10*60000),updatedAt:now};});
 const user={id:'synthetic-owner',authSubject:'synthetic-subject',deletionRequestedAt:null,profile:{timezone:'UTC'},providerSelection:{authoritativeActivityProvider:'google_health_fitbit',authoritativeExpenditureProvider:'google_health_fitbit'},googleHealthConnection:{status:'connected',healthUserId:'synthetic-identity',scopes:['https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly'],accessTokenExpiresAt:new Date(now.getTime()+3600000),encryptedAccessToken:encryptGoogleHealthSecret('synthetic-token',key)}};
 const db={user:{findUnique:async()=>user},currentDayWorkout:{findMany:async()=>workouts}} as unknown as Pick<PrismaClient,'user'|'currentDayWorkout'>;
 const calls:Array<{id:string;metric:string}>=[];
 const fetcher=(async(input:string|URL|Request,init?:RequestInit)=>{
  const url=new URL(String(input)),total=url.pathname.includes('/total-calories/'),active=url.pathname.includes('/active-energy-burned/');
  const queried=total?JSON.parse(String(init?.body)).range.startTime:url.searchParams.get('filter')?.match(/start_time >= "([^"]+)"/)?.[1];
  const w=workouts.find(w=>w.startedAt.getTime()===Date.parse(queried));assert.ok(w,'Only requested synthetic windows are allowed');
  const metric=total?'total':active?'active':'steps';calls.push({id:w.id,metric});
  if((!active&&!total&&w.mode==='failed')||(active&&activeFails)||(total&&totalFails))return Response.json({}, {status:503});
  let points=Array.from({length:10},(_,i)=>({startTime:new Date(w.startedAt.getTime()+i*60000).toISOString(),endTime:new Date(w.startedAt.getTime()+(i+1)*60000).toISOString()}));
  if(metric==='steps'&&w.mode==='missing')points=points.slice(1);
  if(metric==='steps'&&w.mode==='duplicate')points.push(points[0]!);
  if(metric==='steps'&&w.mode==='straddling')points[0]={...points[0]!,startTime:new Date(w.startedAt.getTime()-60000).toISOString()};
  if(total)return Response.json({rollupDataPoints:points.map(p=>({...p,totalCalories:{kcalSum:4}}))});
  const dataPoints=points.map(interval=>active?{activeEnergyBurned:{interval,kcal:2}}:{steps:{interval,count:w.mode==='zero'?0:100}});
  return Response.json({dataPoints,...(metric==='steps'&&w.mode==='paged'?{nextPageToken:'unfinished'}:{})});
 }) as typeof fetch;
 return{calls,reader:new GoogleHealthNetStepReader(db,config,fetcher,()=>now,undefined,true)};
}
for(const mode of ['missing','duplicate','straddling','paged','zero','failed'])test(`unusable ${mode} steps skip every energy request`,async()=>{
 const f=fixture([mode]);assert.equal(await f.reader.read('synthetic-owner','2026-02-10','UTC'),null);assert.ok(f.calls.length<=2);assert.ok(f.calls.every(c=>c.metric==='steps'));
});
test('complete steps with active503 still qualify independent gross evidence',async()=>{
 const f=fixture(['complete'],true);const result=await f.reader.read('synthetic-owner','2026-02-10','UTC');assert.equal(result?.samples.length,0);assert.equal(result?.grossWalkingSamples?.length,1);assert.equal(f.calls.length,3);
});
test('optional total503 preserves independently valid active evidence',async()=>{
 const f=fixture(['complete'],false,true);const result=await f.reader.read('synthetic-owner','2026-02-10','UTC');assert.equal(result?.samples.length,1);assert.equal(result?.grossWalkingSamples?.length,0);assert.equal(f.calls.length,3);
});
test('saved calls reach fifth chronological gross sample within shared20 request cap',async()=>{
 const f=fixture(['missing','missing','complete','complete','complete','complete','missing','complete']);
 const result=await f.reader.read('synthetic-owner','2026-02-10','UTC');assert.equal(result?.grossWalkingSamples?.length,5);assert.equal(result?.samples.length,5);assert.equal(f.calls.length,18);assert.equal(result?.grossWalkingSamples?.at(-1)?.id,'synthetic-7');
 for(const id of ['synthetic-0','synthetic-1','synthetic-6'])assert.deepEqual(f.calls.filter(c=>c.id===id).map(c=>c.metric),['steps']);
});
