import React from 'react';
import { resolve } from 'node:path';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import type { IntakeAdjustmentState, ManualIntakeState } from '@caloriebank/schemas';
import { setDraftSession, terminateDraftSession, openDraft, draftSessionGeneration, ownsDraft } from '../../mobile/lib/drafts/session-drafts';

const api = vi.hoisted(() => ({ save: vi.fn(), manual: vi.fn(), goal: vi.fn(), saveGoal: vi.fn(), target: vi.fn(), saveTarget: vi.fn(), treat: vi.fn(), saveTreat: vi.fn() }));
vi.mock('react-native', () => ({ Text: 'Text', TextInput: 'TextInput', Pressable: 'Pressable', View: 'View', ScrollView: 'ScrollView', ActivityIndicator: 'ActivityIndicator',
  StyleSheet: { create: <T,>(s: T) => s }, useWindowDimensions: () => ({ fontScale: 2, width: 390, height: 800, scale: 2 }) }));
vi.mock('../../mobile/lib/today/use-planning-clock', () => ({ usePlanningClock: () => ({ now: new Date('2026-10-15T12:00:00Z'), expired: false }) }));
vi.mock('expo-router', () => ({ useRouter: () => ({ replace: vi.fn() }), useNavigationContainerRef: () => ({}) }));
vi.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'View' }));
vi.mock('../../mobile/components/caloriebank/KeyboardSafeScrollView', () => ({ KeyboardSafeScrollView: 'ScrollView' }));
vi.mock('../../mobile/components/caloriebank/PlaceholderScreen', () => ({ PlaceholderScreen: 'ScrollView' }));
vi.mock('../../mobile/lib/api/settings-concurrency', () => ({
  SettingsConflictError: class SettingsConflictError extends Error {},
  fetchProtectedGoal: async () => { const value = await api.goal(); return { value, revision: value?.updatedAt ?? '0' }; },
  fetchProtectedTarget: async () => { const value = await api.target(); return { value, revision: String(value.calories) }; },
  fetchProtectedTreat: async () => { const value = await api.treat(); return { value, revision: String(value.requiredCalories ?? 0) }; },
  saveProtectedGoal: api.saveGoal, saveProtectedTarget: api.saveTarget, saveProtectedTreat: api.saveTreat, deleteProtectedTreat: api.saveTreat,
}));
vi.mock('../../mobile/lib/api/client', () => ({ saveIntakeAdjustment: api.save, saveManualIntake: api.manual, ApiHttpError: class extends Error {},
  fetchGoalConfiguration: api.goal, saveGoalConfiguration: api.saveGoal, fetchDailyBankTarget: api.target, saveDailyBankTarget: api.saveTarget,
  fetchPlannedTreat: api.treat, updatePlannedTreat: api.saveTreat, createOrReplacePlannedTreat: api.saveTreat, deletePlannedTreat: vi.fn() }));
let view: ReactTestRenderer | undefined;
const base: IntakeAdjustmentState = { localDate: '2026-10-15', revision: 7, selectionRevision: null, manualRevision: 0,
  source: 'Cronometer', baseCalories: 1935, calories: 2035, adjustment: { mode: 'add', calories: 100 } };
