import { Text } from 'react-native';
import { PlaceholderScreen } from '../components/PlaceholderScreen';

export default function HistoryScreen() {
  return (
    <PlaceholderScreen
      eyebrow="Ledger Context"
      title="History"
      description="Placeholder for finalized day summaries and balance explanations."
      links={[{ href: '/home', label: 'Return to Today' }]}
    >
      <Text>Future view: target, consumed calories, activity, finalization status, and ledger change.</Text>
    </PlaceholderScreen>
  );
}
