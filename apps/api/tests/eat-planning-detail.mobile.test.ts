vi.mock('react-native-safe-area-context', () => ({SafeAreaView: 'SafeAreaView'}));
import React from 'react';
import {resolve} from 'node:path';
import {act,create,type ReactTestRenderer,type ReactTestInstance} from 'react-test-renderer';
import {afterEach,beforeEach,describe,it,expect,vi} from 'vitest';
import type {EatingBudgetResponse,EatPlanningResponse,TodayResponse} from '@caloriebank/schemas';
const controls=vi.hoisted(()=>({enabled:true,running:false,fontScale:1,width:390,plan:vi.fn(),budget:vi.fn(),today:vi.fn(),provider:vi.fn()}));
vi.mock('react-native',()=>({ Platform: { OS: 'android' }, Keyboard: { isVisible: () => false, addListener: () => ({remove: () => {}}) }, Text:'Text',TextInput:'TextInput',View:'View',Pressable:'Pressable',StyleSheet:{create:(x:unknown)=>x,flatten:(x:unknown)=>x},useWindowDimensions:()=>({fontScale:controls.fontScale,width:controls.width}),AppState:{addEventListener:()=>({remove:()=>{}})}}));
vi.mock('expo-router',()=>({useFocusEffect:(callback:()=>void)=>React.useEffect(callback,[callback])}));
vi.mock('../../mobile/lib/api/eating-budget',()=>({get eatingBudgetEnabled(){return controls.enabled;},fetchEatingPlan:(...args:unknown[])=>controls.plan(...args),fetchEatingBudget:(...args:unknown[])=>controls.budget(...args)}));
vi.mock('../../mobile/lib/api/client',()=>({fetchToday:(...args:unknown[])=>controls.today(...args),fetchProviderSelection:(...args:unknown[])=>controls.provider(...args)}));
vi.mock('../../mobile/lib/lifecycle/account-lifecycle',()=>({isAccountLifecycleRunning:()=>controls.running,subscribeToAccountLifecycle:()=>()=>{},subscribeToAccountLifecycleActivity:()=>()=>{}}));
vi.mock('../../mobile/lib/today/local-date-change',()=>({subscribeToLocalDateChange:()=>()=>{}}));
let EatingPlanPanel:React.ComponentType<{today:TodayResponse|null;budget:EatingBudgetResponse|null;pending:boolean;allowed:boolean;projectionAllowed?:boolean;enabled?:boolean}>;
let useEatingBudgetReadModel: () => { today: TodayResponse | null; budget: EatingBudgetResponse | null; pending: boolean; allowed: boolean; failed: boolean };
beforeEach(async () => { ({ useEatingBudgetReadModel } = await import(resolve(__dirname, '../../mobile/lib/today/use-eating-budget-read-model.ts'))); });
import {selectStepsForIntake,eatingComparison} from '../../mobile/lib/today/eating-budget-guidance';
import {setDraftSession,terminateDraftSession} from '../../mobile/lib/drafts/session-drafts';
const anchor='2026-02-10T12:00:00.000Z',expiry='2026-02-10T12:30:00.000Z',context=`g1:${'a'.repeat(64)}`;
function fixture(){
 const q={status:'ready',basis:'matched_total_above_selected_quiet',rawIncrementalKcalPerStep:.04,baselineModelVersion:'synthetic-r',calibrationVersion:'synthetic-q',baselineProviderKcalPerHour:60,rawProjectedBurnBeforeWalking:1920,planningAnchorAt:anchor,expiresAt:expiry,localDate:'2026-02-10',timezone:'UTC',source:'Synthetic',stepsPerMinute:100,walkingSampleCount:1};
 const today={date:q.localDate,timezone:q.timezone,guidanceContextVersion:context,burned:{status:'ready',source:'Synthetic',adjustmentFactor:.8},steps:{source:'Synthetic',status:'ready',count:10000,quietWalkingForecast:q},restOfDayProjection:{status:'ready',evidenceType:'historical_low_activity_hours',modelVersion:q.baselineModelVersion,providerKcalPerHour:60,unroundedProjectedProviderBurnCalories:1920,planningAnchorAt:anchor,planningExpiresAt:expiry}} as unknown as TodayResponse;
 const budget={version:1,localDate:today.date,timezone:today.timezone,guidanceContextVersion:context,signedGoalAdjustmentCalories:0,dailyBankTargetCalories:0,intake:{calories:1800,semantic:'estimated_total_day_intake'},budget:{status:'ready',estimated:true,totalCalories:1536,comparison:{kind:'estimated_day_difference',calories:-264},expiresAt:expiry,comparisonExpiresAt:expiry},planningAvailable:true,planningModel:{basis:q.basis,baselineModelVersion:q.baselineModelVersion,calibrationVersion:q.calibrationVersion,expiresAt:expiry,coverageAt:anchor,currentSteps:10000,rawProviderCaloriesPerAdditionalStep:.04,stepsPerMinute:100}} as EatingBudgetResponse;
 const response={version:1,localDate:today.date,timezone:today.timezone,snapshot:budget,plan:{status:'ready',hypothetical:true,totalSteps:24500,additionalSteps:14500,totalIntakeCalories:2000,expiresAt:expiry}} as EatPlanningResponse;
 return {today,budget,response};
}
let screen:ReactTestRenderer|undefined;
const text=(node:ReactTestInstance):string=>node.children.map(x=>typeof x==='string'?x:text(x)).join('');
async function render(element:React.ReactElement){await act(async()=>{screen=create(element);});return screen!;}
beforeEach(async()=>{({EatingPlanPanel}=await import(resolve(__dirname,'../../mobile/components/caloriebank/EatingPlanPanel.tsx')));Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});vi.useFakeTimers();vi.setSystemTime(new Date(anchor));controls.enabled=true;controls.running=false;controls.plan.mockReset();controls.budget.mockReset();controls.today.mockReset();controls.provider.mockReset();terminateDraftSession();setDraftSession('synthetic-owner','synthetic-session');});
afterEach(async()=>{if(screen)await act(async()=>screen!.unmount());screen=undefined;vi.useRealTimers();});
describe('intentional total-day eating plan',()=>{
 it('shows projected total without intake or step alignment and never borrows it for a walking plan',async()=>{
  const f=fixture();f.today.restOfDayProjection.projectedAdjustedBurnCalories=3000;
  const budget={...f.budget,projectedEstimate:{status:'ready',basis:'caloriebank_adjusted_projection',estimated:true,totalCalories:2200,projectedAdjustedBurnCalories:3000,expiresAt:expiry},planningAvailable:false,planningModel:null,budget:{status:'unavailable',reason:'expenditure_cutoff_unverified'},intake:{calories:null,semantic:'unknown'}} as EatingBudgetResponse;
  const props={today:f.today,budget,pending:false,allowed:false,projectionAllowed:true};
  const view=await render(React.createElement(EatingPlanPanel,props));expect(text(view.root)).toContain('2,200 kcal');expect(text(view.root)).not.toContain('Remaining Today');expect(text(view.root)).toContain('Food-and-walking planning isn’t available yet.');expect(text(view.root)).not.toContain('Your burn data doesn’t yet support an eating estimate.');
  await act(async()=>view.root.findByProps({accessibilityLabel:'Planned total calories today'}).props.onChangeText('2500'));await act(async()=>{vi.advanceTimersByTime(301);});expect(controls.plan).not.toHaveBeenCalled();
  await act(async()=>view.update(React.createElement(EatingPlanPanel,{...props,pending:true})));expect(text(view.root)).not.toContain('2,200 kcal');
 });

 it.each([[320,1],[390,1],[320,2],[390,2]])('renders qualified inverse at width%s scale%s without food/bank mutation',async(width,fontScale)=>{
  controls.width=width;controls.fontScale=fontScale;const f=fixture();controls.plan.mockResolvedValue(f.response);
  const view=await render(React.createElement(EatingPlanPanel,{today:f.today,budget:f.budget,pending:false,allowed:true}));
  const input=view.root.findByProps({accessibilityLabel:'Planned total calories today'});expect(input.props.selectTextOnFocus).toBe(true);
  await act(async()=>input.props.onChangeText('2000'));await act(async()=>{vi.advanceTimersByTime(301);});
  expect(text(view.root)).toContain('24,500');expect(text(view.root)).toContain('14,500 more walking steps');expect(text(view.root)).toContain('Total calories for the day');expect(text(view.root)).not.toContain('Remaining Today');expect(text(view.root)).toContain('does not log food or change your bank');
  expect(controls.plan).toHaveBeenCalledExactlyOnceWith({direction:'intake_to_steps',totalIntakeCalories:2000},'UTC');
 });
 it('flag off makes zero feature reads/plans and never substitutes a number',async()=>{
  controls.enabled=false;function Hook(){const state=useEatingBudgetReadModel();return React.createElement('Model',{state});}
  await render(React.createElement(Hook));expect(controls.today).not.toHaveBeenCalled();expect(controls.budget).not.toHaveBeenCalled();expect(controls.provider).not.toHaveBeenCalled();
  await act(async()=>screen!.unmount());screen=undefined;const f=fixture();const view=await render(React.createElement(EatingPlanPanel,{today:f.today,budget:f.budget,pending:false,allowed:true}));
  expect(text(view.root)).toContain('Eating planning isn’t available yet.');expect(text(view.root)).not.toContain('1,536 kcal');expect(controls.plan).not.toHaveBeenCalled();
 });
 it('keeps independent total Budget when alignment/observed freshness is absent',async()=>{
  const f=fixture(),budget={...f.budget,planningAvailable:false,planningModel:null,planningUnavailableReason:'shared_step_alignment_unverified',intake:{calories:1000,semantic:'observed_current_day_intake' as const},budget:{...f.budget.budget,comparison:null,comparisonExpiresAt:null}} as EatingBudgetResponse;
  const view=await render(React.createElement(EatingPlanPanel,{today:f.today,budget,pending:false,allowed:true}));expect(text(view.root)).toContain('1,536 kcal');expect(text(view.root)).toContain('matching steps');expect(text(view.root)).not.toContain('Remaining Today');expect(controls.plan).not.toHaveBeenCalled();
 });
 it('binds inverse response to the exact requested total, context and expiry',()=>{
  const f=fixture(),bound={requestedTotalIntakeCalories:2000,response:f.response},now=new Date(anchor);
  expect(selectStepsForIntake(f.today,f.budget,bound,2000,now,true)?.totalSteps).toBe(24500);
  expect(selectStepsForIntake(f.today,f.budget,bound,1900,now,true)).toBeNull();expect(selectStepsForIntake(f.today,f.budget,bound,2000,new Date(expiry),true)).toBeNull();expect(selectStepsForIntake({...f.today,guidanceContextVersion:null},f.budget,bound,2000,now,true)).toBeNull();
  const invalid={...f.response,plan:{...f.response.plan,totalSteps:9000,additionalSteps:0}} as EatPlanningResponse;expect(selectStepsForIntake(f.today,f.budget,{requestedTotalIntakeCalories:2000,response:invalid},2000,now,true)).toBeNull();
 });
 it('discards late plan after input or refresh changes and retains the unsaved draft',async()=>{
  const f=fixture();let complete:(x:EatPlanningResponse)=>void=()=>{};controls.plan.mockImplementation(()=>new Promise(resolve=>{complete=resolve;}));
  const props={today:f.today,budget:f.budget,pending:false,allowed:true};const view=await render(React.createElement(EatingPlanPanel,props));
  const input=view.root.findByProps({accessibilityLabel:'Planned total calories today'});await act(async()=>input.props.onChangeText('2000'));await act(async()=>{vi.advanceTimersByTime(301);});
  await act(async()=>input.props.onChangeText('2100'));await act(async()=>complete(f.response));expect(text(view.root)).not.toContain('24,500');
  await act(async()=>view.update(React.createElement(EatingPlanPanel,{...props,pending:true,allowed:false})));expect(view.root.findByProps({accessibilityLabel:'Planned total calories today'}).props.value).toBe('2100');expect(text(view.root)).not.toContain('1,536 kcal');
 });
 it('expires only the observed comparison independently and never calls manual intake consumed',()=>{
  const f=fixture();expect(eatingComparison(f.budget,new Date(anchor)).kind).toBe('estimated_day_difference');
  const observed={...f.budget,intake:{calories:1000,semantic:'observed_current_day_intake'},budget:{...f.budget.budget,comparison:{kind:'remaining_today',calories:536},comparisonExpiresAt:'2026-02-10T12:05:00Z'}} as EatingBudgetResponse;
  expect(eatingComparison(observed,new Date(anchor)).kind).toBe('remaining_today');expect(eatingComparison(observed,new Date('2026-02-10T12:06:00Z')).kind).toBe('unavailable');expect(eatingComparison({...observed,intake:f.budget.intake},new Date(anchor)).kind).toBe('unavailable');
 });
});

