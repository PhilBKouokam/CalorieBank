import React from 'react';
import { resolve } from 'node:path';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  history: vi.fn(), detail: vi.fn(), sources: vi.fn(), change: vi.fn(), alert: vi.fn(),
}));
vi.mock('expo', () => ({ requireNativeModule: vi.fn() }));
vi.mock('expo-crypto', () => ({ randomUUID: () => 'history-review-request' }));
vi.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));
vi.mock('react-native', () => ({ useWindowDimensions: () => ({ width: 390, height: 844, fontScale: 1, scale: 1 }),
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
const output = () => JSON.stringify(view!.toJSON());

async function mount() {
  const { default: Screen } = await import(resolve(__dirname, '../../mobile/app/(details)/bank-history.tsx'));
  await act(async () => { view = create(React.createElement(Screen)); });
}

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.clearAllMocks();
  vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-11-07T15:00:00Z'));
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

it('shows one page title and one available balance without repeating the brand', async () => {
  await mount();
  expect(texts('History')).toHaveLength(1);
  expect(texts('Available Bank')).toHaveLength(1);
  expect(texts('CalorieBank')).toHaveLength(0);
  expect(texts('1,100 kcal')).toHaveLength(1);
  expect(texts('1,100 kcal')[0]!.props.numberOfLines).toBeUndefined();
  expect(texts('Banked')).toHaveLength(1);
  expect(texts('Enjoyed')).toHaveLength(1);
  expect(texts('No change')).toHaveLength(1);
});

it('keeps signed amounts and uses teal, purple and neutral without punishment colors', async () => {
  await mount();
  expect(style(texts('+940 kcal')[0]!.props.style).color).toBe('#176C65');
  expect(style(texts('-200 kcal')[0]!.props.style).color).toBe('#70558D');
  expect(style(texts('0 kcal')[0]!.props.style).color).toBe('#626D69');
  expect(style(texts('4,547 kcal')[0]!.props.style).color).toBe('#A45B1F');
  expect(style(texts('2,698 kcal')[0]!.props.style).color).toBe('#345FAD');
  expect(output()).toContain('3,638 − 2,698 = +940 kcal');
  expect(texts('May still update as your source syncs.')).toHaveLength(1);
});

it('preserves range and exact-day selection, including selected accessibility state', async () => {
  await mount();
  expect(button('W').props.accessibilityState.selected).toBe(true);
  await act(async () => button('M').props.onPress());
  expect(h.history).toHaveBeenLastCalledWith('M');
  expect(button('M').props.accessibilityState.selected).toBe(true);
  const enjoyed = button('2026-11-05, Enjoyed, -200 kcal');
  await act(async () => enjoyed.props.onPress());
  expect(h.detail).toHaveBeenLastCalledWith('2026-11-05');
  expect(h.sources).toHaveBeenLastCalledWith('2026-11-05');
  expect(button('2026-11-05, Enjoyed, -200 kcal').props.accessibilityState.selected).toBe(true);
  expect(texts('Enjoyed 200 kcal')).toHaveLength(1);
  expect(h.change).not.toHaveBeenCalled();
});

it('keeps missing days readable and opens the existing missing-data explanation', async () => {
  await mount();
  expect(texts('Waiting for food data')).toHaveLength(1);
  await act(async () => button('2026-11-03, Waiting for food data').props.onPress());
  expect(h.alert).toHaveBeenCalledWith('Nov 3', 'Waiting for food data', [{ text: 'OK' }]);
  expect(h.change).not.toHaveBeenCalled();
});

it('shows honest uncalculated and empty states without a fabricated zero balance', async () => {
  h.history.mockResolvedValue({ ...history, openingBankStatus: 'pending', days: [], missingDays: [] });
  await mount();
  expect(texts('Not calculated')).toHaveLength(1);
  expect(texts('No completed days yet.')).toHaveLength(1);
  expect(texts('0 kcal')).toHaveLength(0);
  expect(h.detail).not.toHaveBeenCalled();
});

it('keeps Recovery separate from the nonnegative bank balance', async () => {
  h.history.mockResolvedValue({ ...history, availableBankCalories: 0, recoveryCalories: 380, days: [day], missingDays: [] });
  await mount();
  expect(texts('0 kcal')).toHaveLength(1);
  expect(texts('380 kcal to recover')).toHaveLength(1);
  expect(texts('New deposits will restore your bank first.')).toHaveLength(1);
});

it('retains retry on failed history and restores content after retry', async () => {
  h.history.mockRejectedValueOnce(new Error('Offline'));
  await mount();
  expect(texts('Bank history is unavailable.')).toHaveLength(1);
  await act(async () => button('Try again').props.onPress());
  expect(texts('1,100 kcal')).toHaveLength(1);
  expect(texts('Bank history is unavailable.')).toHaveLength(0);
});

it('keeps a loading indicator while history is still pending', async () => {
  h.history.mockReturnValue(new Promise(() => {}));
  await mount();
  expect(view!.root.findAllByProps({ accessibilityLabel: 'Loading completed days' })).toHaveLength(1);
  expect(texts('Not calculated')).toHaveLength(1);
});

it('keeps source selection cancelable and sends only the selected exact-date change', async () => {
  const postedDay = { ...day, versions: [{ expenditureProvider: 'google_health_fitbit', intakeProvider: 'fatsecret' }] };
  const selected = { id: 'fitbit-current-source', label: 'Fitbit' };
  const alternative = { id: 'apple-health-source', label: 'Apple Health' };
  const sources = {
    expenditure: { selected, options: [selected, alternative], canChange: true, revision: 3 },
    intake: { selected: { id: 'fatsecret-source', label: 'FatSecret' }, options: [], canChange: false, revision: 1 },
  };
  h.detail.mockResolvedValue(postedDay);
  h.sources.mockResolvedValue(sources);
  h.change.mockResolvedValue({ day: postedDay, sources });
  await mount();
  const sourceButton = button('Change calories burned source');
  expect(style(sourceButton.props.style).minHeight).toBe(44);
  await act(async () => sourceButton.props.onPress());
  expect(view!.root.find((node) => String(node.type) === 'Modal').props.visible).toBe(true);
  await act(async () => button('Cancel').props.onPress());
  expect(view!.root.find((node) => String(node.type) === 'Modal').props.visible).toBe(false);
  expect(h.change).not.toHaveBeenCalled();
  await act(async () => button('Change calories burned source').props.onPress());
  await act(async () => button('Apple Health').props.onPress());
  expect(h.change).toHaveBeenCalledExactlyOnceWith('2026-11-06', 'expenditure', {
    optionId: 'apple-health-source', expectedRevision: 3, idempotencyKey: 'history-review-request',
  });
  expect(view!.root.find((node) => String(node.type) === 'Modal').props.visible).toBe(false);
});
