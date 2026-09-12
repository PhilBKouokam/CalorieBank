import { nativeIntakeBatchSchema, nativeIntakeSourceName } from '@caloriebank/schemas';
import type { PrismaClient } from '@prisma/client';
import { Router } from 'express';
import { AppError } from '../../errors';
import { resolveRequestUser, type RequestUserSource } from '../../auth/current-user';
import { getLocalDateForTimezone } from '../today/today.time';
import { openingImportDates } from '../bank-history/opening-bank-import';
import type { FinalizationScheduler } from '../finalization-orchestration/finalization-orchestration.service';

/** One exact source, one completed read generation, one atomic normalized upload. */
export function createNativeIntakeRouter(db: PrismaClient, users: RequestUserSource, scheduler?: FinalizationScheduler, now = () => new Date()) {
  const router = Router();
  router.post('/', async (req, res, next) => {
    try {
      const user = resolveRequestUser(users, res);
      const parsed = nativeIntakeBatchSchema.safeParse(req.body);
      if (!parsed.success) throw new AppError('Food refresh is invalid.', 400);
      const input = parsed.data, receivedAt = now();
      const startedAt = new Date(input.queryStartedAt), observedAt = new Date(input.observedAt);
      const today = getLocalDateForTimezone(input.timezone, receivedAt);
      const dates = openingImportDates(today);
      if (new Set(input.days.map((d) => d.localDate)).size !== 8 || input.days.some((d) => !dates.includes(d.localDate)) ||
          getLocalDateForTimezone(input.timezone, startedAt) !== today ||
          observedAt < startedAt || observedAt.getTime() > receivedAt.getTime() + 60_000 ||
          receivedAt.getTime() - startedAt.getTime() > 5 * 60_000) {
        throw new AppError('Refresh your food data again.', 409, { code: 'NATIVE_INTAKE_SNAPSHOT_EXPIRED' });
      }
      const session = await db.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${user.id}), hashtext('opening-bank'))`;
        const selected = await tx.providerSelection.findUnique({ where: { userId: user.id } });
        if (!selected?.intakeSelected || selected.authoritativeIntakeProvider !== 'health_connect' ||
            selected.nativeIntakeSourceId !== input.source.id || selected.updatedAt.toISOString() !== input.selectionRevision ||
            startedAt < selected.updatedAt) {
          throw new AppError('Your food source changed. Refresh again.', 409, { code: 'NATIVE_INTAKE_SELECTION_CHANGED' });
        }
        const existing = await tx.dailyIntakeAggregate.findMany({ where: { userId: user.id, provider: 'health_connect', sourceId: input.source.id, localDate: { in: dates.map((d) => new Date(`${d}T00:00:00Z`)) } } });
        if (existing.some((row) => row.evidenceObservedAt && row.evidenceObservedAt >= observedAt)) {
          throw new AppError('Newer food data has already arrived. Refresh again.', 409, { code: 'NATIVE_INTAKE_STALE_READ' });
        }
        const usable = input.days.filter((d) => d.quality === 'usable_evidence');
        const ambiguous = input.days.some((d) => d.quality === 'ambiguous_overlap' || d.quality === 'boundary_ambiguous');
        const session = await tx.ingestionSyncSession.create({ data: {
          userId: user.id, provider: 'health_connect', sourceId: input.source.id,
          localDate: new Date(`${today}T00:00:00Z`), timezone: input.timezone,
          trigger: 'manual_refresh', status: ambiguous ? 'partially_completed' : 'completed',
          startedAt, completedAt: receivedAt, intakeStatus: ambiguous ? 'error' : usable.length ? 'ready' : 'unavailable',
          datesQueried: dates, datesUploaded: usable.map((d) => d.localDate),
          providerAdapterVersion: 'health-connect-nutrition-v1',
        } });
        for (const day of input.days) {
          const localDate = new Date(`${day.localDate}T00:00:00Z`);
          const identity = { userId: user.id, localDate, provider: 'health_connect', sourceId: input.source.id };
          if (day.totalCaloriesConsumed === null) {
            // Missing energy is not a zero. Invalidate a previous value for this exact source.
            await tx.dailyIntakeAggregate.updateMany({ where: identity, data: { syncStatus: 'unavailable', evidenceObservedAt: observedAt, syncSessionId: session.id } });
            continue;
          }
          const data = { timezone: input.timezone, providerRecordId: `health_connect:${input.source.id}:${day.localDate}`,
            totalCaloriesConsumed: day.totalCaloriesConsumed, sourceDisplayName: nativeIntakeSourceName(input.source.id),
            importedAt: receivedAt, evidenceObservedAt: observedAt, providerUpdatedAt: day.providerUpdatedAt ? new Date(day.providerUpdatedAt) : null,
            syncStatus: 'ready' as const, isCurrentDay: day.localDate === today, syncSessionId: session.id };
          await tx.dailyIntakeAggregate.upsert({ where: { userId_localDate_provider_sourceId: identity }, create: { ...identity, ...data }, update: data });
        }
        return session;
      });
      // Existing server orchestration remains the only Opening Bank/ledger engine.
      if (scheduler) await scheduler.execute({ user, currentLocalDate: today, timezone: input.timezone, dates, trigger: 'manual_refresh', syncSessionId: session.id });
      res.json({ sessionId: session.id, status: session.intakeStatus });
    } catch (error) { next(error); }
  });
  return router;
}
