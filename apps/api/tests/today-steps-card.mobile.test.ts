vi.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeAll, expect, it, vi } from 'vitest';
import type { TodayResponse } from '@caloriebank/schemas';
const dimensions = vi.hoisted(() => ({ width: 600, fontScale: 1 }));
vi.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));
vi.mock('react-native', () => ({ Platform: { OS: 'ios' }, Text: 'Text', View: 'View', ScrollView: 'ScrollView', useWindowDimensions: () => dimensions, StyleSheet: { flatten: (value: unknown) => Object.assign({}, ...[value].flat(Infinity).filter(Boolean)), create: <T,>(value: T) => value } }));
import { resolve } from 'node:path';
let TodayStepsCard: React.ComponentType<{ steps: TodayResponse['steps'] | undefined; pending: boolean; refreshFailed: boolean }>;
beforeAll(async () => { ({ TodayStepsCard } = await import(resolve(__dirname, '../../mobile/components/caloriebank/TodayStepsCard.tsx'))); });
let TodayActivityCards: React.ComponentType<{ today: TodayResponse | null; now: Date; pending: boolean; refreshFailed: boolean; restingAllowed: boolean; walkingAllowed: boolean }>;
beforeAll(async () => { ({ TodayActivityCards } = await import(resolve(__dirname, '../../mobile/components/caloriebank/TodayStepsCard.tsx'))); });
let screen: ReactTestRenderer;
const steps = (count: number | null, status: TodayResponse['steps']['status'] = 'ready') => ({ count, status } as TodayResponse['steps']);
async function render(value: TodayResponse['steps'] | undefined, pending = false, refreshFailed = false) {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  await act(async () => { screen = create(React.createElement(TodayStepsCard, { steps: value, pending, refreshFailed })); });
}
const label = () => screen.root.find(node => node.props.accessible === true).props.accessibilityLabel;
afterEach(async () => { dimensions.width = 600; dimensions.fontScale = 1; if (screen) await act(async () => screen.unmount()); });
it.each([0, 18538, 123456])('shows the observed %s count, not a calorie or forecast estimate', async count => {
  await render(steps(count));
  expect(label()).toBe(`Steps today, ${count.toLocaleString()} steps`);
  expect(screen.root.find(node => String(node.type) === 'Icon').props.name).toBe('walk-outline');
  const value = screen.root.find(node => String(node.type) === 'Text' && node.children.includes(count.toLocaleString()));
  expect(value.props.numberOfLines).toBeUndefined();
  expect(screen.root.findAll(node => node.props.onPress)).toHaveLength(0);
});
it.each([
  [undefined, true, false, 'Loading…'],
  [steps(null), false, false, 'Unavailable. No step data yet'],
  [steps(null, 'not_connected'), false, false, 'Unavailable. Connect a tracker in Settings'],
  [steps(null, 'error'), false, true, 'Unavailable. Pull down to try again'],
  [steps(18538, 'stale'), false, false, '18,538 steps. May be out of date'],
  [steps(18538), false, true, '18,538 steps. May be out of date'],
  [steps(18538), true, false, '18,538 steps. Refreshing…'],
  [steps(18538, 'partial'), false, false, '18,538 steps. Still updating'],
  [steps(18538, 'not_connected'), false, false, 'Unavailable. Connect a tracker in Settings'],
] as const)('keeps missing, stale and refresh states honest: %s', async (value, pending, failed, text) => {
  await render(value, pending, failed); expect(label()).toBe(`Steps today, ${text}`);
});

const now = new Date('2026-11-07T12:00:00');
function fixture() { return { date: '2026-11-07', burned: { status: 'ready', adjustmentFactor: 0.8 },
  steps: { count: 18538, status: 'ready', estimationStatus: 'ready', providerReportedCaloriesPer1000Steps: 50, adjustedCaloriesPer1000Steps: 40 },
  restOfDayProjection: { status: 'ready', providerKcalPerHour: 100, adjustedKcalPerHour: 80, projectedAdjustedBurnCalories: 2000,
    planningAnchorKind: 'measurement', planningAnchorAt: new Date(now.getTime()-3600000).toISOString(), planningExpiresAt: new Date(now.getTime()+3600000).toISOString() } }; }
