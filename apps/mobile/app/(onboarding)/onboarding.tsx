import { useRouter } from 'expo-router';
import { KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';

import { GoalConfigurationForm } from '@/components/caloriebank/GoalConfigurationForm';
import { PlaceholderScreen } from '@/components/caloriebank/PlaceholderScreen';

export default function OnboardingScreen() {
  const router = useRouter();

  return (
    <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <PlaceholderScreen
        eyebrow="Account Setup"
        title="Configure your goal"
        description="CalorieBank derives your daily allowance from connected expenditure data. You only choose the adjustment for your goal."
      >
        <GoalConfigurationForm mode="onboarding" onSaved={() => router.replace('/today')} />
      </PlaceholderScreen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
});
