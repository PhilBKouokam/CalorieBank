import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, radii, spacing, typography } from '@/constants/caloriebank-theme';
import { fetchGoalConfiguration } from '@/lib/api/client';

type GateState = '/onboarding' | '/today' | 'loading' | 'error';

export default function IndexRoute() {
  const [gateState, setGateState] = useState<GateState>('loading');

  async function resolveInitialRoute() {
    setGateState('loading');

    try {
      const configuration = await fetchGoalConfiguration();
      setGateState(configuration ? '/today' : '/onboarding');
    } catch {
      setGateState('error');
    }
  }

  useEffect(() => {
    void resolveInitialRoute();
  }, []);

  if (gateState === '/today' || gateState === '/onboarding') {
    return <Redirect href={gateState} />;
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {gateState === 'loading' ? (
          <>
            <ActivityIndicator color={colors.primary} size="large" />
            <Text style={styles.title}>Loading CalorieBank…</Text>
            <Text style={styles.detail}>Checking for your saved goal configuration.</Text>
          </>
        ) : (
          <>
            <Text style={styles.title}>Unable to load setup</Text>
            <Text style={styles.detail}>Make sure the CalorieBank API and PostgreSQL database are running.</Text>
            <Pressable accessibilityRole="button" onPress={() => void resolveInitialRoute()} style={styles.button}>
              <Text style={styles.buttonText}>Try again</Text>
            </Pressable>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.lg,
  },
  title: {
    color: colors.text,
    fontSize: typography.heading,
    fontWeight: '800',
    textAlign: 'center',
  },
  detail: {
    color: colors.textMuted,
    fontSize: typography.body,
    lineHeight: 24,
    textAlign: 'center',
  },
  button: {
    borderRadius: radii.sm,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  buttonText: {
    color: colors.surface,
    fontSize: typography.body,
    fontWeight: '700',
  },
});
