/** Raw kcal. Explicit interval evidence is required; a stored workout scalar is
 * not an energy-basis or coverage attestation. No daily burn/accounting inputs. */
export type NetStepSample = {
  id: string; provider: string; activityType: 'walking' | 'running' | 'other';
  steps: { count: number; start: Date; end: Date };
  energy: { calories: number; start: Date; end: Date; basis: 'active_above_rest' | 'gross' | 'unknown' };
  /** Optional total-energy rollup over exactly the same walking interval. */
  grossEnergy?: { calories: number; start: Date; end: Date };
  restingEnergy?: { calories: number; start: Date; end: Date };
};
export function calibrateNetStepRate(input: {
  provider: string; activityType: 'walking' | 'running'; now: Date; samples: readonly NetStepSample[];
}) {
  const same = (a: Date, b: Date) => Number.isFinite(a.getTime()) && a.getTime() === b.getTime();
  const valid: { sample: NetStepSample; net: number }[] = [];
  const identities = new Map<string, string>();
  for (const s of input.samples) {
    if (s.provider !== input.provider || s.activityType !== input.activityType) continue;
    const fingerprint = JSON.stringify(s), old = identities.get(s.id);
    if (old && old !== fingerprint) return null;
    if (old) continue;
    identities.set(s.id, fingerprint);
    const e = s.energy, p = s.steps;
    if (!s.id || !same(e.start, p.start) || !same(e.end, p.end) || e.end <= e.start ||
      e.end > input.now || e.start.getTime() < input.now.getTime() - 30 * 86400000 ||
      !Number.isSafeInteger(p.count) || p.count <= 0 || !Number.isFinite(e.calories) || e.calories <= 0 ||
      (e.basis !== 'gross' && e.basis !== 'active_above_rest')) continue;
    let net = e.calories;
    if (e.basis === 'gross') {
      const r = s.restingEnergy;
      if (!r || !same(r.start, e.start) || !same(r.end, e.end) || !Number.isFinite(r.calories) || r.calories < 0) continue;
      net -= r.calories;
    }
    // Already-active energy ignores any supplied rest: never subtract twice.
    if (!(net > 0)) continue;
    valid.push({ sample: s, net });
  }
  valid.sort((a,b) => b.sample.steps.start.getTime() - a.sample.steps.start.getTime());
  const selected = valid.slice(0, 5);
  if (!input.provider || !Number.isFinite(input.now.getTime()) || !selected.length || selected.some((a,i) => selected.some((b,j) =>
    i !== j && a.sample.steps.start < b.sample.steps.end && a.sample.steps.end > b.sample.steps.start))) return null;
  const steps = selected.reduce((n,s) => n + s.sample.steps.count, 0);
  const calories = selected.reduce((n,s) => n + s.net, 0);
  const elapsedMinutes = selected.reduce((n,s) => n + (s.sample.steps.end.getTime() - s.sample.steps.start.getTime()) / 60000, 0);
  return { provider: input.provider, activityType: input.activityType, energyBasis: 'active_above_rest' as const,
    caloriesPerStep: calories / steps, stepsPerMinute: steps / elapsedMinutes, sampleCount: selected.length, steps, calories };
}


/** Ordinary-background replacement needs total walking energy, not a quiet-hour
 * total mislabeled as basal. Current active-only calibration remains unchanged.
 */
export function calibrateGrossWalkingRate(input: Parameters<typeof calibrateNetStepRate>[0]) {
  const unique = new Map<string, NetStepSample>();
  for (const sample of input.samples) {
    const prior = unique.get(sample.id);
    if (prior && JSON.stringify(prior) !== JSON.stringify(sample)) return null;
    unique.set(sample.id, sample);
  }
  const eligible = [...unique.values()].filter(sample => {
    const gross = sample.grossEnergy;
    return sample.activityType === 'walking' && gross && Number.isFinite(gross.calories) && gross.calories > 0 &&
      gross.start.getTime() === sample.steps.start.getTime() && gross.end.getTime() === sample.steps.end.getTime() &&
      (sample.energy.basis !== 'active_above_rest' || gross.calories >= sample.energy.calories) &&
      calibrateNetStepRate({ ...input, samples: [sample] }) !== null;
  }).sort((a, b) => b.steps.start.getTime() - a.steps.start.getTime()).slice(0, 5);
  const active = calibrateNetStepRate({ ...input, samples: eligible });
  if (!active || !eligible.length) return null;
  const grossCalories = eligible.reduce((n, sample) => n + sample.grossEnergy!.calories, 0);
  return { rawGrossWalkingKcalPerStep: grossCalories / active.steps, stepsPerMinute: active.stepsPerMinute,
    sampleCount: active.sampleCount, energyBasis: 'matched_total_interval' as const };
}

/** Complete matched total-energy windows; independent of active-energy availability. */
export type GrossWalkingSample = {
  id: string; provider: string; activityType: 'walking' | 'running' | 'other';
  steps: { count: number; start: Date; end: Date };
  totalEnergy: { calories: number; start: Date; end: Date };
};
export function calibrateTotalWalkingRate(input: {
  provider: string; now: Date; samples: readonly GrossWalkingSample[];
}) {
  if (!input.provider || !Number.isFinite(input.now.getTime())) return null;
  const unique = new Map<string, GrossWalkingSample>();
  for (const sample of input.samples) {
    const prior = unique.get(sample.id);
    if (prior && JSON.stringify(prior) !== JSON.stringify(sample)) return null;
    unique.set(sample.id, sample);
  }
  const selected = [...unique.values()].filter(s => {
    const p = s.steps, e = s.totalEnergy;
    return s.id && s.provider === input.provider && s.activityType === 'walking' &&
      Number.isSafeInteger(p.count) && p.count > 0 && Number.isFinite(e.calories) && e.calories > 0 &&
      Number.isFinite(p.start.getTime()) && Number.isFinite(p.end.getTime()) && p.end > p.start && p.end <= input.now &&
      p.start.getTime() >= input.now.getTime() - 30 * 86400000 &&
      e.start.getTime() === p.start.getTime() && e.end.getTime() === p.end.getTime();
  }).sort((a,b) => b.steps.start.getTime() - a.steps.start.getTime()).slice(0,5);
  if (!selected.length || selected.some((a,i) => selected.some((b,j) => i !== j && a.steps.start < b.steps.end && a.steps.end > b.steps.start))) return null;
  const steps = selected.reduce((n,s) => n+s.steps.count,0);
  const minutes = selected.reduce((n,s) => n+(s.steps.end.getTime()-s.steps.start.getTime())/60000,0);
  const totalCalories = selected.reduce((n,s) => n+s.totalEnergy.calories,0);
  const stepsPerMinute = steps/minutes;
  if (stepsPerMinute < 10 || stepsPerMinute > 250) return null;
  return { rawGrossWalkingKcalPerStep: totalCalories/steps, stepsPerMinute, sampleCount:selected.length, steps, totalCalories, minutes };
}
export function calibrateQuietWalkingRate(input: Parameters<typeof calibrateTotalWalkingRate>[0] & { providerQuietKcalPerHour: number }) {
  if (!Number.isFinite(input.providerQuietKcalPerHour) || input.providerQuietKcalPerHour <= 0) return null;
  const total = calibrateTotalWalkingRate(input);
  if (!total) return null;
  const caloriesPerStep = (total.totalCalories-input.providerQuietKcalPerHour*total.minutes/60)/total.steps;
  return Number.isFinite(caloriesPerStep) && caloriesPerStep > 0 ? { ...total, caloriesPerStep } : null;
}
