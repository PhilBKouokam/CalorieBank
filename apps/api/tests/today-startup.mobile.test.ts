import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
const h = vi.hoisted(() => ({
  fetch: vi.fn(), status: 'ready', expenditureStatus:'ready', budgetEnabled:false, budget:null as unknown, running: false,
  activity: null as null | ((running: boolean) => void),
  completion: null as null | ((result: { detail: string | null }) => void),
}));
vi.mock('../../mobile/lib/api/eating-budget',()=>({get eatingBudgetEnabled(){return h.budgetEnabled;},fetchEatingBudget:async()=>h.budget}));
vi.mock('expo-router', () => ({ useRouter: () => ({ push: vi.fn() }), useFocusEffect: (effect: () => void) => React.useEffect(effect, [effect]), Link: 'Link' }));
vi.mock('../../mobile/components/caloriebank/KeyboardSafeScrollView',()=>({KeyboardSafeScrollView:(props:object)=>React.createElement('ScrollView',props)}));
vi.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));
vi.mock('react-native', () => ({ Platform: { OS: 'android' }, Keyboard: { isVisible: () => false, addListener: () => ({remove: () => {}}) },  Text: 'Text', View: 'View', Pressable: 'Pressable', ScrollView: 'ScrollView', TextInput:'TextInput',AppState:{addEventListener:()=>({remove:()=>{}})}, RefreshControl: 'RefreshControl', ActivityIndicator: 'ActivityIndicator',
  Modal: () => null, useWindowDimensions: () => ({ fontScale: 1 }), StyleSheet: { flatten: (value: unknown) => Object.assign({}, ...[value].flat(Infinity).filter(Boolean)), create: <T,>(value: T) => value } }));
vi.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
vi.mock('../../mobile/lib/lifecycle/account-lifecycle', () => ({
  isAccountLifecycleRunning: () => h.running,
  subscribeToAccountLifecycleActivity: (listener: typeof h.activity) => { h.activity = listener; listener!(h.running); return () => {}; },
  subscribeToAccountLifecycle: (listener: typeof h.completion) => { h.completion = listener; return () => {}; },
  runAccountLifecycle: vi.fn(),
}));
vi.mock('../../mobile/lib/api/client', () => ({
  getApiBaseUrl: () => 'https://fixture.invalid', fetchToday: h.fetch,
  fetchProviderSelection: async () => ({ expenditure: { selected: true, status: h.expenditureStatus, displayName: 'Fitbit' }, activityContext:{status:'ready'}, intake: { selected: true, status: h.status, displayName: 'Cronometer' } }),
  fetchGoalConfiguration: async () => ({ goalMode: 'maintain' }), fetchPlannedTreat: async () => ({ status: 'no_plan' }),
  fetchBankSummary: async () => ({ openingBankStatus: 'initialized', availableBankCalories: 0, recoveryCalories: 0 }),
  fetchOnboardingStatus: async () => ({ completed: true, preparation: { history: 'complete' } }),
  fetchDashboardPreferences: async () => ({ showTodaySoFar: true, showSteps:true }),
}));
let screen: ReactTestRenderer;
const output = () => screen.root.findAll(node => String(node.type) === 'Text').map(node =>
  node.children.filter(child => typeof child === 'string').join('')).join('\n');
const model = (calories: number | null = null) => ({ date: new Date().toISOString().slice(0, 10), timezone: 'UTC',
  burned: { adjusted: null, raw: null, status: 'unavailable' }, eaten: { calories, status: calories === null ? 'unavailable' : 'ready', source: calories === null ? null : 'Cronometer' },
  steps: {}, workouts: { items: [] } });
