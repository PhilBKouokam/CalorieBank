import { Text } from 'react-native';

import { PlaceholderScreen } from '@/components/caloriebank/PlaceholderScreen';

export default function SettingsScreen() {
  return (
    <PlaceholderScreen
      eyebrow="Controls"
      title="Settings"
      description="Manage your goal and the data sources CalorieBank uses."
      links={[
        { href: '/customize-today', label: 'Customize Today' },
        { href: '/integrations', label: 'Health Connections' },
        { href: '/onboarding', label: 'Open Onboarding Placeholder' },
        { href: '/sign-in', label: 'Open Sign In Placeholder', variant: 'secondary' },
      ]}
    >
      <Text>Health data access is controlled by you in iOS Settings and the Health app.</Text>
    </PlaceholderScreen>
  );
}
