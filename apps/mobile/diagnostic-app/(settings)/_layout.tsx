import { Stack } from 'expo-router';
import { NavigationBackButton } from '@/components/caloriebank/NavigationBackButton';
import { colors } from '@/constants/caloriebank-theme';
export default function DiagnosticSettingsLayout() {
  return <Stack screenOptions={{ headerBackVisible: false, headerLeft: () => <NavigationBackButton fallback="/settings" />, headerStyle: { backgroundColor: colors.background }, headerTintColor: colors.text, contentStyle: { backgroundColor: colors.background } }}>
    <Stack.Screen name="integrations" options={{ title: 'Health Connections' }} />
  </Stack>;
}
