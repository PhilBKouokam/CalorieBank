import {describe,it,expect,vi} from 'vitest';
import type {PrismaClient} from '@prisma/client';
import {calibrateNetStepRate} from '@caloriebank/domain';
import {GoogleHealthNetStepReader} from '../src/modules/google-health/google-health-net-step-reader';
import {encryptGoogleHealthSecret} from '../src/modules/google-health/token-crypto';
import {parseApiEnv} from '../src/env';
const now=new Date('2026-10-30T10:00:00Z'),start=new Date('2026-10-29T08:00:30Z'),end=new Date('2026-10-29T09:00:20Z');
const key=Buffer.alloc(32,7).toString('base64');
const config=parseApiEnv({NODE_ENV:'test',APP_ENV:'local',AUTH_MODE:'clerk',CLERK_SECRET_KEY:'sk_test_synthetic',CLERK_PUBLISHABLE_KEY:'pk_test_synthetic',GOOGLE_HEALTH_TOKEN_ENCRYPTION_KEY:key});
function fixture(){
 const state={user:{id:'synthetic-account',authSubject:'synthetic-subject',deletionRequestedAt:null,profile:{timezone:'UTC'},providerSelection:{authoritativeActivityProvider:'google_health_fitbit',authoritativeExpenditureProvider:'google_health_fitbit',updatedAt:now},googleHealthConnection:{status:'connected',healthUserId:'synthetic-identity',scopes:['https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly'],accessTokenExpiresAt:new Date('2026-10-30T11:00:00Z'),encryptedAccessToken:encryptGoogleHealthSecret('synthetic-not-a-credential',key)}},workouts:[{id:'synthetic-walk',activityType:'walking',startedAt:start,endedAt:end,updatedAt:now}]};
 const db={user:{findUnique:vi.fn(async()=>state.user)},currentDayWorkout:{findMany:vi.fn(async()=>state.workouts)}} as unknown as Pick<PrismaClient,'user'|'currentDayWorkout'>;
 const points=Array.from({length:59},(_,i)=>({interval:{startTime:new Date(Date.parse('2026-10-29T08:01:00Z')+i*60000).toISOString(),endTime:new Date(Date.parse('2026-10-29T08:02:00Z')+i*60000).toISOString()}}));
 let mode='complete';
 const fetcher=vi.fn(async(url:string|URL|Request)=>{
  if(mode==='recent_failure' && new URL(String(url)).searchParams.get('filter')?.includes('T12:00:00.000Z'))return new Response('{}',{status:503});
  const active=String(url).includes('active-energy-burned');let rows=points.map(p=>active?{activeEnergyBurned:{...p,kcal:320/60}}:{steps:{...p,count:100}});
  if(mode==='missing'&&active)rows=rows.slice(1);
  if(mode==='duplicate'&&active)rows.push(rows[0]!);
  return new Response(JSON.stringify({dataPoints:rows,...(mode==='pagination'?{nextPageToken:'another'}:{})}),{status:200});
 }) as unknown as typeof fetch;
 return {state,db,fetcher,setMode:(v:string)=>{mode=v;},reader:new GoogleHealthNetStepReader(db,config,fetcher,()=>now)};
}
describe('Google explicit net-energy read path',()=>{
 it('pairs complete interior minutes, uses active energy unchanged and reuses a bounded account cache',async()=>{
  const f=fixture();const [a,b]=await Promise.all([f.reader.read('synthetic-account','2026-10-30','UTC'),f.reader.read('synthetic-account','2026-10-30','UTC')]);
  expect(a).toEqual(b);expect(a?.samples[0]?.steps.count).toBe(5900);
  const c=calibrateNetStepRate({provider:'google_health_fitbit',activityType:'walking',now,samples:a!.samples});expect(c?.caloriesPerStep).toBeCloseTo(320/6000);
  expect(await f.reader.validate(f.db,a!)).toBe(true);expect(f.fetcher).toHaveBeenCalledTimes(2);
  await f.reader.read('synthetic-account','2026-10-30','UTC');expect(f.fetcher).toHaveBeenCalledTimes(2);
 });
 it.each(['missing','duplicate','pagination'])('withholds %s interval evidence instead of using the untyped workout scalar',async(mode)=>{const f=fixture();f.setMode(mode);expect(await f.reader.read('synthetic-account','2026-10-30','UTC')).toBeNull();});
 it('excludes running-only and overlapping other activity',async()=>{
  for(const type of ['running','other']){const f=fixture();f.state.workouts[0]!.activityType=type;expect(await f.reader.read('synthetic-account','2026-10-30','UTC')).toBeNull();expect(f.fetcher).not.toHaveBeenCalled();}
  const f=fixture();f.state.workouts.push({...f.state.workouts[0]!,id:'overlap',activityType:'running'});expect(await f.reader.read('synthetic-account','2026-10-30','UTC')).toBeNull();
 });
 it('invalidates changed authority/identity/sample revisions and never changes a connection or refreshes a token',async()=>{
  const f=fixture();const a=await f.reader.read('synthetic-account','2026-10-30','UTC');
  f.state.workouts[0]!.updatedAt=new Date(now.getTime()+1);expect(await f.reader.validate(f.db,a!)).toBe(false);
  await f.reader.read('synthetic-account','2026-10-30','UTC');expect(f.fetcher).toHaveBeenCalledTimes(4);
  f.state.user.providerSelection.authoritativeActivityProvider='apple_health';expect(await f.reader.validate(f.db,a!)).toBe(false);expect(await f.reader.read('synthetic-account','2026-10-30','UTC')).toBeNull();
  expect(f.fetcher).toHaveBeenCalledTimes(4);
 });
 it('retains an older qualified walk when a newer optional window fails',async()=>{
  const f=fixture();f.setMode('recent_failure');f.state.workouts.unshift({...f.state.workouts[0]!,id:'newer',startedAt:new Date('2026-10-29T12:00:30Z'),endedAt:new Date('2026-10-29T13:00:20Z')});
  const a=await f.reader.read('synthetic-account','2026-10-30','UTC');expect(a?.samples).toHaveLength(1);expect(a?.samples[0]?.id).toBe('synthetic-walk');
 });
 it('rejects expired tokens, other dates/timezones and non-authoritative sources before a provider read',async()=>{
  const f=fixture();expect(await f.reader.read('synthetic-account','2026-10-29','UTC')).toBeNull();expect(await f.reader.read('synthetic-account','2026-10-30','America/Chicago')).toBeNull();
  f.state.user.googleHealthConnection.accessTokenExpiresAt=now;expect(await f.reader.read('synthetic-account','2026-10-30','UTC')).toBeNull();expect(f.fetcher).not.toHaveBeenCalled();
 });
});