const manual: ManualIntakeState = { selectionEnabled: true, selected: true, localDate: base.localDate, revision: 7, selectionRevision: null, estimate: null };
async function mount(element: React.ReactElement) { await act(async () => { view = create(element); }); }
async function recreate(element: React.ReactElement) { await act(async () => view!.unmount()); await mount(element); }
function inputs() { return view!.root.findAll(n => String(n.type) === 'TextInput'); }
async function type(value: string, index = 0) { await act(async () => inputs()[index]!.props.onChangeText(value)); }
async function press(label: string) {
  const button = view!.root.findAll(n => String(n.type) === 'Pressable').find(n => n.findAll(t => String(t.type) === 'Text').some(t => t.props.children === label));
  expect(button, label).toBeDefined(); await act(async () => button!.props.onPress());
}
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }); vi.clearAllMocks(); terminateDraftSession(); setDraftSession('account-a', 'session-a');
  api.goal.mockResolvedValue({ goalMode: 'cut', dailyEnergyAdjustment: -500, adjustmentSource: 'manual_calories', desiredWeeklyWeightChange: null, updatedAt: 'v1' });
  api.target.mockResolvedValue({ calories: 100, chosen: true }); api.saveTarget.mockResolvedValue({ calories: 150, chosen: true });
  api.treat.mockResolvedValue({ status: 'saving', id: 'goal-a', name: 'Dinner', requiredCalories: 1000, targetDate: null, remainingCalories: 1000, progressPercent: 0 });
});
afterEach(async () => { if (view) await act(async () => view!.unmount()); view = undefined; terminateDraftSession(); });

