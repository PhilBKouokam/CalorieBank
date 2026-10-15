import { useState } from 'react';
import { draftSessionGeneration } from './session-drafts';
import { SettingsConflictError, type SettingSnapshot } from '../api/settings-concurrency';

export function useSettingsConflict<T>(draft: { isCurrent: () => boolean; reviewRevision: (revision: string) => void }, load: () => Promise<SettingSnapshot<T>>) {
  const owner = draftSessionGeneration();
  const [pending, setLatest] = useState<{ owner: number; snapshot: SettingSnapshot<T> } | null>(null);
  const latest = pending?.owner === owner ? pending.snapshot : null;
  const show = (snapshot: SettingSnapshot<T>) => { if (draft.isCurrent()) setLatest({ owner, snapshot }); };
  return { latest, show,
    handle: async (error: unknown) => {
      if (!(error instanceof SettingsConflictError)) return false;
      if (!draft.isCurrent()) return true;
      // A failed reload never grants permission to overwrite: original revision remains attached.
      try { show(await load()); } catch { return false; } return true;
    },
    review: () => { if (latest && draft.isCurrent()) { draft.reviewRevision(latest.revision); setLatest(null); } },
  };
}
