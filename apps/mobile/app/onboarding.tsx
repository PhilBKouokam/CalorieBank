import { Text } from 'react-native';

import { PlaceholderScreen } from '@/components/caloriebank/PlaceholderScreen';

export default function OnboardingScreen() {
  return (
    <PlaceholderScreen
      eyebrow="Account Setup"
      title="Choose the starting target"
      description="A placeholder for selecting cut, maintain, or bulk; confirming timezone; and setting a daily calorie target."
      links={[{ href: '/today', label: 'Return to Today' }]}
    >
      <Text>Future fields: goal mode, timezone, daily target, and activity-credit settings.</Text>
    </PlaceholderScreen>
  );
}
