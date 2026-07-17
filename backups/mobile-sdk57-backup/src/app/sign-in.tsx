import { Text } from 'react-native';
import { PlaceholderScreen } from '../components/PlaceholderScreen';

export default function SignInScreen() {
  return (
    <PlaceholderScreen
      eyebrow="Private Alpha"
      title="Sign in"
      description="Placeholder for beta authentication. No auth provider is wired during foundation setup."
      links={[{ href: '/onboarding', label: 'Open Onboarding Placeholder' }]}
    >
      <Text>Authentication will be implemented after the mobile and API foundation are verified.</Text>
    </PlaceholderScreen>
  );
}
