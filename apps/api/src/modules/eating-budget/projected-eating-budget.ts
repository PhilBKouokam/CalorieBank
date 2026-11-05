import {calculateProjectedEatingBudget,getLocalDateUtcBounds,type BudgetContext} from '@caloriebank/domain';
import type {EatingBudgetResponse,TodayResponse} from '@caloriebank/schemas';
/** Uses the existing READY Today-card projection, including its existing source fallback.
 * This estimate never promotes reported timestamps to verified coverage. */
export function estimateFromTodayProjection(today:TodayResponse,c:BudgetContext,goalConfigured:boolean,sourceSelected:boolean):NonNullable<EatingBudgetResponse['projectedEstimate']>{
 const basis={basis:'caloriebank_adjusted_projection' as const,estimated:true as const};
 if(!goalConfigured)return {...basis,status:'unavailable',reason:'goal_not_configured'};
 const p=today.restOfDayProjection;
 if(!sourceSelected||today.date!==c.localDate||today.timezone!==c.timezone||today.burned.status!=='ready'||p.status!=='ready'||p.planningAnchorKind==='retrieval_assumption'||!p.planningAnchorAt||!p.planningExpiresAt||!Number.isSafeInteger(p.projectedAdjustedBurnCalories)||p.projectedAdjustedBurnCalories!<0)return {...basis,status:'unavailable',reason:'projected_burn_unavailable'};
 const anchor=Date.parse(p.planningAnchorAt),expiry=Date.parse(p.planningExpiresAt),bounds=getLocalDateUtcBounds(c.localDate,c.timezone);
 if(!Number.isFinite(anchor)||!Number.isFinite(expiry)||anchor>c.now.getTime()||anchor<bounds.start.getTime()||c.now>=bounds.end||expiry<=c.now.getTime())return {...basis,status:'unavailable',reason:'projected_burn_stale'};
 const result=calculateProjectedEatingBudget({projectedAdjustedBurnCalories:p.projectedAdjustedBurnCalories!,signedGoalAdjustmentCalories:c.signedGoalAdjustmentCalories,dailyBankTargetCalories:c.dailyBankTargetCalories});
 return result.status==='unavailable'?{...basis,...result}:{...basis,...result,expiresAt:new Date(Math.min(expiry,bounds.end.getTime())).toISOString()};
}
