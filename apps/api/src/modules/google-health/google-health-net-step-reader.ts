import { createHash } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import { calibrateNetStepRate, type NetStepSample } from '@caloriebank/domain';
import { z } from 'zod';
import type { ApiEnv } from '../../env';
import type { StepCalibrationReader, VerifiedStepCalibration } from '../today/steps-intelligence';
import { getLocalDateForTimezone } from '../today/today.time';
import { decryptGoogleHealthSecret } from './token-crypto';

const provider = 'google_health_fitbit';
const hash = (v: unknown) => createHash('sha256').update(JSON.stringify(v)).digest('hex');
const interval = z.object({ startTime: z.string().datetime({offset:true}), endTime: z.string().datetime({offset:true}) });
const count = z.union([z.number(), z.string().regex(/^\d+$/).transform(Number)]).pipe(z.number().int().nonnegative().safe());
const page = z.object({ dataPoints: z.array(z.object({
  steps: z.object({ interval, count }).optional(),
  activeEnergyBurned: z.object({ interval, kcal: z.number().finite().nonnegative() }).optional(),
})).default([]), nextPageToken: z.string().optional() });
type Db = Pick<PrismaClient, 'user' | 'currentDayWorkout'>;
/** Reuses the previously qualified complete-interior-minute active/step pairing.
 * No total-calorie decomposition, token refresh, DB cache, sync or accounting. */
