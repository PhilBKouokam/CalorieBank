import { createHash } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import { calibrateNetStepRate, calibrateTotalWalkingRate, type GrossWalkingSample, type NetStepSample } from '@caloriebank/domain';
import { z } from 'zod';
import type { ApiEnv } from '../../env';
import type { StepCalibrationReader, VerifiedStepCalibration } from '../today/steps-intelligence';
import { getLocalDateForTimezone } from '../today/today.time';
import { decryptGoogleHealthSecret } from './token-crypto';
import { GoogleHealthHourlyRollupSchema } from './google-health.provider';
import { readGoogleHealthOrdinaryHistory } from './google-health-ordinary-history';

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
    private readonly fetcher: typeof fetch = fetch, private readonly now = () => new Date(),
    private readonly ordinaryQualification?: 'recorded_sessions_proxy',
    private readonly quietWalkingQualification = false) {}
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
        const samples:NetStepSample[]=[], grossWalkingSamples:GrossWalkingSample[]=[];
        const ordinaryRequested = this.ordinaryQualification === 'recorded_sessions_proxy';
        // Reserve at most 13 calls for three exercise pages and ten daily rollups.
        // Both branches share the existing 20-call / eight-second budget.
        const calibrationLimit = ordinaryRequested ? 7 : 20;
        for(const w of seed.workouts.filter(w=>w.activityType==='walking')){
          if((samples.length>=5 && (!this.quietWalkingQualification || grossWalkingSamples.length>=5)) || requests>=calibrationLimit || performance.now()>=deadline)break;
          try {
          const start=Math.ceil(w.startedAt.getTime()/60000)*60000,end=Math.floor(w.endedAt.getTime()/60000)*60000;
          const queryStart=Math.floor(w.startedAt.getTime()/60000)*60000,queryEnd=Math.ceil(w.endedAt.getTime()/60000)*60000;
          if(end<=start || seed.workouts.some(o=>o.id!==w.id && o.startedAt.getTime()<end && o.endedAt.getTime()>start))continue;
          const streams:Record<'steps'|'active-energy-burned',Array<{start:number;end:number;value:number}>>={steps:[],'active-energy-burned':[]};
          const complete = { steps: true, 'active-energy-burned': true };
          for(const metric of ['steps','active-energy-burned'] as const){
            try {
              let pageToken:string|undefined;
              for(let n=0;n<2;n++){
                if(requests>=calibrationLimit || performance.now()>=deadline)throw Error('bounded_read');
                requests++;
                const q=new URLSearchParams({filter:`${metric.replaceAll('-','_')}.interval.start_time >= "${new Date(queryStart).toISOString()}" AND ${metric.replaceAll('-','_')}.interval.start_time < "${new Date(queryEnd).toISOString()}"`,pageSize:'10000',dataSourceFamily:'users/me/dataSourceFamilies/all-sources',...(pageToken?{pageToken}:{})});
                const response=await this.fetcher(this.config.GOOGLE_HEALTH_API_BASE_URL+`/users/me/dataTypes/${metric}/dataPoints:reconcile?${q}`,{method:'GET',headers:{Authorization:'Bearer '+token},redirect:'error',signal:AbortSignal.timeout(Math.max(1,Math.floor(Math.min(5000,deadline-performance.now()))))});
                if(!response.ok)throw Error('provider_unavailable');
                const parsed=page.parse(await response.json());
                streams[metric].push(...parsed.dataPoints.flatMap(p=>{const v=metric==='steps'?p.steps:p.activeEnergyBurned;return v?[{start:Date.parse(v.interval.startTime),end:Date.parse(v.interval.endTime),value:'count'in v?v.count:v.kcal}]:[];}));
                pageToken=parsed.nextPageToken;if(!pageToken)break;
              }
              if(pageToken)complete[metric]=false;
            } catch { complete[metric]=false; }
            const rows=streams[metric];
            if(rows.some(p=>p.start<queryStart||p.end>queryEnd))complete[metric]=false;
            streams[metric]=rows.filter(p=>p.start<end&&p.end>start);
            if(streams[metric].some(p=>p.start<start||p.end>end||p.end-p.start!==60000||p.start%60000!==0))complete[metric]=false;
            for(let t=start;complete[metric]&&t<end;t+=60000)if(streams[metric].filter(p=>p.start===t&&p.end===t+60000).length!==1)complete[metric]=false;
            // Neither active nor total calibration can use an unusable step window.
            // Preserve the shared request budget for older qualifying walks.
            if(metric==='steps'&&(!complete.steps||streams.steps.reduce((n,p)=>n+p.value,0)<=0))break;
          }
          const steps=streams.steps.reduce((n,p)=>n+p.value,0), calories=streams['active-energy-burned'].reduce((n,p)=>n+p.value,0);
          if(!complete.steps || steps<=0)continue;
          const sample:NetStepSample|undefined = complete['active-energy-burned']&&calories>0 ? {id:w.id,provider,activityType:'walking',
            steps:{count:steps,start:new Date(start),end:new Date(end)},
            energy:{calories,start:new Date(start),end:new Date(end),basis:'active_above_rest'}} : undefined;
          // Total-energy evidence is independent of optional active-energy availability.
          if ((ordinaryRequested || this.quietWalkingQualification) && requests < calibrationLimit && performance.now() < deadline) {
            try {
              requests++;
              const response = await this.fetcher(this.config.GOOGLE_HEALTH_API_BASE_URL + '/users/me/dataTypes/total-calories/dataPoints:rollUp', {
                method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
                body:JSON.stringify({range:{startTime:new Date(start).toISOString(),endTime:new Date(end).toISOString()},windowSize:'60s',dataSourceFamily:'users/me/dataSourceFamilies/all-sources'}),
                redirect:'error',signal:AbortSignal.timeout(Math.max(1,Math.floor(Math.min(5000,deadline-performance.now())))),
              });
              if(response.ok){
                const payload=GoogleHealthHourlyRollupSchema.parse(await response.json());
                const rows=[...payload.rollupDataPoints].sort((a,b)=>Date.parse(a.startTime)-Date.parse(b.startTime));
                if(!payload.nextPageToken&&rows.length===(end-start)/60000&&rows.every((row,i)=>row.totalCalories&&Date.parse(row.startTime)===start+i*60000&&Date.parse(row.endTime)===start+(i+1)*60000)){
                  const gross=rows.reduce((n,row)=>n+row.totalCalories!.kcalSum,0);
                  if(!sample||gross>=calories){
                    grossWalkingSamples.push({id:w.id,provider,activityType:'walking',steps:{count:steps,start:new Date(start),end:new Date(end)},totalEnergy:{calories:gross,start:new Date(start),end:new Date(end)}});
                    if(sample)sample.grossEnergy={calories:gross,start:new Date(start),end:new Date(end)};
                  }
                }
              }
            } catch { /* Preserve valid active evidence when optional total fails. */ }
          }
          if(sample)samples.push(sample);
          } catch {
            // A failed optional window cannot invalidate an already paired walk.
            // Keep the read bounded and try older candidates when budget permits.
            if(requests>=calibrationLimit || performance.now()>=deadline)break;
          }
        }
        if(!calibrateNetStepRate({provider,activityType:'walking',now,samples}) && !calibrateTotalWalkingRate({provider,now,samples:grossWalkingSamples}))return null;
        const oldest=Math.min(...[...samples,...grossWalkingSamples].map(s=>s.steps.start.getTime()));
        const ordinaryHistory = ordinaryRequested
          ? await readGoogleHealthOrdinaryHistory({
            accountId: userId, sourceId: seed.version, localDate, timezone, now: this.now,
            request: async (path, init) => {
              const remaining = Math.min(5000, deadline - performance.now(), c.accessTokenExpiresAt.getTime() - this.now().getTime());
              if (remaining < 1 || requests >= 20) throw Error('bounded_read');
              requests++;
              const response = await this.fetcher(this.config.GOOGLE_HEALTH_API_BASE_URL + path, {
                ...init, headers: { Authorization: 'Bearer ' + token, ...init.headers },
                redirect: 'error', signal: AbortSignal.timeout(Math.floor(remaining)),
              });
              if (!response.ok) throw Error('provider_unavailable');
              return response.json();
            },
          }).catch(() => null)
          : null;
        return {accountId:userId,provider,localDate,timezone,sourceVersion:seed.version,
          expiresAt:new Date(Math.min(now.getTime()+5*60000,c.accessTokenExpiresAt.getTime(),oldest+30*86400000)),samples,grossWalkingSamples,
          ...(ordinaryHistory ? { ordinaryHistory } : {})};
      }catch{return null;}
    })().then(value=>{
      if(this.cache.size>=100)this.cache.clear();
      this.cache.set(key,{value,expiresAt:value?.expiresAt??new Date(this.now().getTime()+30000)});
      return value;
    }).finally(()=>this.pending.delete(key));
    this.pending.set(key,work);return work;
  }
}
