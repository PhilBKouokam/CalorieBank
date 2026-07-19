import { Text } from 'react-native';

import { PlaceholderScreen } from '@/components/caloriebank/PlaceholderScreen';

export default function SignInScreen() {
  return (
    <PlaceholderScreen
      eyebrow="Private Alpha"
      title="Sign in"
      description="A placeholder for beta authentication. No auth provider or API call is wired during this foundation step."
      links={[{ href: '/onboarding', label: 'Open Onboarding Placeholder' }]}
    >
      <Text>Authentication will be implemented after the mobile shell and API foundation are verified.</Text>
    </PlaceholderScreen>
  );
}
