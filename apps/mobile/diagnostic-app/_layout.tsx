import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { colors } from '@/constants/caloriebank-theme';

export default function DiagnosticRoot() {
  return <View style={{ flex: 1 }}><Stack screenOptions={{ headerStyle: { backgroundColor: colors.background }, headerTintColor: colors.text, contentStyle: { backgroundColor: colors.background } }}>
    <Stack.Screen name="index" options={{ headerShown: false }} />
    <Stack.Screen name="settings" options={{ title: 'Back Geometry' }} />
    <Stack.Screen name="(settings)" options={{ headerShown: false }} />
  </Stack><StatusBar style="dark" /></View>;
}
