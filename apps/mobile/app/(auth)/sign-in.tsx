import { useAuth } from '@clerk/expo';
import { useHostedAuth } from '@clerk/expo/hosted-auth';
import Constants from 'expo-constants';
import { Redirect, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, radii, spacing, typography } from '@/constants/caloriebank-theme';
import {
  defaultHostedAuthRedirect,
  hostedAuthErrorMetadata,
  hostedAuthResultMetadata,
} from '@/lib/auth/hosted-auth-diagnostics';

const hostedAuthRedirect = defaultHostedAuthRedirect(
  Constants.expoConfig?.ios?.bundleIdentifier ?? 'com.caloriebank.mobile',
);

export default function SignInScreen() {
  const router = useRouter();
  const { isLoaded, isSignedIn, sessionId } = useAuth();
  const { startHostedAuth } = useHostedAuth();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pendingSession, setPendingSession] = useState<{
    id: string;
    operation: 'sign_in' | 'sign_up';
  } | null>(null);

  useEffect(() => {
    if (!pendingSession || !isLoaded) return;
    const activeSessionMatchesCreatedSession = sessionId === pendingSession.id;
    if (__DEV__) {
      console.info('[CalorieBank Auth] hosted_auth_session_state', {
        operation: pendingSession.operation,
        activeSessionExists: Boolean(sessionId),
        createdSessionIdEqualsActiveSession: activeSessionMatchesCreatedSession,
        ...hostedAuthRedirect,
      });
    }
    if (activeSessionMatchesCreatedSession) router.replace('/');
  }, [isLoaded, pendingSession, router, sessionId]);

  if (isLoaded && isSignedIn && !pendingSession) return <Redirect href="/" />;

  async function authenticate(mode: 'sign-in' | 'sign-up') {
    const operation = mode === 'sign-in' ? 'sign_in' : 'sign_up';
    setBusy(true);
    setMessage(null);
    if (__DEV__) {
      console.info('[CalorieBank Auth] hosted_auth_started', {
        operation,
        ...hostedAuthRedirect,
      });
    }
    try {
      const result = await startHostedAuth({ mode });
      if (__DEV__) {
        console.info('[CalorieBank Auth] hosted_auth_result', {
          operation,
          ...hostedAuthResultMetadata(result),
          ...hostedAuthRedirect,
        });
      }
      if (result.createdSessionId) {
        // Clerk Expo 4.5.1 activates this session inside startHostedAuth().
        // Wait for useAuth to observe that active session before routing.
        setPendingSession({ id: result.createdSessionId, operation });
      } else {
        setMessage('Sign-in could not be completed. Please try again.');
      }
    } catch (error) {
      if (__DEV__) {
        console.warn('[CalorieBank Auth] hosted_auth_failure', {
          operation,
          ...hostedAuthErrorMetadata(error),
          authSessionResultExists: false,
          authSessionResultType: null,
          createdSessionIdExists: false,
          ...hostedAuthRedirect,
        });
      }
      setMessage('Sign-in could not be completed. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.eyebrow}>CALORIEBANK</Text>
        <Text style={styles.title}>Your calorie bank, private to you</Text>
        <Text style={styles.detail}>Sign in to access your bank and connected health services.</Text>
        {message ? <Text style={styles.error}>{message}</Text> : null}
        <Pressable disabled={busy} onPress={() => void authenticate('sign-in')} style={styles.primary}>
          {busy ? <ActivityIndicator color={colors.surface} /> : <Text style={styles.primaryText}>Sign in</Text>}
        </Pressable>
        <Pressable disabled={busy} onPress={() => void authenticate('sign-up')} style={styles.secondary}>
          <Text style={styles.secondaryText}>Create account</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1, justifyContent: 'center', gap: spacing.md, padding: spacing.xl },
  eyebrow: { color: colors.primary, fontSize: 13, fontWeight: '800' },
  title: { color: colors.text, fontSize: typography.heading, fontWeight: '800' },
  detail: { color: colors.textMuted, fontSize: typography.body, lineHeight: 24, marginBottom: spacing.md },
  error: { color: colors.text, fontSize: typography.body },
  primary: { alignItems: 'center', backgroundColor: colors.primary, borderRadius: radii.sm, minHeight: 52, justifyContent: 'center', padding: spacing.md },
  primaryText: { color: colors.surface, fontSize: typography.body, fontWeight: '700' },
  secondary: { alignItems: 'center', borderColor: colors.border, borderRadius: radii.sm, borderWidth: 1, minHeight: 52, justifyContent: 'center', padding: spacing.md },
  secondaryText: { color: colors.text, fontSize: typography.body, fontWeight: '700' },
});
