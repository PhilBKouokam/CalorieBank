import { Stack } from 'expo-router';
import { NavigationBackButton } from '@/components/caloriebank/NavigationBackButton';

import { colors } from '@/constants/caloriebank-theme';

export default function DetailsLayout() {
  return (
    <Stack
      screenOptions={{
        headerBackVisible: false,
        headerLeft: () => <NavigationBackButton fallback="/today" />,
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="bank-history" options={{ title: 'Bank History' }} />
      <Stack.Screen name="today-workouts" options={{ title: "Today's Workouts" }} />
      <Stack.Screen name="steps-detail" options={{ title: 'Steps' }} />
      <Stack.Screen name="today-burn" options={{ title: 'Today' }} />
    </Stack>
  );
}
