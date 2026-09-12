// Exact Android package IDs verified against publisher Google Play listings.
// A label is identity evidence, not a claim that this app exports nutrition.
const names: Readonly<Record<string, string>> = {
  'com.cronometer.android.gold': 'Cronometer',
  'com.myfitnesspal.android': 'MyFitnessPal',
  'com.fitnow.loseit': 'Lose It!',
  'com.sbs.diet': 'MacroFactor',
  'com.fatsecret.android': 'FatSecret',
};

export function nativeIntakeSourceName(packageId: string): string {
  return names[packageId] ?? 'Food tracker';
}
