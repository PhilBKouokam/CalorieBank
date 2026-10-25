import assert from 'node:assert/strict';
import test from 'node:test';
import { checkRestorationEvidence } from './restore-evidence';
const old = { userId: 'e75c4bd7-7d3a-4c3c-a548-ed3d555f2fc9', subject: 'synthetic-old-subject' };
const fresh = { userId: 'b63f043f-dd9f-40f0-bcb8-948435c6e607', subject: 'synthetic-new-subject' };
const fixture = () => ({ backupAt: '2026-10-20T00:00:00Z', reconciledThrough: '2026-10-24T00:00:00Z',
  currentIdentityEvidenceThrough: '2026-10-24T00:00:00Z', deletionEvidenceThrough: '2026-10-24T00:00:00Z',
  completeIdentityInventory: true, completeDeletionInventory: true, servicesDetached: true,
  backupAccounts: [old], restoredAccounts: [old], currentBindings: [old],
  deletions: [] as { userId: string; subject: string; status: 'pending' | 'completed' }[] });
test('coherent offline evidence still never authorizes production restoration', () => {
  const report = checkRestorationEvidence(fixture());
  assert.equal(report.status, 'evidence_consistent'); assert.equal(report.releaseAuthorized, false);
});
for (const status of ['pending', 'completed'] as const) test(`${status} deletion blocks old restored health/account records`, () => {
  const f = fixture(); f.deletions = [{ ...old, status }];
  assert(checkRestorationEvidence(f).reasons.includes('deleted_data_present'));
});
test('deliberate new signup does not authorize old identity restoration or require email matching', () => {
  const f = fixture(); f.currentBindings = [fresh]; f.deletions = [{ ...old, status: 'completed' }];
  assert.equal(checkRestorationEvidence(f).status, 'hold');
  f.restoredAccounts = [];
  assert.equal(checkRestorationEvidence(f).status, 'evidence_consistent');
});
test('missing or old deletion/identity evidence holds; an approval boolean cannot replace it', () => {
  for (const field of ['completeIdentityInventory', 'completeDeletionInventory'] as const) {
    const f = fixture(); f[field] = false; assert.equal(checkRestorationEvidence(f).status, 'hold');
  }
  for (const field of ['deletionEvidenceThrough', 'currentIdentityEvidenceThrough'] as const) {
    const f = fixture(); f[field] = f.backupAt; assert(checkRestorationEvidence(f).reasons.includes('evidence_window_incomplete'));
  }
  assert.equal(checkRestorationEvidence({ ...fixture(), founderApproved: true }).status, 'hold');
});
test('unknown, ambiguous or unexpectedly missing identities cannot pass', () => {
  const f = fixture(); f.restoredAccounts = [fresh]; assert.equal(checkRestorationEvidence(f).status, 'hold');
  const g = fixture(); g.currentBindings = [old, old]; assert(checkRestorationEvidence(g).reasons.includes('ambiguous_identity'));
  const h = fixture(); h.restoredAccounts = []; assert(checkRestorationEvidence(h).reasons.includes('unexplained_missing_account'));
});
test('attached services or reversed backup window hold', () => {
  const f = fixture(); f.servicesDetached = false; assert.equal(checkRestorationEvidence(f).status, 'hold');
  const g = fixture(); g.backupAt = '2026-10-25T00:00:00Z'; assert.equal(checkRestorationEvidence(g).status, 'hold');
});
test('a deletion bound to a different subject or account cannot clear the old restore decision', () => {
  for (const deletion of [{ ...old, subject: fresh.subject }, { ...old, userId: fresh.userId }]) {
    const f = fixture(); f.deletions = [{ ...deletion, status: 'completed' }];
    assert(checkRestorationEvidence(f).reasons.includes('deletion_identity_mismatch'));
  }
});
test('malformed input and identifier-bearing extras yield only an allowlisted report', () => {
  for (const f of [undefined, {}, { ...fixture(), token: 'synthetic-secret' }, { ...fixture(), backupAt: 'bad' }]) {
    assert.deepEqual(checkRestorationEvidence(f), { status: 'hold', reasons: ['invalid_manifest'], releaseAuthorized: false });
  }
  const encoded = JSON.stringify(checkRestorationEvidence(fixture()));
  for (const value of [old.userId, old.subject, fixture().backupAt, 'synthetic-secret']) assert.equal(encoded.includes(value), false);
});
