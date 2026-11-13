import React from 'react';
import { readFileSync } from 'node:fs';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { resolve } from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
const h = vi.hoisted(() => ({
  keyboardVisible: false, keyboardListeners: {} as Record<string, () => void>, remove: vi.fn(),
  showSteps: true, navigate: vi.fn(), fontScale: 1, width: 390, fetch: vi.fn(), status: 'ready', expenditureStatus:'ready', budgetEnabled:false, budget:null as unknown, running: false,
  activity: null as null | ((running: boolean) => void),
  completion: null as null | ((result: { detail: string | null }) => void),
}));
vi.mock('../../mobile/lib/api/eating-budget',()=>({get eatingBudgetEnabled(){return h.budgetEnabled;},fetchEatingBudget:async()=>h.budget}));
vi.mock('expo-router', () => ({ useRouter: () => ({ push: vi.fn(), navigate: h.navigate }), useFocusEffect: (effect: () => void) => React.useEffect(effect, [effect]), Link: 'Link' }));
vi.mock('../../mobile/components/caloriebank/KeyboardSafeScrollView',()=>({KeyboardSafeScrollView:(props:object)=>React.createElement('ScrollView',props)}));
vi.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));
vi.mock('react-native', () => ({ Keyboard: { isVisible: () => h.keyboardVisible, addListener: (event: string, listener: () => void) => { h.keyboardListeners[event] = listener; return { remove: h.remove }; } }, Platform: { OS: 'ios' }, Text: 'Text', View: 'View', Pressable: 'Pressable', ScrollView: 'ScrollView', TextInput:'TextInput',Switch:'Switch',AppState:{addEventListener:()=>({remove:()=>{}})}, RefreshControl: 'RefreshControl', ActivityIndicator: 'ActivityIndicator',
  Modal: () => null, useWindowDimensions: () => ({ fontScale: h.fontScale, width: h.width }), StyleSheet: { flatten: (value: unknown) => Object.assign({}, ...[value].flat(Infinity).filter(Boolean)), create: <T,>(value: T) => value } }));
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
  updateDashboardPreferences: vi.fn(),
  fetchDashboardPreferences: async () => ({ showTodaySoFar: true, showSteps:h.showSteps, stepsVisibilitySource:'explicit', showCurrentGoal: true }),
}));
let screen: ReactTestRenderer;
const model = (calories: number | null = null) => ({ date: new Date().toISOString().slice(0, 10), timezone: 'UTC',
  burned: { adjusted: null, raw: null, status: 'unavailable' }, eaten: { calories, status: calories === null ? 'unavailable' : 'ready', source: calories === null ? null : 'Cronometer' },
  steps: { count: null, status: 'unavailable' }, workouts: { items: [] }, restOfDayProjection: { status: 'insufficient_data' } });
afterEach(async () => { if (screen) await act(async () => screen.unmount()); vi.useRealTimers();h.showSteps=true;h.expenditureStatus='ready';h.budgetEnabled=false;h.budget=null;h.keyboardVisible=false;h.remove.mockClear(); });
async function mount() {
  h.fetch.mockResolvedValue(model());h.running=false;
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const { default: Today } = await import(resolve(__dirname, '../../mobile/app/(tabs)/today.tsx'));
  await act(async () => { screen = create(React.createElement(Today)); });
}

const scroll=()=>screen.root.find(node=>String(node.type)==='ScrollView');
const header=()=>screen.root.findByProps({testID:'today-sticky-activity-header'});
async function measure(headerHeight=96,viewportHeight=800){await act(async()=>{header().props.onLayout({nativeEvent:{layout:{height:headerHeight}}});scroll().props.onLayout({nativeEvent:{layout:{height:viewportHeight}}});});}
it('pins only first direct activity child after measured fit, preserving one keyboard scroll owner',async()=>{
  await mount();expect(scroll().props.stickyHeaderIndices).toEqual([]);
  await measure();expect(scroll().props.stickyHeaderIndices).toEqual([0]);
  expect(scroll().props.children[0].props.testID).toBe('today-sticky-activity-header');
  expect(screen.root.findAll(node => String(node.type) === 'ScrollView')).toHaveLength(1);
  expect(scroll().props.horizontal).toBeUndefined();
  expect(scroll().props.refreshControl.props.onRefresh).toBeTypeOf('function');
});
it('lets large-text or short viewport header scroll instead of consuming the screen',async()=>{
  await mount();await measure(240,800);expect(scroll().props.stickyHeaderIndices).toEqual([]);
  await measure(96,300);expect(scroll().props.stickyHeaderIndices).toEqual([]);
  await measure(96,800);expect(scroll().props.stickyHeaderIndices).toEqual([0]);
});
it('unpins before iOS keyboard arrival, keeps unpinned while shown and restores on dismissal',async()=>{
  await mount();await measure();
  await act(async()=>h.keyboardListeners.keyboardWillShow!());expect(scroll().props.stickyHeaderIndices).toEqual([]);
  await act(async()=>h.keyboardListeners.keyboardDidShow!());expect(scroll().props.stickyHeaderIndices).toEqual([]);
  await act(async()=>h.keyboardListeners.keyboardDidHide!());expect(scroll().props.stickyHeaderIndices).toEqual([0]);
  await act(async()=>screen.unmount());expect(h.remove).toHaveBeenCalledTimes(3);
});
it('starts unpinned when keyboard is already visible',async()=>{
  h.keyboardVisible=true;await mount();await measure();expect(scroll().props.stickyHeaderIndices).toEqual([]);
});
it('rejects nonfinite/zero measurements instead of pinning an unmeasured header',async()=>{
  const {canStickTodayActivityHeader}=await import(resolve(__dirname,'../../mobile/components/caloriebank/TodayStepsCard.tsx'));
  expect(canStickTodayActivityHeader(0,800,false)).toBe(false);
  expect(canStickTodayActivityHeader(96,NaN,false)).toBe(false);
  expect(canStickTodayActivityHeader(Infinity,800,false)).toBe(false);
  expect(canStickTodayActivityHeader(200,800,false)).toBe(true);
});

