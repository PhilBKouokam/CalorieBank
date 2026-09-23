import { AsyncLocalStorage } from 'node:async_hooks';
import type { RequestHandler } from 'express';
import type { Prisma } from '@prisma/client';
import {
  CLIENT_CAPABILITIES_HEADER, supportsIntakeAuthority,
  UPDATE_REQUIRED_CODE, UPDATE_REQUIRED_MESSAGE,
} from '@caloriebank/schemas';
import { AppError } from '../errors';

const requestProtocol = new AsyncLocalStorage<{ supportsIntakeAuthority: boolean }>();

export function updateRequired() {
  return new AppError(UPDATE_REQUIRED_MESSAGE, 426, { code: UPDATE_REQUIRED_CODE });
}

/** Internal lifecycle work has no HTTP context and remains server-owned. */
export function requireIntakeCapability(...sources: (string | null | undefined)[]) {
  if (requestProtocol.getStore()?.supportsIntakeAuthority === false && sources.includes('manual_estimate')) {
    throw updateRequired();
  }
}

/** Source writes can return a rolling refresh plan containing prior manual days.
 * Reject before changing anything, including after the account returns to a
 * provider. Unrelated account preferences and deletion are deliberately ungated. */
export async function requireCompatibleSourceMutation(db: Prisma.TransactionClient, userId: string) {
  if (requestProtocol.getStore()?.supportsIntakeAuthority !== false) return;
  const [period, snapshot] = await Promise.all([
    db.intakeAuthorityBoundary.findFirst({ where: { userId, provider: 'manual_estimate' }, select: { id: true } }),
    db.bankCalculationSnapshot.findFirst({ where: { userId, intakeProvider: 'manual_estimate' }, select: { id: true } }),
  ]);
  if (period || snapshot) throw updateRequired();
}

// This final serialization firewall also covers mixed History, when the current
// source is once again a provider. It does not infer capability from account state.
export function containsManualSource(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  if (Array.isArray(value)) return value.some(containsManualSource);
  return Object.entries(value).some(([key, item]) =>
    (/(?:provider|source)(?:Id|Type)?$/i.test(key)
      && item === 'manual_estimate') || containsManualSource(item));
}

export const intakeCapabilityBoundary: RequestHandler = (req, res, next) => {
  const supported = supportsIntakeAuthority(req.get(CLIENT_CAPABILITIES_HEADER));
  const json = res.json.bind(res);
  res.json = (body: unknown) => {
    if (!supported && containsManualSource(body)) {
      // Replace the entire payload before Express serializes any of it.
      res.status(426);
      return json({ error: { message: UPDATE_REQUIRED_MESSAGE, details: { code: UPDATE_REQUIRED_CODE } } });
    }
    return json(body);
  };
  requestProtocol.run({ supportsIntakeAuthority: supported }, next);
};
