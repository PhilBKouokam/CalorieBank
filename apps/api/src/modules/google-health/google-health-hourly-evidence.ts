import {getLocalDateUtcBounds} from '@caloriebank/domain';

/** Google total-calories rollUp permits at most14 elapsed days, not14 civil days.
 * Preserve whole local-day boundaries; the next request covers the remainder. */
export function boundedBaselineChunk(endDate:string,requestedDays:number,timezone:string){
 const end=getLocalDateUtcBounds(endDate,timezone).start;
 let days=Math.min(14,requestedDays);
 const dateBefore=(n:number)=>{const d=new Date(`${endDate}T12:00:00Z`);d.setUTCDate(d.getUTCDate()-n);return d.toISOString().slice(0,10);};
 let startDate=dateBefore(days),start=getLocalDateUtcBounds(startDate,timezone).start;
 while(end.getTime()-start.getTime()>14*86_400_000&&days>1){days--;startDate=dateBefore(days);start=getLocalDateUtcBounds(startDate,timezone).start;}
 return {days,startDate,endDate,start,end};
}

/** Provider-neutral evidence is not inferred from retrieval or a missing metric.
 * These are matched full-hour reported totals, not physiological basal readings.
 */
type Hour = {
  startTime: string; endTime: string;
  totalCalories?: { kcalSum: number } | undefined;
  steps?: { countSum: number } | undefined;
};
export function pairLowActivityHourlyEvidence(
  calories: readonly Hour[], steps: readonly Hour[],
  exercises: readonly { start: Date; end: Date }[],
) {
  const counts = (rows: readonly Hour[]) => {
    const count = new Map<number, number>();
    for (const row of rows) count.set(Date.parse(row.startTime), (count.get(Date.parse(row.startTime)) ?? 0) + 1);
    return count;
  };
  const energyStarts = counts(calories), stepStarts = counts(steps);
  const stepByStart = new Map(steps.map(row => [Date.parse(row.startTime), row]));
  const ordered = [...calories].sort((a, b) => Date.parse(a.startTime) - Date.parse(b.startTime));
  if (ordered.some((row, i) => i > 0 && Date.parse(row.startTime) < Date.parse(ordered[i - 1]!.endTime))) return [];
  return ordered.flatMap(row => {
    const matched = stepByStart.get(Date.parse(row.startTime));
    const start = new Date(row.startTime), end = new Date(row.endTime);
    if (energyStarts.get(Date.parse(row.startTime)) !== 1 || stepStarts.get(Date.parse(row.startTime)) !== 1 ||
      !row.totalCalories || !matched?.steps || Date.parse(row.endTime) !== Date.parse(matched.endTime) ||
      !Number.isFinite(start.getTime()) || end.getTime() - start.getTime() !== 3_600_000 ||
      !Number.isFinite(row.totalCalories.kcalSum) || row.totalCalories.kcalSum < 0 ||
      !Number.isSafeInteger(matched.steps.countSum) || matched.steps.countSum < 0) return [];
    return [{ calories: row.totalCalories.kcalSum, steps: matched.steps.countSum,
      overlapsWorkout: exercises.some(workout => workout.start < end && workout.end > start), observedAt: start }];
  });
}
