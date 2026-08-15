import { prisma } from '../db/client';
import { env } from '../env';

async function run() {
  const records = await prisma.finalizedDailyBankRecord.findMany({
    where: { userId: env.DEV_USER_ID },
    orderBy: { logDate: 'asc' },
    include: {
      calculationSnapshots: { orderBy: { version: 'desc' }, take: 1 },
    },
  });
  const rows = await Promise.all(records.map(async (record) => {
    const snapshot = record.calculationSnapshots[0];
    const aggregate = snapshot ? await prisma.dailyExpenditureAggregate.findFirst({
      where: {
        userId: env.DEV_USER_ID,
        localDate: record.logDate,
        provider: snapshot.expenditureProvider,
        providerRecordId: snapshot.expenditureProviderRecordId,
      },
    }) : null;
    return {
      date: record.logDate.toISOString().slice(0, 10),
      provider: snapshot?.expenditureProvider ?? 'unknown',
      rawExpenditure: snapshot?.importedTotalDailyExpenditure ?? record.importedTotalDailyExpenditure,
      restingIncluded: Boolean(
        aggregate && aggregate.activeEnergyCalories !== null && aggregate.basalEnergyCalories !== null,
      ),
      status: record.status,
      action: record.status === 'LOCKED' ? 'future_admin_reconciliation_only' : 'eligible_for_normal_reconciliation',
    };
  }));
  console.table(rows);
}

run().finally(() => prisma.$disconnect());
