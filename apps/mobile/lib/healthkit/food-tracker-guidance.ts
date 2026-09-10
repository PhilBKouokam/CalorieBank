export function foodTrackerGuidance(provider: string, bundleId?: string | null, chosenTracker?: string | null) {
  if (provider !== 'apple_health') return null;
  const cronometer = bundleId === 'CRONOMETER-GOLD' || chosenTracker === 'cronometer';
  return {
    title: cronometer ? 'Connect Cronometer to Apple Health' : 'Share food data with Apple Health',
    message: cronometer
      ? 'We haven’t found calories from Cronometer in Apple Health yet. Make sure Cronometer is sharing calories, then come back and try again.'
      : 'Make sure your food-tracking app is sharing calories with Apple Health, then come back and try again.',
    action: cronometer ? 'See how to connect Cronometer' : 'See how to share food data',
    steps: cronometer ? [
      'Open Cronometer.',
      'Go to More, then Connect Apps & Devices, then Apple Health.',
      'Allow Cronometer to share dietary calories with Apple Health. Food in Cronometer does not automatically appear in Apple Health unless sharing is enabled.',
      'Return to CalorieBank and check again.',
    ] : [
      'Open your food-tracking app and find its Apple Health connection settings.',
      'Allow the app to share dietary calories with Apple Health.',
      'Return to CalorieBank and check again.',
    ],
  };
}
