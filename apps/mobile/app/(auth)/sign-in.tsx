import { FrostedView, FrostedScreen as SafeAreaView } from '@/components/caloriebank/FrostedSurface';
import { hostedAuthRedirectForPlatform } from '@/lib/auth/platform-redirect';
import { useAuth } from '@clerk/expo';
import { useHostedAuth } from '@clerk/expo/hosted-auth';
import Constants from 'expo-constants';
import { Redirect, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '@/components/caloriebank/ScaleAwareText';

import { compactGlassCard } from '@/constants/card-surface';
import { colors, spacing, typography } from '@/constants/caloriebank-theme';
import {
  hostedAuthErrorMetadata,
  hostedAuthResultMetadata,
} from '@/lib/auth/hosted-auth-diagnostics';

const hostedAuthRedirect = hostedAuthRedirectForPlatform(Platform.OS, Constants.expoConfig ?? {});

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
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.introduction}>
          <Text style={styles.eyebrow}>CalorieBank</Text>
          <Text style={styles.title}>{Platform.OS === 'android' ? 'Your calorie bank is waiting.' : 'Your calorie bank, private to you'}</Text>
          <Text style={styles.detail}>{Platform.OS === 'android' ? 'Sign in to see your bank and keep planning your day.' : 'Sign in to access your bank and connected health services.'}</Text>
        </View>
        <FrostedView style={styles.actions}>
          {message ? <Text accessibilityLiveRegion="polite" style={styles.error}>{message}</Text> : null}
          <Pressable accessibilityRole="button" accessibilityLabel="Sign in" accessibilityState={{ disabled: busy, busy }} disabled={busy} onPress={() => void authenticate('sign-in')} style={({ pressed }) => [styles.primary, pressed && styles.pressed, busy && styles.disabled]}>
            {busy ? <ActivityIndicator color={colors.surface} /> : <Text style={styles.primaryText}>Sign in</Text>}
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Create account" accessibilityState={{ disabled: busy }} disabled={busy} onPress={() => void authenticate('sign-up')} style={({ pressed }) => [styles.secondary, pressed && styles.pressed, busy && styles.disabled]}>
            <Text style={styles.secondaryText}>Create account</Text>
          </Pressable>
        </FrostedView>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: 'transparent' },
  container: { flexGrow: 1, justifyContent: 'center', gap: 28, padding: 20 },
  introduction: { gap: 16 },
  actions: { ...compactGlassCard, padding: 18, gap: 12 },
  eyebrow: { color: '#176E61', fontSize: 16, fontWeight: '700' },
  title: { color: colors.text, fontSize: typography.heading, fontWeight: '800' },
  detail: { color: colors.textMuted, fontSize: typography.body, lineHeight: 24 },
  error: { color: '#A52C26', fontSize: typography.body, lineHeight: 24 },
  primary: { alignItems: 'center', backgroundColor: '#176E61', borderRadius: 14, minHeight: 52, justifyContent: 'center', padding: spacing.md },
  primaryText: { color: colors.surface, fontSize: typography.body, fontWeight: '700' },
  pressed: { opacity: 0.72 }, disabled: { opacity: 0.65 },
  secondary: { backgroundColor: '#EDF6F1', alignItems: 'center', borderColor: colors.border, borderRadius: 14, borderWidth: 1, minHeight: 52, justifyContent: 'center', padding: spacing.md },
  secondaryText: { color: colors.text, fontSize: typography.body, fontWeight: '700' },
});