it('does not render Fitness Goal even if saved Today preference is enabled; Settings keeps the route',async()=>{
  await mount();
  const text=screen.root.findAll(node => String(node.type) === 'Text').flatMap(node => node.children.filter(child => typeof child === 'string')).join(' ');
  expect(text).not.toContain('Fitness Goal');
  expect(text).not.toContain('goal-settings');
  const todaySource=readFileSync(resolve(__dirname,'../../mobile/app/(tabs)/today.tsx'),'utf8');
  expect(todaySource).not.toContain("router.push('/goal-settings')");
  const settingsSource=readFileSync(resolve(__dirname,'../../mobile/app/(tabs)/settings.tsx'),'utf8');
  expect(settingsSource).toContain("href: '/goal-settings'");
  expect(settingsSource).toContain("label: 'Fitness Goal'");
});

it('removes obsolete customization toggle while leaving other preferences available',async()=>{
  const {default:CustomizeToday}=await import(resolve(__dirname,'../../mobile/app/(settings)/customize-today.tsx'));
  await act(async()=>{screen=create(React.createElement(CustomizeToday));});
  const labels=screen.root.findAll(node=>String(node.type)==='Switch').map(node=>node.props.accessibilityLabel);
  expect(labels).not.toContain('Show Fitness Goal');
  expect(labels).toContain('Show Walking plan');
  expect(labels).toContain('Show Today so far');
  expect(labels).toContain('Show Logged workouts');
});


it('keeps the activity rail transparent at rest and while pinned', async () => {
  await mount();
  expect(header().props.style.backgroundColor).toBe('transparent');
  await measure();
  expect(header().props.style.backgroundColor).toBe('transparent');
  expect(header().props.style.paddingHorizontal).toBe(16);
  expect(header().props.style.marginHorizontal).toBe(-16);
});


it('restores the approved distinct Today colors and contextual information icons', async () => {
  await mount();
  const style = (label: string) => {
    const node = screen.root.findAll(node => String(node.type) === 'Text' && node.props.children === label)[0]!;
    return Object.assign({}, ...[node.props.style].flat(Infinity).filter(Boolean));
  };
  expect(style('Burned').color).toBe('#B54708');
  expect(style('Eaten').color).toBe('#245BA6');
  expect(style('Projected burn').color).toBe('#8A5A12');
  expect(style('Eating budget').color).toBe('#176E61');
  for (const label of ['Why does CalorieBank use 80 percent?', 'What is my eating budget?']) {
    const action = screen.root.find(node => String(node.type) === 'Pressable' && node.props.accessibilityLabel === label);
    expect(action.findByProps({ name: 'information-circle-outline' })).toBeTruthy();
    const event = { stopPropagation: vi.fn() };
    await act(async () => action.props.onPress(event));
    expect(event.stopPropagation).toHaveBeenCalledOnce();
  }
  expect(screen.root.findAll(node => String(node.type) === 'Text' && node.props.children === 'Why 80%?')).toHaveLength(0);
});
it('keeps the burn target card visible even when the optional walking card is hidden or data is unavailable', async () => {
  h.showSteps = false;
  await mount();
  expect(screen.root.findAll(node => String(node.type) === 'Text' && node.props.children === 'If I want to burn…')).toHaveLength(1);
  expect(screen.root.findAll(node => String(node.type) === 'Text' && node.props.children === 'If I walk…')).toHaveLength(0);
  const input = screen.root.find(node => String(node.type) === 'TextInput' && node.props.accessibilityLabel === 'Desired estimated actual calories burned today');
  expect(input.props.selectTextOnFocus).toBe(true);
});


it('does not gate burn-only planning on the intake connection', async () => {
  h.status = 'needs_attention';
  try {
    await mount();
    h.fetch.mockResolvedValue({ ...model(), burned: { raw: 1200, adjusted: 960, adjustmentFactor: 0.8, status: 'ready', source: 'Fitbit' } });
    await act(async () => h.completion!({ detail: null }));
    const card = screen.root.find(node => typeof node.type === 'function' && node.type.name === 'StepPlanningCards');
    expect(card.props.inverseOnly).toBe(true);
    expect(card.props.guidanceAllowed).toBe(true);
    const walking = screen.root.find(node => typeof node.type === 'function' && node.type.name === 'WalkingEatingCard');
    expect(walking.props.guidanceAllowed).toBe(false);
  } finally {
    h.status = 'ready';
  }
});
