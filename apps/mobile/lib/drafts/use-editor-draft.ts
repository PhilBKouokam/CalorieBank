import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import type { NativeSyntheticEvent, TextInputSelectionChangeEventData } from 'react-native';
import { clearDraft, draftSessionGeneration, openDraft, ownsDraft, retainDraft, notifyDraft, type Draft, type Editor } from './session-drafts';

/** Setters write synchronously, before Android can detach the React surface. Unmount does not clear. */
export function useEditorDraft<T>(editor: Editor, initial: T, context = '', revision = '') {
  const owner = draftSessionGeneration();
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const holder = useRef<{ owner: number; draft: Draft<T> } | null>(null);
  if (!holder.current || holder.current.owner !== owner || holder.current.draft.context !== context) {
    holder.current = { owner, draft: openDraft(editor, context, revision, initial) };
  }
  const draft = holder.current.draft;
  const subscribe = useCallback((listener: () => void) => {
    draft.listeners.add(listener); return () => { draft.listeners.delete(listener); };
  }, [draft]);
  const snapshot = useCallback(() => draft.version, [draft]);
  useSyncExternalStore(subscribe, snapshot, snapshot);
  const current = useCallback(() => mounted.current && ownsDraft(editor, draft, owner), [editor, draft, owner]);
  const update = (value: T | ((previous: T) => T)) => {
    if (!current() || draft.saving) return;
    draft.value = typeof value === 'function' ? (value as (previous: T) => T)(draft.value) : value;
    retainDraft(editor, draft, owner);
    draft.dirty = true; notifyDraft(draft);
  };
  return {
    value: draft.value, update, isCurrent: current,
    conflict: draft.dirty && draft.revision !== revision,
    revision: draft.revision,
    /** For async-loaded editors. Never replace an existing dirty draft. */
    hydrate: (value: T, nextRevision: string) => {
      if (!current()) return;
      if (!draft.dirty) { draft.value = value; draft.revision = nextRevision; }
      notifyDraft(draft);
      return draft.revision === nextRevision;
    },
    /** Only called after explicit review of a newer committed value; keeps unsaved input. */
    reviewRevision: (nextRevision: string) => { if (current() && !draft.saving) { draft.revision = nextRevision; notifyDraft(draft); } },
    matches: (nextRevision: string) => current() && draft.revision === nextRevision,
    beginSave: () => { if (!current() || draft.saving) return false; draft.saving = true; notifyDraft(draft); return true; },
    endSave: () => { draft.saving = false; notifyDraft(draft); },
    clear: (outcome: 'saved' | 'cancelled' = 'cancelled') => {
      clearDraft(editor, draft, owner); draft.dirty = false;
      if (outcome === 'cancelled') draft.cancelled = true;
      notifyDraft(draft);
    },
    selection: (field: string) => ({
      selection: draft.selections[field],
      onSelectionChange: (event: NativeSyntheticEvent<TextInputSelectionChangeEventData>) => {
        if (current()) draft.selections[field] = event.nativeEvent.selection;
      },
    }),
  };
}
