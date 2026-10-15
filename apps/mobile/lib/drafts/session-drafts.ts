/** Same-JS-process memory only. Never serialize this module to disk or an API. */
export type Editor = 'calorie-correction' | 'usual-estimate' | 'fitness-goal' | 'daily-bank-target' | 'banking-goal' | 'step-planning';
export type Selection = { start: number; end: number };
export type Draft<T> = {
  context: string; revision: string; value: T; selections: Record<string, Selection>;
  cancelled: boolean; dirty: boolean; saving: boolean; version: number; listeners: Set<() => void>;
};
let session: string | null = null;
let generation = 0;
const resetListeners = new Set<() => void>();
export function onDraftSessionReset(listener: () => void) { resetListeners.add(listener); return () => resetListeners.delete(listener); }
const drafts = new Map<Editor, Draft<unknown>>();

/** Call only after auth hydration. Transient loading is not session termination. */
export function setDraftSession(account: string | null, sessionId: string | null) {
  const next = account && sessionId ? JSON.stringify([account, sessionId]) : null;
  if (next === session) return;
  drafts.clear(); session = next; generation++; resetListeners.forEach(listener => listener());
}
export function terminateDraftSession() { drafts.clear(); session = null; generation++; resetListeners.forEach(listener => listener()); }
export function draftSessionGeneration() { return generation; }
export function draftSessionReady() { return session !== null; }

export function openDraft<T>(editor: Editor, context: string, revision: string, initial: T): Draft<T> {
  const existing = session ? drafts.get(editor) : undefined;
  // Editor names have one canonical value type. Identity changes discard incompatible drafts.
  if (existing?.context === context) return existing as Draft<T>;
  const draft: Draft<T> = { context, revision, value: initial, selections: {}, cancelled: false, dirty: false, saving: false, version: 0, listeners: new Set() };
  if (session) drafts.set(editor, draft);
  return draft;
}
export function ownsDraft(editor: Editor, draft: Draft<unknown>, owner: number) {
  return !draft.cancelled && generation === owner && (!session || !drafts.has(editor) || drafts.get(editor) === draft);
}
export function clearDraft(editor: Editor, draft: Draft<unknown>, owner: number) {
  if (ownsDraft(editor, draft, owner)) drafts.delete(editor);
}
export function clearEditorDraft(editor: Editor) {
  const draft = drafts.get(editor); if (draft) draft.cancelled = true;
  drafts.delete(editor);
}
export function retainDraft(editor: Editor, draft: Draft<unknown>, owner: number) {
  if (ownsDraft(editor, draft, owner) && session) drafts.set(editor, draft);
}

export function onboardingDraftStage(): 'goal' | 'daily_bank_target' | null {
  for (const [editor, stage] of [['fitness-goal', 'goal'], ['daily-bank-target', 'daily_bank_target']] as const) {
    const draft = drafts.get(editor);
    if (session && draft?.dirty && draft.context === 'onboarding') return stage;
  }
  return null;
}

export function notifyDraft(draft: Draft<unknown>) { draft.version++; draft.listeners.forEach(listener => listener()); }
