import React from 'react';
import { resolve } from 'node:path';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  width: 390, fontScale: 1, history: vi.fn(), detail: vi.fn(), sources: vi.fn(), change: vi.fn(), alert: vi.fn(),
}));
vi.mock('expo', () => ({ requireNativeModule: vi.fn() }));
vi.mock('expo-crypto', () => ({ randomUUID: () => 'history-review-request' }));
vi.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));
vi.mock('react-native', () => ({
  useWindowDimensions: () => ({ width: h.width, fontScale: h.fontScale }),
  ActivityIndicator: 'ActivityIndicator', Alert: { alert: h.alert }, Modal: 'Modal',
  Platform: { OS: 'ios' }, Pressable: 'Pressable', ScrollView: 'ScrollView', Text: 'Text', View: 'View',
  StyleSheet: { flatten: (value: unknown) => Object.assign({}, ...[value].flat(Infinity).filter(Boolean)), create: <T,>(value: T) => value },
}));
vi.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
vi.mock('expo-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useFocusEffect: (callback: () => void) => React.useEffect(callback, [callback]),
}));
vi.mock('../../mobile/lib/native-health/index.ios', () => ({ refreshNativeHealthForCurrentAccount: vi.fn() }));
vi.mock('../../mobile/lib/api/client', () => ({
  fetchBankHistory: h.history, fetchBankHistoryDay: h.detail,
  fetchHistoricalSourceOptions: h.sources, changeHistoricalSource: h.change,
  fetchProviderSelection: vi.fn(), syncFatSecret: vi.fn(), syncFitbit: vi.fn(),
  ApiHttpError: class extends Error {},
}));

const day = {
  logDate: '2026-11-06', status: 'provisional', provenance: 'finalized',
  timezone: 'America/Chicago', locksAt: '2026-11-09T06:00:00Z', dailyBankChange: 940,
  importedTotalDailyExpenditure: 4547, expenditureAdjustmentRate: 0.8,
  adjustedExpenditure: 3638, goalMode: 'maintain', goalAdjustmentCalories: 0,
  importedCalorieIntake: 2698, versions: [],
};
const history = {
  openingBankStatus: 'initialized', availableBankCalories: 1100, recoveryCalories: 0,
  endDate: day.logDate,
  days: [day, { ...day, logDate: '2026-11-05', dailyBankChange: -200 }, { ...day, logDate: '2026-11-04', dailyBankChange: 0 }],
  missingDays: [{ logDate: '2026-11-03', message: 'Waiting for food data', canRetry: false }],
};
let view: ReactTestRenderer | undefined;
const text = (node: ReactTestInstance) => node.children.filter((value) => typeof value === 'string').join('');
const texts = (value: string) => view!.root.findAll((node) => String(node.type) === 'Text' && text(node) === value);
const button = (label: string) => view!.root.findAll((node) => String(node.type) === 'Pressable')
  .filter((node) => node.props.accessibilityLabel === label || node.findAll((child) => String(child.type) === 'Text' && text(child) === label).length > 0).at(-1)!;
const style = (value: unknown): Record<string, unknown> => Object.assign({}, ...[value].flat(Infinity).filter(Boolean));

async function mount() {
  const { default: Screen } = await import(resolve(__dirname, '../../mobile/app/(details)/bank-history.tsx'));
  await act(async () => { view = create(React.createElement(Screen)); });
}

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.clearAllMocks();
  vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-11-07T15:00:00Z'));
  h.width = 390; h.fontScale = 1;
  h.history.mockResolvedValue(history);
  h.detail.mockImplementation(async (date: string) => history.days.find((entry) => entry.logDate === date));
  h.sources.mockResolvedValue({
    expenditure: { selected: { label: 'Fitbit' }, canChange: false },
    intake: { selected: { label: 'Cronometer' }, canChange: false },
  });
});
afterEach(async () => {
  if (view) await act(async () => view!.unmount());
  view = undefined;
  vi.restoreAllMocks();
});


vi.mock('../../mobile/components/caloriebank/KeyboardSafeScrollView',()=>({KeyboardSafeScrollView:'KeyboardSafeScrollView'}));
vi.mock('../../mobile/components/caloriebank/StepPlanningCards',()=>({StepPlanningCards:'StepPlanningCards'}));
vi.mock('../../mobile/lib/today/use-today-read-model',()=>({useTodayReadModel:()=>({today:null,failed:false})}));

it('keeps normal390 history row layout and scales without changing type sizes',async()=>{
  await mount();
  const row=button('2026-11-06, Banked, +940 kcal');
  expect(style(row.props.style({pressed:false})).flexDirection).toBe('row');
  expect(style(texts('+940 kcal')[0]!.props.style).fontSize).toBe(16);
});
it('stacks date/status and amount at320 with2x text',async()=>{
  h.width=320;h.fontScale=2;await mount();
  const row=button('2026-11-06, Banked, +940 kcal');
  expect(style(row.props.style({pressed:false})).flexDirection).toBe('column');
  expect(style(texts('+940 kcal')[0]!.props.style).textAlign).toBe('left');
  expect(style(texts('+940 kcal')[0]!.props.style).fontSize).toBe(16);
  expect(texts('Banked')).toHaveLength(1);
  const identity=row.findAll(node => String(node.type) === 'View' && style(node.props.style).flexBasis === 'auto')[0]!;
  expect(style(identity.props.style).flexBasis).toBe('auto');
  expect(style(identity.props.style).flexShrink).toBe(0);
  expect(row.props.onPress).toBeTypeOf('function');
});
it('uses measured list width when narrower than the screen',async()=>{
  await mount();
  const list=view!.root.findAll(node=>typeof node.props.onLayout==='function').find(node=>style(node.props.style).overflow==='hidden')!;
  await act(async()=>list.props.onLayout({nativeEvent:{layout:{width:230}}}));
  expect(style(button('2026-11-06, Banked, +940 kcal').props.style({pressed:false})).flexDirection).toBe('column');
});
it('keeps exact step count intact and enables only local horizontal scroll when measured overflow exists',async()=>{
  const {StepCount}=await import(resolve(__dirname,'../../mobile/app/(details)/steps-detail.tsx'));
  await act(async()=>{view=create(React.createElement(StepCount,{count:42201}));});
  const scroll=()=>view!.root.find(node=>String(node.type)==='ScrollView');
  expect(scroll().props.horizontal).toBe(true);
  expect(scroll().props.scrollEnabled).toBe(false);
  const number=texts('42,201')[0]!;
  expect(number.props.numberOfLines).toBe(1);
  expect(number.props.accessibilityLabel).toBe('42,201 steps today');
  expect(number.props.adjustsFontSizeToFit).toBeUndefined();
  expect(style(number.props.style).fontSize).toBe(44);
  await act(async()=>{scroll().props.onLayout({nativeEvent:{layout:{width:252}}});scroll().props.onContentSizeChange(300,104);});
  expect(scroll().props.scrollEnabled).toBe(true);
  expect(scroll().props.showsHorizontalScrollIndicator).toBe(true);
  expect(texts('Scroll sideways to see the full count.')).toHaveLength(1);
  await act(async()=>scroll().props.onLayout({nativeEvent:{layout:{width:360}}}));
  expect(scroll().props.scrollEnabled).toBe(false);
  expect(texts('Scroll sideways to see the full count.')).toHaveLength(0);
});
