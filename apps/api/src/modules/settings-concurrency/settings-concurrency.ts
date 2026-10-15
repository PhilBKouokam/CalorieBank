import type { Prisma, PrismaClient } from '@prisma/client';
import type { Request, Response } from 'express';
import { AppError } from '../../errors';

export type Setting = 'fitness-goal' | 'daily-bank-target' | 'banking-goal';
export type SettingsOptions = { expectedRevision?: string; onRevision?: (revision: string) => void };

/** Headers are opt-in; strict legacy JSON bodies remain byte-shape compatible. */
export function settingsOptions(req: Request, res: Response, write = false): SettingsOptions | undefined {
  const capability = req.get('X-CB-Settings-Concurrency');
  if (!capability) {
    if (req.get('If-Match')) throw new AppError('Settings concurrency capability is required.', 400);
    return undefined;
  }
  if (capability !== '1') throw new AppError('Unsupported settings concurrency version.', 400);
  const match = req.get('If-Match');
  if (write && (!match || !/^"(?:0|[1-9][0-9]{0,18})"$/.test(match))) {
    throw new AppError('Reload this setting before saving.', 428, { code: 'SETTINGS_REVISION_REQUIRED' });
  }
  res.set('Cache-Control', 'no-store');
  return { ...(write ? { expectedRevision: match!.slice(1, -1) } : {}),
    onRevision: revision => res.set('X-CB-Settings-Revision', revision) };
}

/** Shared lock covers reads, all legacy writes, creation and deletion (including absent rows).
 * Revision tombstones live with the account, not the setting, so delete/recreate cannot cause ABA.
 * ReadCommitted is deliberate: after waiting for the advisory lock, each query sees its predecessor.
 */
export async function settingTransaction<T>(db: PrismaClient, userId: string, setting: Setting,
  write: boolean, options: SettingsOptions | undefined, action: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  const result = await db.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}), hashtext(${`settings:${setting}`}))`;
    const row = await tx.settingsRevision.findUnique({ where: { userId_setting: { userId, setting } } });
    const revision = row?.revision ?? 0n;
    if (options?.expectedRevision !== undefined && options.expectedRevision !== revision.toString()) {
      throw new AppError('This setting changed elsewhere. Review the latest value before saving.', 409,
        { code: 'SETTINGS_CONFLICT', revision: revision.toString() });
    }
    const value = await action(tx);
    const next = write ? revision + 1n : revision;
    if (write) await tx.settingsRevision.upsert({ where: { userId_setting: { userId, setting } },
      create: { userId, setting, revision: next }, update: { revision: next } });
    return { value, revision: next.toString() };
  }, { isolationLevel: 'ReadCommitted' });
  options?.onRevision?.(result.revision);
  return result.value;
}