async function rates(today = fixture(), overrides = {}) {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  await act(async () => { screen=create(React.createElement(TodayActivityCards, {today: today as unknown as TodayResponse, now, pending:false, refreshFailed:false, restingAllowed:true, walkingAllowed:true, ...overrides})); });
  return screen.root.findAll(node => node.props.accessible === true).map(node => node.props.accessibilityLabel).join(' | ');
}
it('shows existing adjusted rates with units and their adjustment, never recomputing from steps', async () => {
  const text=await rates(); expect(text).toContain('Resting burn, ~80 kilocalories per hour. Estimate · 100 × 0.8');
  expect(text).toContain('Per 1,000 steps, ~40 kcal. Estimate · 50 × 0.8');
});
it.each([{pending:true}, {refreshFailed:true}, {restingAllowed:false,walkingAllowed:false}])('hides unqualified rates %s', async overrides => {
  const text=await rates(fixture(),overrides); expect(text).not.toContain('~80'); expect(text).not.toContain('~40');
});
it('hides expired rest estimates without suppressing qualified walking calibration', async () => {
  const data=fixture(); data.restOfDayProjection.planningExpiresAt=now.toISOString(); const text=await rates(data);
  expect(text).not.toContain('~80'); expect(text).toContain('~40');
});
it('hides prior-date observations and rates', async () => {
  const data=fixture(); data.date='2026-11-06'; const text=await rates(data);
  expect(text).not.toContain('18,538'); expect(text).not.toContain('~80'); expect(text).not.toContain('~40');
});
it('does not present missing calibration as zero', async () => {
  const data=fixture(); data.steps.adjustedCaloriesPer1000Steps=NaN; expect(await rates(data)).toContain('Per 1,000 steps, Unavailable');
});

it('keeps healthy top cards to labels and numbers while preserving accessible adjustment context', async () => {
  const spoken=await rates();
  const visible=screen.root.findAll(node => String(node.type) === 'Text').flatMap(node => node.children).join(' ');
  expect(visible).toContain('Resting burn ~80 kcal/h');
  expect(visible).toContain('Per 1,000 steps ~40 kcal');
  expect(visible).not.toContain('×');
  expect(visible).not.toContain('Estimate');
  expect(spoken).toContain('Estimate · 100 × 0.8');
  expect(spoken).toContain('Estimate · 50 × 0.8');
});

it('shows all three compact cards in order without a sideways carousel', async () => {
  const spoken=await rates();
  expect(spoken.indexOf('Steps today')).toBeLessThan(spoken.indexOf('Per 1,000 steps'));
  expect(spoken.indexOf('Per 1,000 steps')).toBeLessThan(spoken.indexOf('Resting burn'));
  expect(screen.root.findAll(node => String(node.type)==='ScrollView')).toHaveLength(0);
});

it('keeps two readable inline metrics on phones instead of squeezing the optional rest tile', async () => {
  dimensions.width = 390;
  const spoken = await rates();
  expect(spoken).toContain('Steps today');
  expect(spoken).toContain('Per 1,000 steps');
  expect(spoken).not.toContain('Resting burn');
});

it('compacts pill spacing without reducing label or value type', async () => {
  dimensions.width=390;await rates();
  const flatten=(value:unknown):Record<string,unknown>=>Object.assign({},...[value].flat(Infinity).filter(Boolean));
  const card=screen.root.findAll(node=>String(node.type)==='View'&&node.props.accessible===true)[0]!;
  expect(flatten(card.props.style)).toMatchObject({paddingHorizontal:10,paddingVertical:7,borderRadius:18,gap:7});
  const label=screen.root.find(node=>String(node.type)==='Text'&&node.children.includes('Steps today'));
  const value=screen.root.find(node=>String(node.type)==='Text'&&node.children.includes('18,538'));
  expect(flatten(label.props.style).fontSize).toBe(12);
  expect(flatten(value.props.style).fontSize).toBe(18);
  expect(value.props.maxFontSizeMultiplier).toBeUndefined();
  expect(value.props.numberOfLines).toBeUndefined();
});
it('still stacks compact pills at accessibility text sizes with no truncation', async () => {
  dimensions.width=320;dimensions.fontScale=2;await rates();
  const flatten=(value:unknown):Record<string,unknown>=>Object.assign({},...[value].flat(Infinity).filter(Boolean));
  const row=screen.root.findAll(node=>String(node.type)==='View'&&Array.isArray(node.props.style)).find(node=>flatten(node.props.style).gap===8)!;
  expect(flatten(row.props.style).flexDirection).toBe('column');
  for(const text of screen.root.findAll(node=>String(node.type)==='Text')){
    expect(text.props.numberOfLines).toBeUndefined();expect(text.props.maxFontSizeMultiplier).toBeUndefined();
  }
});
