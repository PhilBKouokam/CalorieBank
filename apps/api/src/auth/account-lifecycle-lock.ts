import type { Prisma, PrismaClient } from '@prisma/client';
import { AppError } from '../errors';

/** No retained subject registry: this transaction lock disappears on commit/rollback. */
export function withAccountLifecycleLock<T>(
  db: PrismaClient,
  subject: string,
  operation: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return db.$transaction(async tx => {
    await tx.$queryRaw`SELECT set_config('lock_timeout', '5000', true)`;
    // A fixed namespace plus a subject hash. Collisions only serialize unrelated
    // subjects; the full subject is still used for every ownership lookup.
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(1128417100, hashtext(${subject}))::text`;
    return operation(tx);
  }, { maxWait: 10_000, timeout: 30_000 });
}

/** Bound time holding the DB lock. A late remote completion cannot resume writes. */
export async function boundedIdentityOperation<T>(operation: (signal: AbortSignal) => Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const controller = new AbortController();
  try {
    return await Promise.race([
      Promise.resolve().then(() => operation(controller.signal)),
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(new AppError('Account service is temporarily unavailable. Try again.', 503,
            { code: 'IDENTITY_SERVICE_TIMEOUT' }));
        }, 8_000);
      }),
    ]);
  } finally { if (timer) clearTimeout(timer); }
}
