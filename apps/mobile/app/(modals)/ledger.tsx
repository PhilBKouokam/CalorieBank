import { Text } from 'react-native';

import { PlaceholderScreen } from '@/components/caloriebank/PlaceholderScreen';

export default function LedgerScreen() {
  return (
    <PlaceholderScreen
      eyebrow="Balance Explanation"
      title="Ledger"
      description="A placeholder for chronological deposits, withdrawals, and adjustments that explain every balance change."
      links={[
        { href: '/today', label: 'Return to Today' },
        { href: '/history', label: 'View History Placeholder', variant: 'secondary' },
      ]}
    >
      <Text>Ledger logic will be introduced later as immutable transactions, not a single mutable balance.</Text>
    </PlaceholderScreen>
  );
}