it('restores 150 across complete root destruction, leaves saved 100 untouched, and saves once explicitly', async () => {
  const { IntakeAdjustmentEditor } = await import(resolve(__dirname, '../../mobile/components/caloriebank/IntakeAdjustmentEditor.tsx'));
  const saved = vi.fn(); const element = React.createElement(IntakeAdjustmentEditor, { state: base, onSaved: saved, onCancel: vi.fn() });
  await mount(element); await type('150');
  await act(async () => inputs()[0]!.props.onSelectionChange({ nativeEvent: { selection: { start: 1, end: 2 } } }));
  await recreate(element);
  expect(inputs()[0]!.props.value).toBe('150'); expect(inputs()[0]!.props.selection).toEqual({ start: 1, end: 2 });
  expect(base.adjustment!.calories).toBe(100); expect(api.save).not.toHaveBeenCalled();
  await press('Save'); expect(api.save).toHaveBeenCalledTimes(1); expect(api.save.mock.calls[0]![0]).toMatchObject({ calories: 150, mode: 'add', expectedRevision: 7 });
  expect(saved).toHaveBeenCalledOnce(); await recreate(element); expect(inputs()[0]!.props.value).toBe('100');
});
it('Cancel clears the draft without saving', async () => {
  const { IntakeAdjustmentEditor } = await import(resolve(__dirname, '../../mobile/components/caloriebank/IntakeAdjustmentEditor.tsx'));
  const element = React.createElement(IntakeAdjustmentEditor, { state: base, onSaved: vi.fn(), onCancel: vi.fn() });
  await mount(element); await type('150'); await press('Cancel'); await recreate(element);
  expect(inputs()[0]!.props.value).toBe('100'); expect(api.save).not.toHaveBeenCalled();
});
it('retains a changed-revision draft for review and blocks saving over the newer adjustment', async () => {
  const { IntakeAdjustmentEditor } = await import(resolve(__dirname, '../../mobile/components/caloriebank/IntakeAdjustmentEditor.tsx'));
  const tree = (state: IntakeAdjustmentState) => React.createElement(IntakeAdjustmentEditor, { state, onSaved: vi.fn(), onCancel: vi.fn() });
  await mount(tree(base)); await type('150'); await recreate(tree({ ...base, revision: 8 }));
  expect(inputs()[0]!.props.value).toBe('150'); await press('Save'); expect(api.save).not.toHaveBeenCalled();
  expect(JSON.stringify(view!.toJSON())).toContain('Cancel and reopen');
});
it.each(['source', 'date', 'account', 'session', 'process'] as const)('never applies incompatible %s drafts', async kind => {
  const { IntakeAdjustmentEditor } = await import(resolve(__dirname, '../../mobile/components/caloriebank/IntakeAdjustmentEditor.tsx'));
  const tree = (state: IntakeAdjustmentState) => React.createElement(IntakeAdjustmentEditor, { state, onSaved: vi.fn(), onCancel: vi.fn() });
  await mount(tree(base)); await type('150');
  if (kind === 'account') setDraftSession('account-b', 'session-b');
  if (kind === 'session') setDraftSession('account-a', 'session-new');
  if (kind === 'process') { terminateDraftSession(); setDraftSession('account-a', 'session-a'); }
  await recreate(tree({ ...base, ...(kind === 'source' ? { source: 'Another tracker', selectionRevision: 'new' } : {}), ...(kind === 'date' ? { localDate: '2026-10-16' } : {}) }));
  expect(inputs()[0]!.props.value).toBe('100'); expect(api.save).not.toHaveBeenCalled();
});
it('restores usual estimate and selected correction mode without automatic saving', async () => {
  const { ManualEstimateEditor } = await import(resolve(__dirname, '../../mobile/components/caloriebank/ManualEstimateEditor.tsx'));
  const element = React.createElement(ManualEstimateEditor, { state: manual, mode: 'usual', onSaved: vi.fn(), onCancel: vi.fn() });
  await mount(element); await type('2500'); await recreate(element); expect(inputs()[0]!.props.value).toBe('2500'); expect(api.manual).not.toHaveBeenCalled();
  await press('Cancel'); await recreate(element); expect(inputs()[0]!.props.value).toBe('');
  const { IntakeAdjustmentEditor } = await import(resolve(__dirname, '../../mobile/components/caloriebank/IntakeAdjustmentEditor.tsx'));
  const correction = React.createElement(IntakeAdjustmentEditor, { state: base, onSaved: vi.fn(), onCancel: vi.fn() });
  await recreate(correction); await act(async () => view!.root.findAll(n => String(n.type) === 'Pressable' && n.props.accessibilityRole === 'radio')[1]!.props.onPress());
  await type('2200'); await recreate(correction); expect(inputs()[0]!.props.value).toBe('2200'); await press('Save');
  expect(api.save.mock.calls[0]![0]).toMatchObject({ mode: 'replace', calories: 2200 });
});
it.each(['fitness', 'daily', 'setup-daily', 'banking'] as const)('restores the %s form after root recreation', async kind => {
  let element: React.ReactElement;
  if (kind === 'fitness') { const { GoalConfigurationForm } = await import(resolve(__dirname, '../../mobile/components/caloriebank/GoalConfigurationForm.tsx')); element = React.createElement(GoalConfigurationForm, { mode: 'settings', onSaved: vi.fn() }); }
  else if (kind === 'daily') { const { default: Screen } = await import(resolve(__dirname, '../../mobile/app/(settings)/daily-bank-target.tsx')); element = React.createElement(Screen); }
  else if (kind === 'setup-daily') { const { DailyBankTargetForm } = await import(resolve(__dirname, '../../mobile/components/caloriebank/DailyBankTargetForm.tsx')); element = React.createElement(DailyBankTargetForm, { initialCalories: 100, onSaved: vi.fn() }); }
  else { const { default: Screen } = await import(resolve(__dirname, '../../mobile/app/(settings)/planned-treat.tsx')); element = React.createElement(Screen); }
  await mount(element); await type(kind === 'banking' ? 'Unsaved dinner' : '150');
  if (kind === 'banking') await type('1700', 1);
  await recreate(element); expect(inputs()[0]!.props.value).toBe(kind === 'banking' ? 'Unsaved dinner' : '150');
  if (kind === 'banking') expect(inputs()[1]!.props.value).toBe('1700');
  expect(api.saveGoal).not.toHaveBeenCalled(); expect(api.saveTarget).not.toHaveBeenCalled(); expect(api.saveTreat).not.toHaveBeenCalled();
});
it('invalidates stale owners and never restores module drafts after a fresh module/process', async () => {
  const owner = draftSessionGeneration(), old = openDraft('usual-estimate', 'day', '1', '150');
  setDraftSession('account-b', 'session-b'); expect(ownsDraft('usual-estimate', old, owner)).toBe(false);
  terminateDraftSession(); setDraftSession('account-a', 'session-a');
  expect(openDraft('usual-estimate', 'day', '1', '100').value).toBe('100');
});

