import { createHash } from 'node:crypto';

type Context = { ownerId: string; localDate: string; timezone: string;
  selectionVersion: string | undefined; goalVersion: string | undefined; profileVersion: string | undefined;
  evidence: readonly unknown[] };
/** Opaque equality token only. Never log/persist the transient source tuple or use it as an access credential. */
export function guidanceContextVersion(context: Context): string | null {
  if (!context.ownerId || !context.localDate || !context.timezone ||
    ![context.selectionVersion, context.goalVersion, context.profileVersion].every(value => value && Number.isFinite(Date.parse(value)))) return null;
  try {
    const encoded = JSON.stringify(context, (_key, value: unknown) => value && typeof value === 'object' && !Array.isArray(value)
      ? Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right))) : value);
    return `g1:${createHash('sha256').update(encoded).digest('hex')}`;
  } catch { return null; }
}