export class GoogleHealthNetStepReader implements StepCalibrationReader {
  private readonly cache = new Map<string, {expiresAt: Date; value: VerifiedStepCalibration | null}>();
  private readonly pending = new Map<string, Promise<VerifiedStepCalibration | null>>();
  constructor(private readonly db: Db, private readonly config: ApiEnv,
    private readonly fetcher: typeof fetch = fetch, private readonly now = () => new Date()) {}
  private async seed(db: Db, userId: string) {
    const now = this.now();
    const user = await db.user.findUnique({where:{id:userId},select:{id:true,deletionRequestedAt:true,authSubject:true,
      profile:{select:{timezone:true}},providerSelection:true,
      googleHealthConnection:{select:{healthUserId:true,status:true,scopes:true,accessTokenExpiresAt:true,encryptedAccessToken:true}},
    }});
    const workouts = await db.currentDayWorkout.findMany({where:{userId,provider,syncStatus:'ready',
      startedAt:{gte:new Date(now.getTime()-30*86400000)},endedAt:{lte:now}},orderBy:{startedAt:'desc'},
      take:501,select:{id:true,activityType:true,startedAt:true,endedAt:true,updatedAt:true}});
    return {user,workouts,version:hash([user,workouts])};
  }
  async validate(db: Db, value: VerifiedStepCalibration) {
    const seed = await this.seed(db,value.accountId);
    return seed.user?.id===value.accountId && value.provider===provider && seed.user.profile?.timezone===value.timezone &&
      getLocalDateForTimezone(value.timezone,this.now())===value.localDate && value.expiresAt > this.now() && seed.version === value.sourceVersion;
  }
  async read(userId: string, localDate: string, timezone: string): Promise<VerifiedStepCalibration | null> {
    if(this.config.AUTH_MODE !== 'clerk' || this.config.GOOGLE_HEALTH_API_BASE_URL !== 'https://health.googleapis.com/v4' ||
      !this.config.GOOGLE_HEALTH_TOKEN_ENCRYPTION_KEY) return null;
    if(getLocalDateForTimezone(timezone,this.now())!==localDate)return null;
    const seed = await this.seed(this.db,userId), u=seed.user, c=u?.googleHealthConnection;
    if(seed.workouts.length>500)return null;
    if(!u || u.id!==userId || u.deletionRequestedAt || u.profile?.timezone!==timezone || !c || c.status!=='connected' || !c.healthUserId ||
      c.accessTokenExpiresAt<=this.now() || c.scopes.length!==1 || c.scopes[0]!=='https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly' ||
      u.providerSelection?.authoritativeActivityProvider!==provider || u.providerSelection.authoritativeExpenditureProvider!==provider) return null;
    const key=hash([userId,localDate,timezone,seed.version]);
    const cached=this.cache.get(key); if(cached && cached.expiresAt>this.now())return cached.value;
    const pending=this.pending.get(key);if(pending)return pending;
    const work=(async()=>{
      try{
        const token=decryptGoogleHealthSecret(c.encryptedAccessToken,this.config.GOOGLE_HEALTH_TOKEN_ENCRYPTION_KEY!);
        const now=this.now(), deadline=performance.now()+8000; let requests=0;
        const samples:NetStepSample[]=[];
        for(const w of seed.workouts.filter(w=>w.activityType==='walking')){
          if(samples.length>=5 || requests>=20 || performance.now()>=deadline)break;
          try {
          const start=Math.ceil(w.startedAt.getTime()/60000)*60000,end=Math.floor(w.endedAt.getTime()/60000)*60000;
          const queryStart=Math.floor(w.startedAt.getTime()/60000)*60000,queryEnd=Math.ceil(w.endedAt.getTime()/60000)*60000;
          if(end<=start || seed.workouts.some(o=>o.id!==w.id && o.startedAt.getTime()<end && o.endedAt.getTime()>start))continue;
          const streams:Record<'steps'|'active-energy-burned',Array<{start:number;end:number;value:number}>>={steps:[],'active-energy-burned':[]};
          let complete=true;
          for(const metric of ['steps','active-energy-burned'] as const){
            let pageToken:string|undefined;
            for(let n=0;n<2;n++){
              if(++requests>20 || performance.now()>=deadline)throw Error('bounded_read');
              const q=new URLSearchParams({filter:`${metric.replaceAll('-','_')}.interval.start_time >= "${new Date(queryStart).toISOString()}" AND ${metric.replaceAll('-','_')}.interval.start_time < "${new Date(queryEnd).toISOString()}"`,pageSize:'10000',dataSourceFamily:'users/me/dataSourceFamilies/all-sources',...(pageToken?{pageToken}:{})});
              const response=await this.fetcher(this.config.GOOGLE_HEALTH_API_BASE_URL+`/users/me/dataTypes/${metric}/dataPoints:reconcile?${q}`,{method:'GET',headers:{Authorization:'Bearer '+token},redirect:'error',signal:AbortSignal.timeout(Math.max(1,Math.floor(Math.min(5000,deadline-performance.now()))))});
              if(!response.ok)throw Error('provider_unavailable');
              const parsed=page.parse(await response.json());
              streams[metric].push(...parsed.dataPoints.flatMap(p=>{const v=metric==='steps'?p.steps:p.activeEnergyBurned;return v?[{start:Date.parse(v.interval.startTime),end:Date.parse(v.interval.endTime),value:'count'in v?v.count:v.kcal}]:[];}));
              pageToken=parsed.nextPageToken;if(!pageToken)break;
            }
            if(pageToken)complete=false;
          }
          if(!complete)continue;
          let steps=0,calories=0;
          for(const metric of ['steps','active-energy-burned'] as const){
            const rows=streams[metric];
            if(rows.some(p=>p.start<queryStart||p.end>queryEnd))complete=false;
            streams[metric]=rows.filter(p=>p.start<end&&p.end>start);
            if(streams[metric].some(p=>p.start<start||p.end>end||p.end-p.start!==60000||p.start%60000!==0))complete=false;
          }
          for(let t=start;complete&&t<end;t+=60000){
            const s=streams.steps.filter(p=>p.start===t&&p.end===t+60000),a=streams['active-energy-burned'].filter(p=>p.start===t&&p.end===t+60000);
            if(s.length!==1||a.length!==1){complete=false;break;}steps+=s[0]!.value;calories+=a[0]!.value;
          }
          if(complete&&steps>0&&calories>0)samples.push({id:w.id,provider,activityType:'walking',
            steps:{count:steps,start:new Date(start),end:new Date(end)},
            energy:{calories,start:new Date(start),end:new Date(end),basis:'active_above_rest'}});
          } catch {
            // A failed optional window cannot invalidate an already paired walk.
            // Keep the read bounded and try older candidates when budget permits.
            if(requests>=20 || performance.now()>=deadline)break;
          }
        }
        if(!calibrateNetStepRate({provider,activityType:'walking',now,samples}))return null;
        const oldest=Math.min(...samples.map(s=>s.steps.start.getTime()));
        return {accountId:userId,provider,localDate,timezone,sourceVersion:seed.version,
          expiresAt:new Date(Math.min(now.getTime()+5*60000,c.accessTokenExpiresAt.getTime(),oldest+30*86400000)),samples};
      }catch{return null;}
    })().then(value=>{
      if(this.cache.size>=100)this.cache.clear();
      this.cache.set(key,{value,expiresAt:value?.expiresAt??new Date(this.now().getTime()+30000)});
      return value;
    }).finally(()=>this.pending.delete(key));
    this.pending.set(key,work);return work;
  }
}