afterEach(async () => { if (screen) await act(async () => screen.unmount()); vi.useRealTimers();h.expenditureStatus='ready';h.budgetEnabled=false;h.budget=null; });
async function mount() {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const { default: Today } = await import(resolve(__dirname, '../../mobile/app/(tabs)/today.tsx'));
  await act(async () => { screen = create(React.createElement(Today)); });
}
describe('rendered Today startup', () => {
  it('shows loading through slow initial reads, then awaiting data without connection recovery', async () => {
    h.status = 'ready'; h.running = true;
    let finish!: (value: ReturnType<typeof model>) => void;
    h.fetch.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    await mount(); expect(output()).toContain('Loading today');
    expect(output()).not.toMatch(/Not connected|Review Health Connections|couldn’t update/);
    await act(async () => finish(model()));
    expect(output()).toContain('Loading…'); expect(output()).not.toContain('Review Health Connections');
    h.fetch.mockResolvedValue(model()); h.running = false;
    await act(async () => { h.activity!(false); h.completion!({ detail: null }); });
    expect(output()).toContain('No intake today'); expect(output()).not.toContain('Review Health Connections');
  });
  it('retains confirmed same-day calories during loading and temporary failure', async () => {
    h.status = 'ready'; h.running = false; h.fetch.mockResolvedValue(model(2498)); await mount();
    await act(async () => h.activity!(true)); expect(output()).toContain('2,498');
    h.fetch.mockRejectedValue(new Error('offline'));
    await act(async () => { h.activity!(false); h.completion!({ detail: 'CalorieBank couldn’t update. Try again.' }); });
    expect(output()).toContain('2,498'); expect(output()).not.toContain('Review Health Connections');
    await act(async () => h.activity!(true)); expect(output()).not.toContain('couldn’t update');
  });
  it('shows connection recovery for a confirmed revoked source after loading completes', async () => {
    h.status = 'needs_attention'; h.running = false; h.fetch.mockResolvedValue(model()); await mount();
    expect(output()).toContain('Review Health Connections');
  });
  it('does not carry yesterday into a new date and reports a completed failed fetch without claiming disconnection', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-23T23:59:00Z'));
    h.status = 'ready'; h.running = false; h.fetch.mockResolvedValue(model(2498)); await mount();
    expect(output()).toContain('2,498');
    vi.setSystemTime(new Date('2026-09-24T00:01:00Z'));
    await act(async () => h.activity!(true));
    expect(output()).not.toContain('2,498'); expect(output()).toContain('Loading today');
    h.fetch.mockRejectedValue(new Error('offline'));
    await act(async () => { h.activity!(false); h.completion!({ detail: 'CalorieBank couldn’t update. Try again.' }); });
    expect(output()).not.toMatch(/2,498|Not connected|Review Health Connections|Loading today/);
    expect(output()).toContain('Try again');
    h.fetch.mockResolvedValue(model(125));
    await act(async () => h.completion!({ detail: null }));
    expect(output()).toContain('125');
  });
});

it('withholds cached projected and walking guidance during lifecycle, failed or unresolved reads while preserving observations',async()=>{
 vi.useFakeTimers();const now=new Date('2026-02-10T12:00:00Z');vi.setSystemTime(now);h.running=false;h.status='ready';
 const q={status:'ready',basis:'matched_total_above_selected_quiet',rawIncrementalKcalPerStep:.04,baselineModelVersion:'synthetic-model',calibrationVersion:'synthetic-cal',baselineProviderKcalPerHour:60,rawProjectedBurnBeforeWalking:1920,planningAnchorAt:now.toISOString(),expiresAt:new Date(now.getTime()+5*60000).toISOString(),localDate:'2026-02-10',timezone:'UTC',source:'Fitbit',stepsPerMinute:100,walkingSampleCount:1};
 const ready={...model(1000),burned:{raw:1200,adjusted:960,adjustmentFactor:.8,status:'ready',source:'Fitbit'},steps:{count:10000,source:'Fitbit',status:'ready',planningSnapshotReady:true,quietWalkingForecast:q},restOfDayProjection:{status:'ready',evidenceType:'historical_low_activity_hours',modelVersion:'synthetic-model',providerKcalPerHour:60,projectedAdjustedBurnCalories:1540,unroundedProjectedProviderBurnCalories:1920,planningAnchorAt:now.toISOString(),planningExpiresAt:new Date(now.getTime()+30*60000).toISOString()}};
 h.fetch.mockResolvedValue(ready);await mount();expect(output()).toContain('1,540 kcal');
 expect(output().indexOf('Burned')).toBeLessThan(output().indexOf('Eaten'));expect(output().indexOf('Eaten')).toBeLessThan(output().indexOf('Projected burn'));expect(output().indexOf('Projected burn')).toBeLessThan(output().indexOf('Eating budget'));
 await act(async()=>h.activity?.(true));expect(output()).not.toContain('1,540 kcal');expect(output()).toContain('960 kcal');
 h.fetch.mockRejectedValueOnce(Error('synthetic offline'));await act(async()=>{h.activity?.(false);h.completion?.({detail:null});});expect(output()).not.toContain('1,540 kcal');expect(output()).toContain('960 kcal');
 h.fetch.mockResolvedValue(ready);await act(async()=>h.completion?.({detail:null}));expect(output()).toContain('1,540 kcal');
 h.status='needs_attention';await act(async()=>h.completion?.({detail:null}));expect(output()).toContain('1,540 kcal');expect(output()).toContain('Review Health Connections');expect(output()).not.toContain('Estimated daily burn at this step total');
});