it('discards a slow prior read after a new source/goal context generation completes',async()=>{
 const f=fixture(),nextContext=`g1:${'b'.repeat(64)}`;
 const nextToday={...f.today,guidanceContextVersion:nextContext},nextBudget={...f.budget,guidanceContextVersion:nextContext};
 let finishOld:(x:TodayResponse)=>void=()=>{};
 controls.today.mockImplementationOnce(()=>new Promise(resolve=>{finishOld=resolve;})).mockResolvedValueOnce(nextToday);
 controls.budget.mockResolvedValueOnce(f.budget).mockResolvedValueOnce(nextBudget);
 controls.provider.mockResolvedValue({expenditure:{selected:true,status:'ready'},activityContext:{status:'ready'},intake:{selected:true,status:'ready'}});
 function Hook(){return React.createElement('Model',{state:useEatingBudgetReadModel()});}
 const view=await render(React.createElement(Hook));await act(async()=>view.root.findByType('Model' as never).props.state.reload());
 expect(view.root.findByType('Model' as never).props.state.budget.guidanceContextVersion).toBe(nextContext);
 await act(async()=>finishOld(f.today));expect(view.root.findByType('Model' as never).props.state.today.guidanceContextVersion).toBe(nextContext);
});

it('withholds a completed read while account health refresh is still active',async()=>{
 const f=fixture();controls.running=true;controls.today.mockResolvedValue(f.today);controls.budget.mockResolvedValue(f.budget);controls.provider.mockResolvedValue({expenditure:{selected:true,status:'ready'},activityContext:{status:'ready'},intake:{selected:true,status:'ready'}});
 function Hook(){return React.createElement('Model',{state:useEatingBudgetReadModel()});}const view=await render(React.createElement(Hook));expect(view.root.findByType('Model' as never).props.state.allowed).toBe(false);expect(view.root.findByType('Model' as never).props.state.pending).toBe(true);
});

