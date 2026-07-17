import { Text } from 'react-native';

import { PlaceholderScreen } from '@/components/caloriebank/PlaceholderScreen';

export default function TodayScreen() {
  return (
    <PlaceholderScreen
      eyebrow="Mobile V1 Foundation"
      title="Today"
      description="A placeholder for the daily calorie target, consumed calories, projected bank change, and current calorie-bank balance."
      metrics={[
        { label: 'Bank Balance', value: '0 cal' },
        { label: 'Projected Today', value: '0 cal' },
        { label: 'Consumed', value: '0 cal' },
        { label: 'Daily Target', value: '0 cal' },
      ]}
      links={[
        { href: '/add-food', label: 'Add Food Placeholder' },
        { href: '/ledger', label: 'View Ledger Placeholder', variant: 'secondary' },
      ]}
    >
      <Text>Business logic will stay out of the mobile shell until the domain and API contracts are ready.</Text>
    </PlaceholderScreen>
  );
}
