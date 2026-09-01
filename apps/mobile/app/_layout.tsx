import { ClerkProvider, useAuth } from '@clerk/expo';
import { tokenCache } from '@clerk/expo/token-cache';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import 'react-native-reanimated';

import { colors } from '@/constants/caloriebank-theme';
import { logMobileClerkConfiguration, setApiAccessTokenProvider } from '@/lib/api/client';
import { setAppleHealthAccountScope } from '@/lib/healthkit/healthkit-connection';
import { resetAccountLifecycle, runAccountLifecycle } from '@/lib/lifecycle/account-lifecycle';

function AppStack() {
  return (
    <>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(onboarding)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="(details)" options={{ headerShown: false }} />
        <Stack.Screen name="(settings)" options={{ headerShown: false }} />
        <Stack.Screen name="(modals)" options={{ presentation: 'modal' }} />
      </Stack>
      <StatusBar style="dark" />
    </>
  );
}

function AuthenticatedAppStack() {
  const { getToken, isLoaded, isSignedIn, sessionId, userId } = useAuth();
  setApiAccessTokenProvider(getToken, {
    ready: isLoaded && isSignedIn && Boolean(sessionId),
    activeSessionPresent: Boolean(sessionId),
  });
  setAppleHealthAccountScope(userId ?? null);
  useEffect(() => {
    resetAccountLifecycle(userId ?? null);
    if (!isLoaded || !isSignedIn || !sessionId || !userId) return;
    void runAccountLifecycle();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void runAccountLifecycle();
    });
    return () => subscription.remove();
  }, [isLoaded, isSignedIn, sessionId, userId]);
  return <AppStack />;
}

export default function RootLayout() {
  const appEnvironment = process.env.EXPO_PUBLIC_APP_ENV ?? 'local';
  const authMode = process.env.EXPO_PUBLIC_AUTH_MODE ?? 'development';
  const apiUrl = process.env.EXPO_PUBLIC_API_URL;
  if (appEnvironment !== 'local' && (authMode !== 'clerk' || !apiUrl?.startsWith('https://'))) {
    throw new Error('Beta and production builds require Clerk authentication and an HTTPS API URL.');
  }
  if (authMode !== 'clerk') {
    setAppleHealthAccountScope('local-development');
    resetAccountLifecycle('local-development');
    return <AppStack />;
  }

  const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;
  if (!publishableKey) {
    throw new Error('EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY is required when authentication is enabled.');
  }
  logMobileClerkConfiguration();

  return (
    <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
      <AuthenticatedAppStack />
    </ClerkProvider>
  );
}
