import { Stack } from 'expo-router';
import { NavigationBackButton } from '@/components/caloriebank/NavigationBackButton';

import { colors } from '@/constants/caloriebank-theme';

export default function ModalLayout() {
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
      <Stack.Screen name="ledger" options={{ title: 'Ledger' }} />
    </Stack>
  );
}
