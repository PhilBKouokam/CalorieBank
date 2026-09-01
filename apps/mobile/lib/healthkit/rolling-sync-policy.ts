export type RollingSyncUpload = {
  kind: string;
  localDate: string;
  body: Record<string, unknown>;
};

export function accountScopedRollingSyncKey(key: string, accountScope: string | null | undefined) {
  const safeScope = accountScope?.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128) || 'anonymous';
  return `${key}:account:${safeScope}`;
}

export type RollingSyncQueuedUpload<T extends RollingSyncUpload = RollingSyncUpload> = T & {
  key: string;
  fingerprint: string;
  queuedAt: string;
};

type SingleFlightOptions = { force?: boolean };

export type RollingSyncSingleFlight<T, TOptions extends SingleFlightOptions> = {
  run(options: TOptions): Promise<T>;
  isRunning(): boolean;
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

export function sanitizeRollingSyncOutbox<T extends RollingSyncUpload>(
  stored: unknown,
): RollingSyncQueuedUpload<T>[] {
  if (!Array.isArray(stored)) return [];

  const byKey = new Map<string, RollingSyncQueuedUpload<T>>();
  for (const value of stored) {
    if (!value || typeof value !== 'object') continue;
    const candidate = value as Partial<RollingSyncQueuedUpload<T>> & {
      url?: unknown;
      absoluteUrl?: unknown;
      baseUrl?: unknown;
    };
    if (
      typeof candidate.kind !== 'string' ||
      typeof candidate.localDate !== 'string' ||
      !candidate.body ||
      typeof candidate.body !== 'object'
    ) continue;
    if (
      candidate.kind === 'intake' &&
      (typeof (candidate.body as Record<string, unknown>).writerBundleIdentifier !== 'string' ||
        typeof (candidate.body as Record<string, unknown>).writerDisplayName !== 'string')
    ) continue;

    // Rebuild from provider-neutral intent so legacy development URLs cannot survive a LAN change.
    const upload = {
      kind: candidate.kind,
      localDate: candidate.localDate,
      body: candidate.body,
    } as T;
    const key = rollingUploadKey(upload);
    byKey.set(key, {
      ...upload,
      key,
      fingerprint: rollingUploadFingerprint(upload),
      queuedAt: typeof candidate.queuedAt === 'string'
        ? candidate.queuedAt
        : new Date(0).toISOString(),
    });
  }

  return [...byKey.values()].sort(
    (left, right) =>
      left.localDate.localeCompare(right.localDate) || left.kind.localeCompare(right.kind),
  );
}

export function createRollingSyncSingleFlight<T, TOptions extends SingleFlightOptions>(
  execute: (options: TOptions) => Promise<T>,
): RollingSyncSingleFlight<T, TOptions> {
  let active: Promise<T> | null = null;
  let queuedManual: Promise<T> | null = null;

  const start = (options: TOptions) => {
    const execution = execute(options);
    let tracked: Promise<T>;
    tracked = execution.finally(() => {
      if (active === tracked) active = null;
    });
    active = tracked;
    return tracked;
  };

  return {
    run(options) {
      if (!active) return start(options);
      if (!options.force) return active;

      if (!queuedManual) {
        const waiting = active.catch(() => undefined).then(() => start(options));
        let tracked: Promise<T>;
        tracked = waiting.finally(() => {
          if (queuedManual === tracked) queuedManual = null;
        });
        queuedManual = tracked;
      }
      return queuedManual;
    },
    isRunning() {
      return active !== null || queuedManual !== null;
    },
  };
}