it('keeps both Step Planning targets after root recreation and discards them on source/date change', async () => {
  const { StepPlanningCards } = await import(resolve(__dirname, '../../mobile/components/caloriebank/StepPlanningCards.tsx'));
  // Only the Step Planning contract is exercised; other Today cards are not mounted.
  const today = { date: '2026-10-15', timezone: 'America/Chicago',
    burned: { source: 'google_health_fitbit', status: 'ready', adjustmentFactor: 0.8 },
    steps: { source: 'google_health_fitbit', status: 'ready', count: 2000, caloriesPerStep: 0.05, walkingPace: null },
    restOfDayProjection: { status: 'ready', projectedProviderBurnCalories: 3540, unroundedProjectedProviderBurnCalories: 3540 },
  } as unknown as import('@caloriebank/schemas').TodayResponse;
  const tree = (value = today) => React.createElement(StepPlanningCards, { today: value });
  await mount(tree()); await type('4000'); await type('20000', 1); await recreate(tree());
  expect(inputs().map(n => n.props.value)).toEqual(['4000', '20000']);
  await recreate(tree({ ...today, date: '2026-10-16' })); expect(inputs()[0]!.props.value).not.toBe('4000');
});
it('restored Daily Bank Target cannot overwrite a changed saved target', async () => {
  const { default: Screen } = await import(resolve(__dirname, '../../mobile/app/(settings)/daily-bank-target.tsx'));
  const element = React.createElement(Screen); await mount(element); await type('150');
  api.target.mockResolvedValue({ calories: 200, chosen: true }); await recreate(element);
  expect(inputs()[0]!.props.value).toBe('150'); await press('Save target'); expect(api.saveTarget).not.toHaveBeenCalled();
});
it('restored Fitness Goal cannot overwrite a changed saved goal', async () => {
  const { GoalConfigurationForm } = await import(resolve(__dirname, '../../mobile/components/caloriebank/GoalConfigurationForm.tsx'));
  const element = React.createElement(GoalConfigurationForm, { mode: 'settings', onSaved: vi.fn() });
  await mount(element); await type('150'); api.goal.mockResolvedValue({ goalMode: 'cut', dailyEnergyAdjustment: -600, adjustmentSource: 'manual_calories', desiredWeeklyWeightChange: null, updatedAt: 'v2' });
  await recreate(element); expect(inputs()[0]!.props.value).toBe('150'); await press('Save Cut goal'); expect(api.saveGoal).not.toHaveBeenCalled();
});
it('holds the same save lock across root recreation and never submits twice while the first save is pending', async () => {
  const { IntakeAdjustmentEditor } = await import(resolve(__dirname, '../../mobile/components/caloriebank/IntakeAdjustmentEditor.tsx'));
  let finish!: () => void; api.save.mockImplementationOnce(() => new Promise<void>(resolve => { finish = resolve; }));
  const tree = React.createElement(IntakeAdjustmentEditor, { state: base, onSaved: vi.fn(), onCancel: vi.fn() });
  await mount(tree); await type('150'); await press('Save'); await recreate(tree); await press('Save');
  expect(api.save).toHaveBeenCalledOnce(); await act(async () => finish());
});
it('does not let an old account’s in-flight save navigate the new account', async () => {
  const { IntakeAdjustmentEditor } = await import(resolve(__dirname, '../../mobile/components/caloriebank/IntakeAdjustmentEditor.tsx'));
  let finish!: () => void; api.save.mockImplementationOnce(() => new Promise<void>(resolve => { finish = resolve; }));
  const saved = vi.fn(); await mount(React.createElement(IntakeAdjustmentEditor, { state: base, onSaved: saved, onCancel: vi.fn() }));
  await type('150'); await press('Save'); setDraftSession('account-b', 'session-b'); await act(async () => finish());
  expect(saved).not.toHaveBeenCalled();
});
it.each(['fitness', 'daily', 'banking'] as const)('retains %s edits after server conflict and retries only after explicit review', async kind => {
  const { SettingsConflictError } = await import('../../mobile/lib/api/settings-concurrency');
  let tree: React.ReactElement, saveLabel: string;
  const save = kind === 'fitness' ? api.saveGoal : kind === 'daily' ? api.saveTarget : api.saveTreat;
  if (kind === 'fitness') { const { GoalConfigurationForm } = await import(resolve(__dirname, '../../mobile/components/caloriebank/GoalConfigurationForm.tsx')); tree = React.createElement(GoalConfigurationForm, { mode: 'settings', onSaved: vi.fn() }); saveLabel = 'Save Cut goal'; }
  else if (kind === 'daily') { const { default: Screen } = await import(resolve(__dirname, '../../mobile/app/(settings)/daily-bank-target.tsx')); tree = React.createElement(Screen); saveLabel = 'Save target'; }
  else { const { default: Screen } = await import(resolve(__dirname, '../../mobile/app/(settings)/planned-treat.tsx')); tree = React.createElement(Screen); saveLabel = 'Save Banking Goal'; }
  await mount(tree); await type(kind === 'banking' ? 'My draft' : '150');
  if (kind === 'fitness') api.goal.mockResolvedValue({ goalMode: 'cut', dailyEnergyAdjustment: -600, adjustmentSource: 'manual_calories', desiredWeeklyWeightChange: null, updatedAt: '2' });
  if (kind === 'daily') api.target.mockResolvedValue({ calories: 200, chosen: true });
  if (kind === 'banking') api.treat.mockResolvedValue({ status: 'saving', id: 'goal-a', name: 'New committed goal', requiredCalories: 2000, targetDate: null, remainingCalories: 2000, progressPercent: 0, availableBankCalories: 0, progressCalories: 0 });
  save.mockRejectedValueOnce(new SettingsConflictError());
  await press(saveLabel);
  expect(inputs()[0]!.props.value).toBe(kind === 'banking' ? 'My draft' : '150');
  expect(JSON.stringify(view!.toJSON())).toContain('Latest saved value:');
  await press(saveLabel); expect(save).toHaveBeenCalledTimes(1);
  await recreate(tree); expect(inputs()[0]!.props.value).toBe(kind === 'banking' ? 'My draft' : '150');
  await press('Keep my edits'); expect(save).toHaveBeenCalledTimes(1);
  await press(saveLabel); expect(save).toHaveBeenCalledTimes(2);
  expect(save.mock.calls[1]![1]).toBe(kind === 'fitness' ? '2' : kind === 'daily' ? '200' : '2000');
});

it('never carries a conflict preview into another account even when the React component remains mounted', async () => {
  const { useEditorDraft } = await import('../../mobile/lib/drafts/use-editor-draft');
  const { useSettingsConflict } = await import('../../mobile/lib/drafts/use-settings-conflict');
  function Probe({ tick }: { tick: number }) {
    const draft = useEditorDraft('daily-bank-target', '0');
    const conflict = useSettingsConflict(draft, async () => ({ value: 'Account A private target', revision: '2' }));
    return React.createElement('Probe', { tick, show: () => conflict.show({ value: 'Account A private target', revision: '2' }), latest: conflict.latest?.value ?? null });
  }
  await mount(React.createElement(Probe, { tick: 0 }));
  await act(async () => view!.root.find(n => String(n.type) === 'Probe').props.show());
  expect(view!.root.find(n => String(n.type) === 'Probe').props.latest).toBe('Account A private target');
  setDraftSession('account-b', 'session-b');
  await act(async () => view!.update(React.createElement(Probe, { tick: 1 })));
  expect(view!.root.find(n => String(n.type) === 'Probe').props.latest).toBeNull();
});
