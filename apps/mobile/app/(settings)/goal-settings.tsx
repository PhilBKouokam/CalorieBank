import { useRouter } from 'expo-router';
import { KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';

import { GoalConfigurationForm } from '@/components/caloriebank/GoalConfigurationForm';
import { PlaceholderScreen } from '@/components/caloriebank/PlaceholderScreen';

export default function GoalSettingsScreen() {
  const router = useRouter();

  return (
    <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <PlaceholderScreen
        eyebrow="Goal Settings"
        title="Update your goal"
        description="Change your goal mode or adjustment. Future bank calculations should use the active configuration for the effective date."
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
