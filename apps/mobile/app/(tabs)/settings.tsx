import { Text } from 'react-native';

import { PlaceholderScreen } from '@/components/caloriebank/PlaceholderScreen';

export default function SettingsScreen() {
  return (
    <PlaceholderScreen
      eyebrow="Controls"
      title="Settings"
      description="A placeholder for goal mode, target, timezone, privacy controls, and account actions."
      links={[
        { href: '/onboarding', label: 'Open Onboarding Placeholder' },
        { href: '/sign-in', label: 'Open Sign In Placeholder', variant: 'secondary' },
      ]}
    >
      <Text>Authentication, secure storage, and account management are intentionally not wired yet.</Text>
    </PlaceholderScreen>
  );
}
