import { Stack } from 'expo-router';

import { colors } from '@/constants/caloriebank-theme';

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="sign-in" options={{ title: 'Sign In' }} />
    </Stack>
  );
}
