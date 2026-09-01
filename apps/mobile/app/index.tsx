import { useAuth, useClerk } from '@clerk/expo';
import { Redirect } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, radii, spacing, typography } from '@/constants/caloriebank-theme';
import {
  ApiAuthenticationPendingError,
  ApiHttpError,
  fetchOnboardingStatus,
  getApiAuthenticationState,
} from '@/lib/api/client';

type GateState = '/onboarding' | '/today' | 'loading' | 'error';
type BootstrapProblem = 'session' | 'connectivity' | 'service' | 'conflict' | null;

function ApplicationGate({
  authReady = true,
  onSignOut,
}: {
  authReady?: boolean;
  onSignOut?: () => Promise<void>;
}) {
  const [gateState, setGateState] = useState<GateState>('loading');
  const [problem, setProblem] = useState<BootstrapProblem>(null);
  const [retryCount, setRetryCount] = useState(0);
  const running = useRef(false);

  async function resolveInitialRoute() {
    if (running.current) return;
    if (!authReady) {
      setProblem('session');
      setGateState('error');
      return;
    }
    if (!getApiAuthenticationState().ready) {
      setGateState('loading');
      return;
    }
    running.current = true;
    setGateState('loading');
    setProblem(null);

    if (__DEV__) console.info('[CalorieBank Bootstrap] onboarding_request_started', {
      clerkLoaded: authReady,
      activeSessionPresent: authReady,
      tokenGetterReady: getApiAuthenticationState().tokenGetterReady,
      retryCount,
    });

    try {
      const onboarding = await fetchOnboardingStatus();
      setGateState(onboarding.completed ? '/today' : '/onboarding');
    } catch (error) {
      const nextProblem: BootstrapProblem = error instanceof ApiAuthenticationPendingError
        ? 'session'
        : error instanceof ApiHttpError
          ? error.kind === 'authentication' || error.kind === 'forbidden'
            ? 'session'
            : error.kind === 'service'
              ? 'service'
              : error.kind === 'conflict'
                ? 'conflict'
                : 'connectivity'
          : 'connectivity';
      if (__DEV__) console.info('[CalorieBank Bootstrap] onboarding_request_rejected', {
        httpStatus: error instanceof ApiHttpError ? error.status : null,
        errorCode: error instanceof ApiHttpError ? error.code : null,
        problem: nextProblem,
        retryCount,
      });
      setProblem(nextProblem);
      setGateState('error');
    } finally {
      running.current = false;
    }
  }

  useEffect(() => {
    if (authReady && getApiAuthenticationState().ready) void resolveInitialRoute();
  // Authentication readiness, rather than navigation timing, owns the first protected request.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authReady]);

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
            <Text style={styles.detail}>Loading your bank and connection status.</Text>
          </>
        ) : (
          <>
            <Text style={styles.title}>Unable to load setup</Text>
            <Text style={styles.detail}>{
              problem === 'session'
                ? "We couldn't verify your session. Sign in again to continue."
                : problem === 'service'
                  ? 'CalorieBank is temporarily unavailable. Try again in a moment.'
                  : problem === 'conflict'
                    ? 'We could not confirm your account setup. Sign in again to continue.'
                    : "We couldn't reach CalorieBank. Check your connection and try again."
            }</Text>
            <Pressable accessibilityRole="button" onPress={() => { setRetryCount((count) => count + 1); void resolveInitialRoute(); }} style={styles.button}>
              <Text style={styles.buttonText}>Try again</Text>
            </Pressable>
            {onSignOut ? <Pressable accessibilityRole="button" onPress={() => void onSignOut()} style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>Sign out</Text>
            </Pressable> : null}
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

function AuthenticatedIndexRoute() {
  const { isLoaded, isSignedIn, sessionId } = useAuth();
  const { signOut } = useClerk();
  if (!isLoaded) return <LoadingState />;
  if (!isSignedIn || !sessionId) return <Redirect href="/sign-in" />;
  return <ApplicationGate authReady={getApiAuthenticationState().ready} onSignOut={signOut} />;
}

function LoadingState() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <ActivityIndicator color={colors.primary} size="large" />
        <Text style={styles.title}>Loading CalorieBank…</Text>
      </View>
    </SafeAreaView>
  );
}

export default function IndexRoute() {
  return (process.env.EXPO_PUBLIC_AUTH_MODE ?? 'development') === 'clerk'
    ? <AuthenticatedIndexRoute />
    : <ApplicationGate />;
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
  secondaryButton: { borderColor: colors.border, borderRadius: radii.sm, borderWidth: 1, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  secondaryButtonText: { color: colors.text, fontSize: typography.body, fontWeight: '700' },
  buttonText: {
    color: colors.surface,
    fontSize: typography.body,
    fontWeight: '700',
  },
});
