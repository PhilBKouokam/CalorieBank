import { Text } from 'react-native';

import { PlaceholderScreen } from '@/components/caloriebank/PlaceholderScreen';

export default function TodayScreen() {
  return (
    <PlaceholderScreen
      eyebrow="Mobile V1 Foundation"
      title="Today"
      description="A placeholder for the current bank, latest sync state, projected progress, setup state, and planning access."
      metrics={[
        { label: 'Available Bank', value: '0 cal' },
        { label: 'Latest Sync', value: 'Pending' },
        { label: 'Projected Progress', value: '0 cal' },
        { label: 'Setup State', value: 'Not connected' },
      ]}
      links={[
        { href: '/ledger', label: 'View Ledger Placeholder' },
        { href: '/onboarding', label: 'Open Setup Placeholder', variant: 'secondary' },
      ]}
    >
      <Text>
        Planning access will compare future meal estimates against the bank later. Business logic stays out of the
        mobile shell until the domain and API contracts are ready.
      </Text>
    </PlaceholderScreen>
  );
}