function readyBurnProjection(){
 const now=new Date();return {...model(),burned:{raw:1200,adjusted:960,adjustmentFactor:.8,status:'ready',source:'Synthetic wearable'},steps:{count:null,status:'unavailable'},restOfDayProjection:{status:'ready',planningAnchorKind:'reported_interval',planningAnchorAt:now.toISOString(),planningExpiresAt:new Date(now.getTime()+30*60000).toISOString(),projectedAdjustedBurnCalories:3000}};
}
it.each(['needs_attention','not_connected'])('shows a ready burn projection when only intake is %s, preserving its recovery message',async(status)=>{
 vi.useFakeTimers();vi.setSystemTime(new Date('2026-02-10T12:00:00Z'));h.running=false;h.status=status;h.expenditureStatus='ready';h.fetch.mockResolvedValue(readyBurnProjection());await mount();
 expect(output()).toContain('3,000 kcal');expect(output()).toContain('Review Health Connections');expect(output()).toContain('960 kcal');
 await act(async()=>h.activity?.(true));expect(output()).not.toContain('3,000 kcal');
});
it('withholds projection for expenditure recovery, stale/expired projection or failed current reads',async()=>{
 vi.useFakeTimers();vi.setSystemTime(new Date('2026-02-10T12:00:00Z'));h.running=false;h.status='needs_attention';h.expenditureStatus='needs_attention';const ready=readyBurnProjection();h.fetch.mockResolvedValue(ready);await mount();expect(output()).not.toContain('3,000 kcal');
 h.expenditureStatus='stale';await act(async()=>h.completion?.({detail:null}));expect(output()).not.toContain('3,000 kcal');
 h.expenditureStatus='ready';h.fetch.mockResolvedValue({...ready,restOfDayProjection:{...ready.restOfDayProjection,status:'stale'}});await act(async()=>h.completion?.({detail:null}));expect(output()).not.toContain('3,000 kcal');
 h.fetch.mockResolvedValue({...ready,restOfDayProjection:{...ready.restOfDayProjection,planningExpiresAt:'2026-02-10T11:59:59Z'}});await act(async()=>h.completion?.({detail:null}));expect(output()).not.toContain('3,000 kcal');
 h.fetch.mockResolvedValue(ready);await act(async()=>h.completion?.({detail:null}));expect(output()).toContain('3,000 kcal');
 h.fetch.mockRejectedValueOnce(new Error('synthetic read failure'));await act(async()=>h.completion?.({detail:null}));expect(output()).not.toContain('3,000 kcal');expect(output()).toContain('960 kcal');
});

it('renders the projected total eating estimate even when intake needs recovery',async()=>{
 vi.useFakeTimers();vi.setSystemTime(new Date('2026-02-10T12:00:00Z'));h.running=false;h.status='needs_attention';h.budgetEnabled=true;
 const ready={...readyBurnProjection(),guidanceContextVersion:`g1:${'c'.repeat(64)}`};
 h.budget={guidanceContextVersion:ready.guidanceContextVersion,localDate:ready.date,timezone:ready.timezone,budget:{status:'unavailable',reason:'expenditure_cutoff_unverified'},projectedEstimate:{status:'ready',basis:'caloriebank_adjusted_projection',estimated:true,totalCalories:2200,projectedAdjustedBurnCalories:3000,expiresAt:'2026-02-10T12:30:00Z'}};
 h.fetch.mockResolvedValue(ready);await mount();expect(output()).toContain('2,200 kcal');expect(output()).toContain('3,000 kcal');expect(output()).toContain('Review Health Connections');
 await act(async()=>h.activity?.(true));expect(output()).not.toContain('2,200 kcal');
});


it('keeps burn planning visible without a projection and recovers when planning data arrives', async () => {
  h.status = 'ready'; h.running = false;
  h.fetch.mockResolvedValue(model());
  await mount();
  expect(output()).toContain('If I want to burn…');
  expect(output()).toMatch(/This estimate needs recent step and calorie-burn data.|Refresh your activity data to update this estimate./);
  expect(output()).not.toContain('NaN');
  const refreshed = { ...model(), restOfDayProjection: { status: 'insufficient_data' } };
  h.fetch.mockResolvedValue(refreshed);
  await act(async () => { h.activity!(false); h.completion!({ detail: null }); });
  expect(output()).toContain('If I want to burn…');
  expect(output()).not.toContain('NaN');
});
