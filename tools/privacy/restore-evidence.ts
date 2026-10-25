/** Offline advisory check only. No database, provider, credential or service access. */
import { z } from 'zod';

const identity = z.object({ userId: z.string().uuid(), subject: z.string().min(1).max(256) }).strict();
const timestamp = z.string().datetime({ offset: true });
const manifest = z.object({
  backupAt: timestamp,
  reconciledThrough: timestamp,
  currentIdentityEvidenceThrough: timestamp,
  deletionEvidenceThrough: timestamp,
  completeIdentityInventory: z.boolean(),
  completeDeletionInventory: z.boolean(),
  servicesDetached: z.boolean(),
  backupAccounts: z.array(identity).max(10000),
  restoredAccounts: z.array(identity).max(10000),
  currentBindings: z.array(identity).max(10000),
  deletions: z.array(identity.extend({ status: z.enum(['pending', 'completed']) }).strict()).max(10000),
}).strict();

/** Caller must independently establish provenance/completeness and inspect the real
 * recovered database. A syntactically valid manifest is not a security attestation.
 * Results deliberately contain counts/reasons, never supplied identifiers or dates.
 */
export function checkRestorationEvidence(input: unknown) {
  const parsed = manifest.safeParse(input);
  if (!parsed.success) return { status: 'hold' as const, reasons: ['invalid_manifest'], releaseAuthorized: false as const };
  const m = parsed.data;
  const reasons = new Set<string>();
  const pair = (row: z.infer<typeof identity>) => JSON.stringify([row.userId, row.subject]);
  const through = Date.parse(m.reconciledThrough);
  if (Date.parse(m.backupAt) > through
    || Date.parse(m.currentIdentityEvidenceThrough) < through
    || Date.parse(m.deletionEvidenceThrough) < through) reasons.add('evidence_window_incomplete');
  if (!m.completeIdentityInventory || !m.completeDeletionInventory) reasons.add('inventory_incomplete');
  if (!m.servicesDetached) reasons.add('recovery_services_not_isolated');
  for (const rows of [m.backupAccounts, m.restoredAccounts, m.currentBindings]) {
    if (new Set(rows.map(row => row.userId)).size !== rows.length
      || new Set(rows.map(row => row.subject)).size !== rows.length) reasons.add('ambiguous_identity');
  }
  const original = new Set(m.backupAccounts.map(pair));
  const restored = new Set(m.restoredAccounts.map(pair));
  const current = new Set(m.currentBindings.map(pair));
  const deleted = new Set(m.deletions.map(pair));
  const originalSubjects = new Map(m.backupAccounts.map(row => [row.userId, row.subject]));
  const originalOwners = new Map(m.backupAccounts.map(row => [row.subject, row.userId]));
  for (const deletion of m.deletions) {
    if ((originalSubjects.has(deletion.userId) && originalSubjects.get(deletion.userId) !== deletion.subject)
      || (originalOwners.has(deletion.subject) && originalOwners.get(deletion.subject) !== deletion.userId)) {
      reasons.add('deletion_identity_mismatch');
    }
  }
  for (const row of m.restoredAccounts) {
    const key = pair(row);
    if (!original.has(key)) reasons.add('unexpected_restored_identity');
    if (deleted.has(key)) reasons.add('deleted_data_present');
    if (!current.has(key)) reasons.add('current_identity_unconfirmed');
  }
  for (const row of m.backupAccounts) {
    const key = pair(row);
    if (!restored.has(key) && !deleted.has(key)) reasons.add('unexplained_missing_account');
  }
  // Never authorize a switch, apply deletion, reconcile accounting or create a
  // permanent tombstone store. An approved operator owns the actual restore gate.
  return { status: reasons.size ? 'hold' as const : 'evidence_consistent' as const,
    reasons: [...reasons].sort(), backupAccountCount: m.backupAccounts.length,
    restoredAccountCount: m.restoredAccounts.length, releaseAuthorized: false as const };
}
