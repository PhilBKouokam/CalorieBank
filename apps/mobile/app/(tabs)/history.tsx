import { Text } from 'react-native';

import { PlaceholderScreen } from '@/components/caloriebank/PlaceholderScreen';

export default function HistoryScreen() {
  return (
    <PlaceholderScreen
      eyebrow="Day Summaries"
      title="History"
      description="A placeholder for finalized daily summaries: target, food, activity, finalization status, and bank change."
      links={[{ href: '/ledger', label: 'Open Ledger Placeholder' }]}
    >
      <Text>Future history rows will explain each day without mutating finalized ledger records.</Text>
    </PlaceholderScreen>
  );
}
