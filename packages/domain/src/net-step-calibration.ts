/** Raw kcal. Explicit interval evidence is required; a stored workout scalar is
 * not an energy-basis or coverage attestation. No daily burn/accounting inputs. */
export type NetStepSample = {
  id: string; provider: string; activityType: 'walking' | 'running' | 'other';
  steps: { count: number; start: Date; end: Date };
  energy: { calories: number; start: Date; end: Date; basis: 'active_above_rest' | 'gross' | 'unknown' };
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
  return { provider: input.provider, activityType: input.activityType, energyBasis: 'active_above_rest' as const,
    caloriesPerStep: calories / steps, sampleCount: selected.length, steps, calories };
}
