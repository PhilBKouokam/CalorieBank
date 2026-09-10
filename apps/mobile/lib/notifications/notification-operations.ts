// Device registration and release share an account-owned queue. Release closes
// registration before waiting, so foreground work cannot reattach a signed-out device.
export function createNotificationOperations() {
  let scope: string | null = null;
  let generation = 0;
  let released = false;
  let tail: Promise<unknown> = Promise.resolve();
  let releasePromise: Promise<void> | null = null;
  function check(expected: number, allowRelease: boolean) {
    if (!scope || generation !== expected || (released && !allowRelease)) {
      throw new Error('Notification account context is no longer active.');
    }
  }
  function enqueue<T>(work: (check: () => void) => Promise<T>, allowRelease = false) {
    const expected = generation;
    const guard = () => check(expected, allowRelease);
    const result = tail.catch(() => undefined).then(async () => {
      guard();
      const value = await work(guard);
      guard();
      return value;
    });
    tail = result;
    return result;
  }
  return {
    setScope(next: string | null) {
      if (next === scope) return;
      scope = next;
      generation += 1;
      released = false;
      releasePromise = null;
    },
    run: enqueue,
    async pause() {
      released = true;
      await tail.catch(() => undefined);
    },
    release(work: (check: () => void) => Promise<void>) {
      if (releasePromise) return releasePromise;
      const expected = generation;
      released = true;
      releasePromise = enqueue(work, true).catch((error: unknown) => {
        if (generation === expected) releasePromise = null;
        throw error;
      });
      return releasePromise;
    },
  };
}

export async function confirmPreferenceChange<T>(
  desired: boolean,
  write: () => Promise<T>,
  reload: () => Promise<T>,
  isEnabled: (state: T) => boolean,
): Promise<{ state: T; message: string | null }> {
  try { return { state: await write(), message: null }; }
  catch {
    const state = await reload();
    return { state, message: isEnabled(state) === desired ? null : "Your change wasn't saved. Please try again." };
  }
}

export async function retryDeviceRelease(
  release: () => Promise<void>,
  retryable: (error: unknown) => boolean,
  wait: (ms: number) => Promise<void> = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
) {
  for (let attempt = 0; ; attempt += 1) {
    try { await release(); return; }
    catch (error) {
      if (attempt === 2 || !retryable(error)) throw error;
      await wait(1000 * (attempt + 1));
    }
  }
}

export async function withNotificationTokenTimeout<T>(operation: Promise<T>, timeoutMs = 15_000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([operation, new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => reject(new Error('Notification token lookup timed out.')), timeoutMs);
    })]);
  } finally { clearTimeout(timer); }
}

// Synchronous lock: a second native Switch event cannot enter before React renders.
export function createSettingsRequestGate() {
  let generation = 0;
  let active = false;
  return {
    invalidate() { generation += 1; active = false; },
    begin() {
      if (active) return null;
      active = true;
      const current = ++generation;
      return {
        isCurrent: () => current === generation,
        finish() { if (current === generation) active = false; },
      };
    },
  };
}
