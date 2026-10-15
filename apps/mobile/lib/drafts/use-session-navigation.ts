import { useEffect, useRef } from 'react';
import { useNavigationContainerRef } from 'expo-router';
import type { NavigationState, PartialState } from '@react-navigation/native';
import { onDraftSessionReset, clearEditorDraft, draftSessionGeneration, draftSessionReady, type Editor } from './session-drafts';

type State = NavigationState | PartialState<NavigationState>;
let saved: { owner: number; state: State } | null = null;
onDraftSessionReset(() => { saved = null; });
const editors: Record<string, Editor> = {
  'edit-calories': 'calorie-correction', 'manual-estimate': 'usual-estimate',
  'today-burn': 'step-planning', 'steps-detail': 'step-planning',
  'goal-settings': 'fitness-goal', 'daily-bank-target': 'daily-bank-target', 'planned-treat': 'banking-goal',
};
function routes(state: State): string[] {
  return state.routes.flatMap(route => [route.name, ...(route.state ? routes(route.state) : [])]);
}
function leaf(state: State): string {
  const route = state.routes[state.index ?? 0];
  return route?.state ? leaf(route.state) : route?.name ?? '';
}
/** Only navigation state, never component input/destructive confirmation. No disk persistence. */
export function rememberNavigation(state: State) {
  if (!draftSessionReady()) return;
  const owner = draftSessionGeneration();
  if (['index', 'sign-in', 'sign-up'].includes(leaf(state))) return;
  const names = routes(state);
  if (names.includes('delete-account')) { saved = null; return; }
  if (saved?.owner === owner) {
    for (const name of routes(saved.state)) if (editors[name] && !names.some(next => editors[next] === editors[name])) clearEditorDraft(editors[name]);
  }
  saved = { owner, state };
}
export function restorableNavigation(): State | null {
  if (!draftSessionReady() || saved?.owner !== draftSessionGeneration()) { saved = null; return null; }
  return saved.state;
}
export function useSessionNavigation(enabled = true) {
  const navigation = useNavigationContainerRef();
  const pending = useRef<State | null | undefined>(undefined);
  useEffect(() => {
    if (!enabled) return;
    if (pending.current === undefined) pending.current = restorableNavigation();
    function changed() {
      const state = navigation.getRootState();
      if (!enabled || !state || !draftSessionReady() || ['index', 'sign-in', 'sign-up'].includes(leaf(state))) return;
      // The existing authenticated setup gate runs first. Never bypass it with saved navigation.
      if (pending.current && leaf(state) !== 'onboarding') {
        const restore = pending.current; pending.current = null;
        if (restorableNavigation() === restore && leaf(restore) !== 'onboarding') { navigation.resetRoot(restore); return; }
      }
      pending.current = null;
      rememberNavigation(state);
    }
    const unsubscribe = navigation.addListener('state', changed);
    changed();
    return unsubscribe;
  }, [navigation, enabled]);
}
