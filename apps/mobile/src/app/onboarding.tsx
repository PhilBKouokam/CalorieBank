import { Text } from 'react-native';
import { PlaceholderScreen } from '../components/PlaceholderScreen';

export default function OnboardingScreen() {
  return (
    <PlaceholderScreen
      eyebrow="Account Setup"
      title="Choose the starting target"
      description="Placeholder for goal mode, timezone, and daily calorie target setup."
      links={[{ href: '/home', label: 'Return to Today' }]}
    >
      <Text>Future fields: cut, maintain, bulk, timezone, and daily target.</Text>
    </PlaceholderScreen>
  );
}
