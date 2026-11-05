import type { TodayResponse } from '@caloriebank/schemas';
import { currentDateSnapshot } from './current-date';
/** Presentation of an existing qualified estimate, never a new budget formula. */
export function projectedBurnGuidance(today: TodayResponse | null, now: Date, guidanceAllowed=true): number | null {
  if(!guidanceAllowed)return null;
  const current=currentDateSnapshot(today,now),p=current?.restOfDayProjection;
  if(!current||!p||current.burned.status!=='ready'||p.status!=='ready'||p.planningAnchorKind==='retrieval_assumption'||
    !p.planningAnchorAt||!p.planningExpiresAt||Date.parse(p.planningAnchorAt)>now.getTime()||Date.parse(p.planningExpiresAt)<=now.getTime()||
    !Number.isSafeInteger(p.projectedAdjustedBurnCalories)||p.projectedAdjustedBurnCalories!<0)return null;
  return p.projectedAdjustedBurnCalories;
}
