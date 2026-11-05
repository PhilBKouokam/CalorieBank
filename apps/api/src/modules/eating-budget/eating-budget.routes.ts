import { Router } from 'express';
import { AppError } from '../../errors';
import { calculateEatingBudget, planIntakeForSteps, planStepsForIntake } from '@caloriebank/domain';
import { eatPlanningRequestSchema, eatPlanningResponseSchema, eatingBudgetResponseSchema } from '@caloriebank/schemas';
import { resolveRequestUser, type RequestUserSource } from '../../auth/current-user';
import { qualifiedPlanningModel, type BudgetSnapshot, type EatingBudgetRepository } from './eating-budget.repository';
function timezone(value: unknown) {
  if (typeof value !== 'string' || value.length > 100) return 'UTC';
  try { new Intl.DateTimeFormat('en-US', { timeZone: value }).format(); return value; } catch { return 'UTC'; }
}
function publicSnapshot(snapshot: BudgetSnapshot) {
  const { context: c, expenditure } = snapshot;
  const model=qualifiedPlanningModel(snapshot);
  const candidate = snapshot.intake;
  const intake = candidate && candidate.accountId === c.accountId && candidate.sourceId === c.intakeSourceId && candidate.localDate === c.localDate && candidate.timezone === c.timezone ? candidate : null;
  const displayIntake = intake?.semantic === 'unknown' ? null : intake;
  const result = snapshot.goalConfigured ? calculateEatingBudget(c, expenditure, intake) : { status: 'unavailable' as const, reason: 'goal_not_configured' };
  const budget = result.status === 'unavailable' ? result : { status: result.status, estimated: result.estimated, totalCalories: result.totalCalories,
    comparison: result.comparison, expiresAt: result.expiresAt.toISOString(), comparisonExpiresAt: result.comparisonExpiresAt?.toISOString() ?? null };
  return eatingBudgetResponseSchema.parse({ version: 1, localDate: c.localDate, timezone: c.timezone,
    guidanceContextVersion:snapshot.guidanceContextVersion??null,
    signedGoalAdjustmentCalories: snapshot.goalConfigured ? c.signedGoalAdjustmentCalories : null, dailyBankTargetCalories: c.dailyBankTargetCalories,
    intake: { calories: displayIntake?.calories ?? null, semantic: displayIntake?.semantic ?? 'unknown', attributionProviders: displayIntake ? snapshot.intakeAttributionProviders : undefined }, budget,
    expenditure: snapshot.observation,
    planningAvailable: result.status === 'ready' && model !== null, planningUnavailableReason:result.status==='unavailable'?result.reason:model?null:'shared_step_alignment_unverified',
    planningModel:model?{basis:model.evidence!.basis,baselineModelVersion:model.evidence!.baselineModelVersion,calibrationVersion:model.evidence!.calibrationVersion,expiresAt:model.evidence!.expiresAt.toISOString(),coverageAt:model.currentStepsAt!.toISOString(),currentSteps:model.currentSteps,rawProviderCaloriesPerAdditionalStep:model.providerCaloriesPerAdditionalStep,stepsPerMinute:model.stepsPerMinute}:null });
}
export function createEatingBudgetRouter(repository: EatingBudgetRepository, userSource: RequestUserSource, enabled = false) {
  const router = Router();
  // Default-off returns normal 404; no repository reads and no legacy response changes.
  router.use((_req, res, next) => {if(!enabled){next('router');return;}res.set('Cache-Control','no-store');next();});
  router.get('/', async (req, res, next) => {
    try {
      const userId = resolveRequestUser(userSource, res).id;
      const snapshot = await repository.read(userId, timezone(req.query.timezone));
      if (snapshot.context.accountId !== userId) throw new AppError('This estimate is unavailable.', 403);
      res.set('Cache-Control', 'no-store').json(publicSnapshot(snapshot));
    } catch (error) { next(error); }
  });
  router.post('/plan', async (req, res, next) => {
    try {
      const parsed = eatPlanningRequestSchema.safeParse(req.body);
      if (!parsed.success) { res.status(400).json({ error: { message: 'Enter a valid total-day planning value.' } }); return; }
      const input = parsed.data;
      const userId = resolveRequestUser(userSource, res).id;
      const snapshot = await repository.read(userId, timezone(req.query.timezone));
      if (snapshot.context.accountId !== userId) throw new AppError('This estimate is unavailable.', 403);
      const { context: c, expenditure } = snapshot;
  const model=qualifiedPlanningModel(snapshot);
      const result = !snapshot.goalConfigured || !model ? { status: 'unavailable' as const, reason: 'qualified_activity_model_unavailable' }
        : input.direction === 'steps_to_intake' ? planIntakeForSteps(c, expenditure, model, input.totalSteps)
          : planStepsForIntake(c, expenditure, model, input.totalIntakeCalories);
      const plan = result.status === 'unavailable' ? result : { ...result, expiresAt: new Date(Math.min(result.expiresAt.getTime(),model!.evidence!.expiresAt.getTime())).toISOString() };
      res.set('Cache-Control', 'no-store').json(eatPlanningResponseSchema.parse({ version: 1, localDate: c.localDate, timezone: c.timezone, plan, snapshot: publicSnapshot(snapshot) }));
    } catch (error) { next(error); }
  });
  return router;
}
