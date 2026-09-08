import { useRouter } from 'expo-router';
import { KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';

import { GoalConfigurationForm } from '@/components/caloriebank/GoalConfigurationForm';
import { PlaceholderScreen } from '@/components/caloriebank/PlaceholderScreen';

export default function GoalSettingsScreen() {
  const router = useRouter();

  return (
    <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <PlaceholderScreen
        eyebrow="Goal"
        title="Update your goal"
        description="Choose your weight goal and daily calorie adjustment. Changes apply to future days."
      >
        <GoalConfigurationForm mode="settings" onSaved={() => router.replace('/today')} />
      </PlaceholderScreen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
});
