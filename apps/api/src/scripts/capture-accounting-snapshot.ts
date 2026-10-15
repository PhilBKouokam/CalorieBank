/** Read-only release evidence. Run with the service's existing DATABASE_URL.
 * ACCOUNTING_SNAPSHOT_PATH must be an absolute, private path outside the checkout.
 * The output contains private account IDs/values: never print it or commit it.
 */
import { PrismaClient } from '@prisma/client';
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';

const output = process.env.ACCOUNTING_SNAPSHOT_PATH;
const sourceCommit = process.env.RENDER_GIT_COMMIT ?? process.env.ACCOUNTING_SOURCE_COMMIT;
if (!output || !isAbsolute(output) || !relative(process.cwd(), resolve(output)).startsWith('..')) {
  throw new Error('Use an absolute private evidence path outside the checkout.');
}
if (!sourceCommit || !/^[a-f0-9]{40}$/.test(sourceCommit)) throw new Error('An exact source commit is required.');
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const db = new PrismaClient();

async function capture() {
  const snapshot = await db.$transaction(async (tx) => {
    await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
    const capturedAt = await tx.$queryRaw<Array<{ captured_at: Date }>>`SELECT transaction_timestamp() AS captured_at`;
    if (!capturedAt[0]) throw new Error('Database capture timestamp unavailable.');
    const migrations = await tx.$queryRaw<Array<{ migration_name: string; checksum: string; started_at: Date; finished_at: Date | null; rolled_back_at: Date | null }>>`
      SELECT migration_name, checksum, started_at, finished_at, rolled_back_at FROM _prisma_migrations ORDER BY migration_name, started_at`;
    const initializations = await tx.bankAccountInitialization.findMany({ orderBy: { userId: 'asc' } });
    const accounts = [];
    for (const initialization of initializations) {
      const where = { userId: initialization.userId };
      const opening = await tx.openingBankCalculationDay.findMany({ where, orderBy: { id: 'asc' } });
      const history = await tx.finalizedDailyBankRecord.findMany({ where, orderBy: { id: 'asc' } });
      const ledger = await tx.calorieLedgerTransaction.findMany({ where, orderBy: { id: 'asc' } });
      const calculations = await tx.bankCalculationSnapshot.findMany({ where, orderBy: { id: 'asc' } });
      const { createdAt, updatedAt, ...accountingState } = initialization;
      const openingSum = opening.reduce((sum, day) => sum + day.dailyBankChange, 0);
      const ledgerSum = ledger.reduce((sum, entry) => sum + entry.amountCalories, 0);
      const effectiveBalance = (initialization.openingEffectiveBalanceCalories ?? 0) + ledgerSum;
      const consistency = {
        openingMatches: initialization.status !== 'INITIALIZED' || (
          openingSum === initialization.historicalOpeningNetCalories
          && openingSum === initialization.openingEffectiveBalanceCalories
          && opening.length === initialization.eligibleDayCount),
        initializedFieldsPresent: initialization.status !== 'INITIALIZED' || Boolean(initialization.initializedAt && initialization.accountingStartsOn && initialization.timezone),
        finalizedLedgerMatches: history.every((day) => ledger.filter((entry) => entry.sourceId === day.id).reduce((sum, entry) => sum + entry.amountCalories, 0) === day.effectiveDailyBankChange),
        ledgerHasHistory: ledger.every((entry) => history.some((day) => day.id === entry.sourceId)),
        openingBeforeAccounting: opening.every((day) => initialization.accountingStartsOn && day.logDate < initialization.accountingStartsOn),
        historyAfterOpening: history.every((day) => !initialization.accountingStartsOn || day.logDate >= initialization.accountingStartsOn),
      };
      accounts.push({
        initialization, wholeRowFingerprint: hash(initialization),
        accountingStateFingerprint: hash(accountingState), operationalMetadataFingerprint: hash({ createdAt, updatedAt }),
        evidence: { opening: { count: opening.length, fingerprint: hash(opening) }, history: { count: history.length, fingerprint: hash(history) }, ledger: { count: ledger.length, fingerprint: hash(ledger) }, calculations: { count: calculations.length, fingerprint: hash(calculations) } },
        consistency, derived: { openingSum, ledgerSum, effectiveBalance, availableBank: Math.max(0, effectiveBalance), recovery: Math.max(0, -effectiveBalance) },
      });
    }
    return { formatVersion: 1, capturedAt: capturedAt[0].captured_at, sourceCommit, migrations, accounts };
  }, { isolationLevel: 'RepeatableRead', timeout: 30_000 });
  // Exclusive creation prevents overwriting earlier evidence; permissions are owner-only.
  writeFileSync(output!, JSON.stringify(snapshot, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  const inconsistentAccounts = snapshot.accounts.filter((account) => Object.values(account.consistency).some((valid) => !valid)).length;
  console.log(JSON.stringify({ capturedAt: snapshot.capturedAt, sourceCommit, accounts: snapshot.accounts.length, inconsistentAccounts, snapshotSha256: hash(snapshot), savedPrivately: true }));
  if (inconsistentAccounts) process.exitCode = 1;
}
void capture().catch(() => { console.error('Accounting snapshot failed; release remains on hold.'); process.exitCode = 1; }).finally(() => db.$disconnect());
