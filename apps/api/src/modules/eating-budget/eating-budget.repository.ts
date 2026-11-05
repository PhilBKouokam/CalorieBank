import type { AttributionProviders, EatingBudgetResponse } from '@caloriebank/schemas';
import type { PrismaClient } from '@prisma/client';
import { getLocalDateUtcBounds, type BudgetContext, type BudgetExpenditure, type BudgetIntake, type EatPlanningModel } from '@caloriebank/domain';
import { PrismaTodayAggregateRepository } from '../today/today.repository';
import { getLocalDateForTimezone } from '../today/today.time';
import { readProviderSelection } from '../provider-selection/provider-selection.repository';
import { resolveIntakeAuthority } from '../provider-selection/intake-authority';
export type QualifiedBudgetPlanningModel = EatPlanningModel & { evidence?: { basis:'matched_total_above_selected_quiet'; baselineModelVersion:string; calibrationVersion:string; expiresAt:Date } };
export function qualifiedPlanningModel(s:BudgetSnapshot): QualifiedBudgetPlanningModel|null {
 const m=s.model,e=m?.evidence,c=s.context,x=s.expenditure;
 return m&&e&&e.basis==='matched_total_above_selected_quiet'&&e.baselineModelVersion===s.baselineModelVersion&&Boolean(e.calibrationVersion)&&
 m.accountId===c.accountId&&m.sourceId===c.expenditureSourceId&&m.localDate===c.localDate&&m.timezone===c.timezone&&m.qualified&&
 x?.coverage==='verified'&&m.currentStepsAt?.getTime()===x.coverageAt?.getTime()&&e.expiresAt.getTime()>c.now.getTime()&&
 Number.isFinite(m.providerCaloriesPerAdditionalStep)&&m.providerCaloriesPerAdditionalStep>0&&m.stepsPerMinute!==null&&Number.isFinite(m.stepsPerMinute)&&m.stepsPerMinute>0?m:null;
}
export type BudgetSnapshot = { context: BudgetContext; expenditure: BudgetExpenditure | null; intake: BudgetIntake | null; model: QualifiedBudgetPlanningModel | null; baselineModelVersion?: string|null; goalConfigured: boolean; guidanceContextVersion?:string|null; observation?: EatingBudgetResponse['expenditure']; intakeAttributionProviders?: AttributionProviders };
export interface EatingBudgetRepository { read(userId: string, fallbackTimezone: string): Promise<BudgetSnapshot> }
/** Read-only repeatable snapshot; no provider fetch, model refresh, finalization or settings writes. */
export class PrismaEatingBudgetRepository implements EatingBudgetRepository {
  constructor(private readonly db: PrismaClient, private readonly now: () => Date = () => new Date()) {}
  async read(userId: string, fallbackTimezone: string): Promise<BudgetSnapshot> {
    return this.db.$transaction(async tx => {
      const profile = await tx.userProfile.findUnique({ where: { userId } });
      const timezone = profile?.timezone ?? fallbackTimezone;
      const now = this.now();
      const localDate = getLocalDateForTimezone(timezone, now);
      const date = new Date(`${localDate}T00:00:00Z`);
      const [selection, goal] = await Promise.all([readProviderSelection(tx, userId), tx.goalConfiguration.findUnique({ where: { userId } })]);
      const authority = await resolveIntakeAuthority(tx, userId, date, selection);
      const sourceId = JSON.stringify([authority.provider, authority.writerId, authority.sourceId]);
      const context: BudgetContext = { accountId: userId, expenditureSourceId: selection.authoritativeExpenditureProvider, intakeSourceId: sourceId,
        localDate, timezone, now, signedGoalAdjustmentCalories: goal?.dailyEnergyAdjustment ?? 0, dailyBankTargetCalories: profile?.dailyBankTargetCalories ?? 0 };
      const todayRepository = new PrismaTodayAggregateRepository(this.db, { now: () => now, allowSyntheticProviders: false, includeGuidanceContext:true });
      const today = await todayRepository.readTodaySnapshotForBudget(tx,userId,localDate,timezone,now);
      const projection = today.restOfDayProjection;
      const [exactExpenditure, restingEstimate] = await Promise.all([
        tx.dailyExpenditureAggregate.findUnique({ where: { userId_localDate_provider: { userId, localDate: date, provider: selection.authoritativeExpenditureProvider } } }),
        tx.restingBurnEstimate.findUnique({ where: { userId } }),
      ]);
      // The existing hypothetical forecast permits a legacy resting-source fallback.
      // Food guidance requires a qualified model from this exact expenditure source.
      const verified =
        selection.expenditureSelected &&
        restingEstimate?.provider === selection.authoritativeExpenditureProvider &&
        exactExpenditure?.isCurrentDay && exactExpenditure.timezone === timezone &&
        exactExpenditure.rawTotalDailyExpenditure === today.burned.raw &&
        exactExpenditure.forecastCoverageAt?.toISOString() === projection.coverageAt &&
        today.burned.status === 'ready' && projection.status === 'ready' &&
        projection.coverageStatus === 'known' && projection.planningAnchorKind === 'verified_coverage' &&
        projection.coverageAt && projection.planningAnchorAt === projection.coverageAt &&
        projection.planningExpiresAt && projection.unroundedProjectedProviderBurnCalories != null &&
        today.burned.raw !== null;
      // No mapping of retrieval/sample timestamps to verified common expenditure coverage.
      const expenditure: BudgetExpenditure | null = verified ? {
        accountId: userId, sourceId: context.expenditureSourceId, localDate, timezone, semantic: 'accumulated',
        rawProviderCalories: today.burned.raw!, coverage: 'verified', coverageAt: new Date(projection.coverageAt!), planningExpiresAt: new Date(projection.planningExpiresAt!),
        remainingRest: { rawProviderCalories: projection.unroundedProjectedProviderBurnCalories! - today.burned.raw!, from: new Date(projection.coverageAt!), through: getLocalDateUtcBounds(localDate, timezone).end, qualified: true },
      } : null;
      const eaten = today.eaten.authoritative;
      const intake: BudgetIntake | null = eaten ? { accountId: userId, sourceId, localDate, timezone,
        calories: eaten.calories, semantic: eaten.semanticKind, coverage: null, correction: null } : null;
      // Today already resolved corrections atomically. Do not apply them a second time.
      // No approved persisted intake SLA or common steps horizon exists: neither is fabricated.
      return { context, expenditure, intake, model: null, goalConfigured: goal !== null,
        guidanceContextVersion:today.guidanceContextVersion??null, baselineModelVersion:today.restOfDayProjection.modelVersion??null,
        intakeAttributionProviders: today.budgetIntakeAttributionProviders ?? [],
        observation: { rawCalories: today.burned.raw, adjustedCalories: today.burned.adjusted,
          source: today.burned.source, lastSyncedAt: today.burned.lastSyncedAt, status: today.burned.status,
          coverage: expenditure ? 'verified' : 'unverified' } };
    }, { isolationLevel: 'RepeatableRead' });
  }
}