it('invalidates cached owner guidance immediately on a same-mounted-route account change',async()=>{
 const f=fixture(),nextContext=`g1:${'c'.repeat(64)}`;let finish:(x:TodayResponse)=>void=()=>{};
 controls.today.mockResolvedValueOnce(f.today).mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));controls.budget.mockResolvedValueOnce(f.budget).mockResolvedValueOnce({...f.budget,guidanceContextVersion:nextContext});controls.provider.mockResolvedValue({expenditure:{selected:true,status:'ready'},activityContext:{status:'ready'},intake:{selected:true,status:'ready'}});
 function Hook(){return React.createElement('Model',{state:useEatingBudgetReadModel()});}const view=await render(React.createElement(Hook));expect(view.root.findByType('Model' as never).props.state.allowed).toBe(true);
 await act(async()=>setDraftSession('synthetic-other-owner','synthetic-other-session'));const switched=view.root.findByType('Model' as never).props.state;expect(switched.allowed).toBe(false);expect(switched.budget).toBeNull();expect(switched.today).toBeNull();
 await act(async()=>finish({...f.today,guidanceContextVersion:nextContext}));expect(view.root.findByType('Model' as never).props.state.budget.guidanceContextVersion).toBe(nextContext);
});

it('does not relabel owner A cached Today after failed owner B read or late owner A completion',async()=>{
 const f=fixture(),contextB=`g1:${'d'.repeat(64)}`;let finishOld:(value:TodayResponse)=>void=()=>{};
 controls.today.mockResolvedValueOnce(f.today).mockImplementationOnce(()=>new Promise(resolve=>{finishOld=resolve;})).mockRejectedValueOnce(new Error('synthetic B read failure'));
 controls.budget.mockResolvedValueOnce(f.budget).mockResolvedValueOnce(f.budget).mockResolvedValueOnce({...f.budget,guidanceContextVersion:contextB});controls.provider.mockResolvedValue({expenditure:{selected:true,status:'ready'},activityContext:{status:'ready'},intake:{selected:true,status:'ready'}});
 function Hook(){return React.createElement('Model',{state:useEatingBudgetReadModel()});}const view=await render(React.createElement(Hook));expect(view.root.findByType('Model' as never).props.state.today).toEqual(f.today);
 await act(async()=>view.root.findByType('Model' as never).props.state.reload());
 await act(async()=>setDraftSession('synthetic-B-owner','synthetic-B-session'));
 let state=view.root.findByType('Model' as never).props.state;expect(state.failed).toBe(true);expect(state.allowed).toBe(false);expect(state.today).toBeNull();
 await act(async()=>finishOld(f.today));state=view.root.findByType('Model' as never).props.state;expect(state.today).toBeNull();expect(state.budget.guidanceContextVersion).toBe(contextB);
});


