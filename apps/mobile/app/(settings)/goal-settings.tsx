import { useRouter } from 'expo-router';

import { GoalConfigurationForm } from '@/components/caloriebank/GoalConfigurationForm';
import { PlaceholderScreen } from '@/components/caloriebank/PlaceholderScreen';

export default function GoalSettingsScreen() {
  const router = useRouter();

  return (
    <PlaceholderScreen
      keyboardAware
      eyebrow="Fitness Goal"
      title="Update your Fitness Goal"
      description="Choose your weight goal and daily calorie adjustment. Changes apply to future days."
    >
      <GoalConfigurationForm mode="settings" onSaved={() => router.replace('/today')} />
    </PlaceholderScreen>
  );
}
