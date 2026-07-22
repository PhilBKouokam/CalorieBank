export type RollingSyncUpload = {
  kind: string;
  localDate: string;
  body: Record<string, unknown>;
};

export type RollingSyncQueuedUpload<T extends RollingSyncUpload = RollingSyncUpload> = T & {
  key: string;
  fingerprint: string;
  queuedAt: string;
};

export function rollingUploadKey(upload: RollingSyncUpload) {
  return `apple_health:${upload.kind}:${upload.localDate}`;
}

export function rollingUploadFingerprint(upload: RollingSyncUpload) {
  const body = { ...upload.body };
  delete body.providerUpdatedAt;
  delete body.syncSessionId;
  return JSON.stringify({ kind: upload.kind, localDate: upload.localDate, body });
}

export function mergeRollingSyncOutbox<T extends RollingSyncUpload>(
  existing: RollingSyncQueuedUpload<T>[],
  uploads: T[],
  acceptedFingerprints: Record<string, string>,
  queuedAt: string,
) {
  const byKey = new Map(existing.map((item) => [item.key, item]));
  const changedDates = new Set<string>();
  const skippedDates = new Set<string>();

  for (const upload of uploads) {
    const key = rollingUploadKey(upload);
    const fingerprint = rollingUploadFingerprint(upload);
    if (acceptedFingerprints[key] === fingerprint && !byKey.has(key)) {
      skippedDates.add(upload.localDate);
      continue;
    }
    byKey.set(key, { ...upload, key, fingerprint, queuedAt });
    changedDates.add(upload.localDate);
  }

  return {
    queue: [...byKey.values()].sort(
      (left, right) =>
        left.localDate.localeCompare(right.localDate) || left.kind.localeCompare(right.kind),
    ),
    changedDates: [...changedDates],
    skippedDates: [...skippedDates],
  };
}
