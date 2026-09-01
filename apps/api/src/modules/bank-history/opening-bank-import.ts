import type { Prisma } from '@prisma/client';

export const OPENING_BANK_HISTORY_DAYS = 7;
export const OPENING_BANK_SYNC_DAYS = OPENING_BANK_HISTORY_DAYS + 1;

export type OpeningImportRoleState = 'preparing' | 'complete' | 'retry_needed';

export type OpeningImportState = {
  dates: string[];
  expenditure: OpeningImportRoleState;
  intake: OpeningImportRoleState;
  complete: boolean;
};

export function openingImportDates(currentLocalDate: string) {
  const anchor = new Date(`${currentLocalDate}T12:00:00.000Z`);
  return Array.from({ length: OPENING_BANK_SYNC_DAYS }, (_, offset) => {
    const date = new Date(anchor);
    date.setUTCDate(date.getUTCDate() - offset);
    return date.toISOString().slice(0, 10);
  });
}

function roleState(
  session: { completedAt: Date | null; status: string; categoryStatus: string } | null,
): OpeningImportRoleState {
  if (!session?.completedAt) return 'preparing';
  if (session.categoryStatus === 'error' || session.status === 'failed') return 'retry_needed';
  return session.categoryStatus === 'ready' || session.categoryStatus === 'unavailable'
    ? 'complete'
    : 'preparing';
}

export async function readOpeningImportState(
  transaction: Prisma.TransactionClient,
  userId: string,
  currentLocalDate: string,
): Promise<OpeningImportState> {
  const dates = openingImportDates(currentLocalDate);
  const selection = await transaction.providerSelection.findUnique({ where: { userId } });
  if (!selection) {
    return { dates, expenditure: 'preparing', intake: 'preparing', complete: false };
  }

  const sessions = await transaction.ingestionSyncSession.findMany({
    where: {
      userId,
      completedAt: { gte: selection.updatedAt },
      provider: {
        in: [selection.authoritativeExpenditureProvider, selection.authoritativeIntakeProvider],
      },
      datesQueried: { hasEvery: dates },
    },
    orderBy: { completedAt: 'desc' },
  });
  const expenditureSession = sessions.find(
    (session) => session.provider === selection.authoritativeExpenditureProvider,
  );
  const intakeSession = sessions.find(
    (session) => session.provider === selection.authoritativeIntakeProvider,
  );
  const expenditure = roleState(expenditureSession ? {
    completedAt: expenditureSession.completedAt,
    status: expenditureSession.status,
    categoryStatus: expenditureSession.expenditureStatus,
  } : null);
  const intake = roleState(intakeSession ? {
    completedAt: intakeSession.completedAt,
    status: intakeSession.status,
    categoryStatus: intakeSession.intakeStatus,
  } : null);
  return {
    dates,
    expenditure,
    intake,
    complete: expenditure === 'complete' && intake === 'complete',
  };
}
