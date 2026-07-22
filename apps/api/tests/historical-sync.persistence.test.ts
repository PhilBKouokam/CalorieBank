import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';

import { createApp } from '../src/app';
import { prisma } from '../src/db/client';
import { env } from '../src/env';
import { getLocalDateForTimezone } from '../src/modules/today/today.time';

const timezone = 'America/Chicago';
const user = {
  id: '00000000-0000-4000-8000-000000000993',
  email: 'historical-sync@test.local',
};

function previousDate(localDate: string, days: number) {
  const date = new Date(`${localDate}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

afterEach(async () => {
  await prisma.user.deleteMany({ where: { id: user.id } });
});

describe('historical sync orchestration persistence', () => {
  it('posts a completed day automatically, records waiting dates, and remains idempotent', async () => {
    const app = createApp({ ...env, DEV_USER_ID: user.id, DEV_USER_EMAIL: user.email, TODAY_INGESTION_MODE: 'device' });
    const today = getLocalDateForTimezone(timezone);
    const yesterday = previousDate(today, 1);
    const previous = previousDate(today, 2);
    await request(app).put('/v1/me/goal-configuration').send({
      goalMode: 'maintain', dailyEnergyAdjustment: 0, adjustmentSource: 'manual_calories',
    }).expect(200);
    const session = await request(app).post('/v1/me/ingestion/sync-sessions').send({
      localDate: today,
      timezone,
      provider: 'apple_health',
      trigger: 'integration_test',
      datesQueried: [today, yesterday, previous],
    }).expect(201);
    const providerUpdatedAt = new Date().toISOString();
    await request(app).post('/v1/me/ingestion/expenditure').send({
      localDate: yesterday,
      timezone,
      provider: 'apple_health',
      providerUpdatedAt,
      rawTotalDailyExpenditure: 2500,
      sourceMetadata: { activeEnergyCalories: 700, basalEnergyCalories: 1800 },
      syncSessionId: session.body.id,
    }).expect(200);
    await request(app).post('/v1/me/ingestion/intake').send({
      localDate: yesterday,
      timezone,
      provider: 'apple_health',
      providerUpdatedAt,
      totalCaloriesConsumed: 1700,
      syncSessionId: session.body.id,
    }).expect(200);

    const completion = {
      expenditureStatus: 'ready', intakeStatus: 'ready', stepsStatus: 'unavailable', workoutsStatus: 'ready',
      recordsImported: 2, recordsUpdated: 0, recordsSkipped: 0, warningCount: 1,
      datesUploaded: [yesterday], datesSkipped: [today, previous], errors: [],
    };
    const completed = await request(app)
      .patch(`/v1/me/ingestion/sync-sessions/${session.body.id}`)
      .send(completion)
      .expect(200);
    expect(completed.body.datesReconciled).toContain(yesterday);
    expect(completed.body.waitingDates).toContainEqual({
      date: previous,
      status: 'waiting_for_required_inputs',
    });

    await request(app)
      .patch(`/v1/me/ingestion/sync-sessions/${session.body.id}`)
      .send(completion)
      .expect(200);
    const [record, ledgerCount, sessionRecord] = await Promise.all([
      prisma.finalizedDailyBankRecord.findFirstOrThrow({ where: { userId: user.id } }),
      prisma.calorieLedgerTransaction.count({ where: { userId: user.id } }),
      prisma.ingestionSyncSession.findUniqueOrThrow({ where: { id: session.body.id } }),
    ]);
    expect(record.status).toBe('PROVISIONAL');
    expect(record.effectiveDailyBankChange).toBe(300);
    expect(ledgerCount).toBe(1);
    expect(sessionRecord.datesQueried).toEqual([today, yesterday, previous]);
    expect(sessionRecord.datesReconciled).toContain(yesterday);
  });
});
