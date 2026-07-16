import { Text } from 'react-native';
import { PlaceholderScreen } from '../components/PlaceholderScreen';

export default function SettingsScreen() {
  return (
    <PlaceholderScreen
      eyebrow="Controls"
      title="Settings"
      description="Placeholder for target, timezone, privacy, and account controls."
      links={[
        { href: '/sign-in', label: 'Open Sign In Placeholder' },
        { href: '/home', label: 'Return to Today' },
      ]}
    >
      <Text>Future settings: target history, timezone, sign out, export data, and delete account.</Text>
    </PlaceholderScreen>
  );
}
