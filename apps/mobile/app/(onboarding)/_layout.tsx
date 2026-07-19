import { Stack } from 'expo-router';

import { colors } from '@/constants/caloriebank-theme';

export default function OnboardingLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="onboarding" options={{ title: 'Onboarding' }} />
    </Stack>
  );
}