it('keeps projected-total and food-linked unavailable explanations independent',async()=>{
 const f=fixture();const budget={...f.budget,projectedEstimate:{status:'unavailable',basis:'caloriebank_adjusted_projection',estimated:true,reason:'projected_burn_unavailable'},budget:{status:'unavailable',reason:'expenditure_cutoff_unverified'},planningAvailable:false,planningModel:null} as EatingBudgetResponse;
 const view=await render(React.createElement(EatingPlanPanel,{today:f.today,budget,pending:false,allowed:true}));
 expect(text(view.root)).toContain('Your projected burn isn’t available for an eating estimate yet.');
 expect(text(view.root)).toContain('Your current burn data can’t yet link food totals with walking steps.');
 await act(async()=>view.update(React.createElement(EatingPlanPanel,{today:{...f.today,guidanceContextVersion:null},budget,pending:false,allowed:true})));
 expect(text(view.root)).not.toContain('link food totals with walking steps');expect(text(view.root)).not.toContain('Your projected burn isn’t available for an eating estimate yet.');expect(controls.plan).not.toHaveBeenCalled();
});

it('retains independent walking burn and strict forward plan, then distinguishes ordinary, missing and stale walking inputs',async()=>{
 const {WalkingEatingCard}=await import(resolve(__dirname,'../../mobile/components/caloriebank/WalkingEatingCard.tsx'));
 const f=fixture();const before=JSON.stringify(f);controls.plan.mockResolvedValue(f.response);
 const props={today:f.today,budget:f.budget,pending:false,onOpenDetails:vi.fn()};
 const view=await render(React.createElement(WalkingEatingCard,props));
 const input=view.root.findByProps({accessibilityLabel:'Walking plan total steps today'});
 await act(async()=>input.props.onChangeText('24500'));await act(async()=>{vi.advanceTimersByTime(301);});
 expect(text(view.root)).toContain('Hypothetical total intake today');expect(text(view.root)).toContain('Estimated daily burn at this step total');
 expect(controls.plan).toHaveBeenLastCalledWith({direction:'steps_to_intake',totalSteps:24500},'UTC');controls.plan.mockClear();
 await act(async()=>view.update(React.createElement(WalkingEatingCard,{...props,budget:null,planningUnavailableReason:'expenditure_cutoff_unverified'})));
 expect(text(view.root)).toContain('2,000 kcal');expect(text(view.root)).toContain('link food totals with walking steps');expect(input.props.editable).toBe(true);
 const ordinary={...f.today,steps:{...f.today.steps,ordinaryProjection:{expiresAt:expiry} as never}};
 await act(async()=>view.update(React.createElement(WalkingEatingCard,{...props,today:ordinary})));await act(async()=>{vi.advanceTimersByTime(301);});
 expect(text(view.root)).toContain('extra walking beyond your usual activity');expect(text(view.root)).not.toContain('2,000 kcal');expect(text(view.root)).not.toContain('needs step and calorie-burn data');expect(controls.plan).not.toHaveBeenCalled();
 await act(async()=>view.update(React.createElement(WalkingEatingCard,{...props,today:{...f.today,steps:{...f.today.steps,count:null,status:'unavailable'}}})));
 expect(text(view.root)).toContain('needs step and calorie-burn data');expect(text(view.root)).not.toContain('2,000 kcal');
 await act(async()=>view.update(React.createElement(WalkingEatingCard,props)));await act(async()=>{vi.advanceTimersByTime(30*60*1000);});
 expect(text(view.root)).toContain('Your walking estimate is out of date.');expect(text(view.root)).not.toContain('2,000 kcal');expect(JSON.stringify(f)).toBe(before);
});


it('suppresses supplied planning diagnostics when walking access, date or freshness changes',async()=>{
 const {WalkingEatingCard}=await import(resolve(__dirname,'../../mobile/components/caloriebank/WalkingEatingCard.tsx'));
 const f=fixture();const props={today:f.today,budget:null,planningUnavailableReason:'expenditure_cutoff_unverified',pending:false,onOpenDetails:vi.fn()};
 const view=await render(React.createElement(WalkingEatingCard,props));expect(text(view.root)).toContain('link food totals with walking steps');
 for(const change of [{guidanceAllowed:false},{today:{...f.today,date:'2026-02-09'}},{pending:true}]){
  await act(async()=>view.update(React.createElement(WalkingEatingCard,{...props,...change})));
  expect(text(view.root)).not.toContain('link food totals with walking steps');
 }
 await act(async()=>view.update(React.createElement(WalkingEatingCard,props)));await act(async()=>{vi.advanceTimersByTime(30*60*1000+1);});expect(text(view.root)).not.toContain('link food totals with walking steps');expect(controls.plan).not.toHaveBeenCalled();
});
