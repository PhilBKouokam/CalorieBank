import { Stack } from 'expo-router';

import { colors } from '@/constants/caloriebank-theme';

export default function SettingsLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="goal-settings" options={{ title: 'Goal Settings' }} />
      <Stack.Screen name="planned-treat" options={{ title: 'Planned Treat' }} />
    </Stack>
  );
}
