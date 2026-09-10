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
      <Stack.Screen name="goal-settings" options={{ title: 'Fitness Goal' }} />
      <Stack.Screen name="daily-bank-target" options={{ title: 'Daily Bank Target' }} />
      <Stack.Screen name="planned-treat" options={{ title: 'Banking Goal' }} />
      <Stack.Screen name="integrations" options={{ title: 'Health Connections' }} />
      <Stack.Screen name="health-diagnostics" options={{ title: 'HealthKit Diagnostics' }} />
      <Stack.Screen name="customize-today" options={{ title: 'Customize Today' }} />
      <Stack.Screen name="delete-account" options={{ title: 'Delete Account' }} />
      <Stack.Screen name="morning-bank-update" options={{ title: 'Morning Bank Update' }} />
    </Stack>
  );
}
