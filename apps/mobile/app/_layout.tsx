import { ClerkProvider, useAuth } from '@clerk/expo';
import { tokenCache } from '@clerk/expo/token-cache';
import * as Notifications from 'expo-notifications';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { AppState, View } from 'react-native';
import 'react-native-reanimated';

import { colors } from '@/constants/caloriebank-theme';
import { ProtocolUpdateNotice } from '@/components/caloriebank/ProtocolUpdateNotice';
import { logMobileClerkConfiguration, setApiAccessTokenProvider } from '@/lib/api/client';
import { setNativeHealthAccountScope } from '@/lib/native-health';
import { resetAccountLifecycle, refreshOnAppState } from '@/lib/lifecycle/account-lifecycle';
import { setNotificationAccountScope, syncMorningBankUpdateDevice } from '@/lib/notifications/morning-bank-update';

function AppStack() {
  return (
    <View style={{ flex: 1 }}>
      <ProtocolUpdateNotice />
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
        <Stack.Screen name="(modals)" options={{ presentation: 'modal', headerShown: false }} />
      </Stack>
      <StatusBar style="dark" />
    </View>
  );
}

function AuthenticatedAppStack() {
  const router = useRouter();
  const { getToken, isLoaded, isSignedIn, sessionId, userId } = useAuth();
  setApiAccessTokenProvider(getToken, {
    ready: isLoaded && isSignedIn && Boolean(sessionId),
    activeSessionPresent: Boolean(sessionId),
  }, userId ?? null);
  setNativeHealthAccountScope(userId ?? null);
  setNotificationAccountScope(userId ?? null);
  useEffect(() => {
    resetAccountLifecycle(isLoaded && isSignedIn && sessionId ? userId ?? null : null);
    if (!isLoaded || !isSignedIn || !sessionId || !userId) return;
    void refreshOnAppState(AppState.currentState);
    void syncMorningBankUpdateDevice().catch(() => undefined);
    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response?.notification.request.content.data.category === 'morning_bank_update') router.replace('/today');
    });
    const notificationResponse = Notifications.addNotificationResponseReceivedListener((response) => {
      if (response.notification.request.content.data.category === 'morning_bank_update') router.push('/today');
    });
    const subscription = AppState.addEventListener('change', (state) => {
      void refreshOnAppState(state);
      if (state === 'active') {
        void syncMorningBankUpdateDevice().catch(() => undefined);
      }
    });
    return () => { subscription.remove(); notificationResponse.remove(); };
  }, [isLoaded, isSignedIn, router, sessionId, userId]);
  return <AppStack key={userId ?? 'signed-out'} />;
}

export default function RootLayout() {
  const appEnvironment = process.env.EXPO_PUBLIC_APP_ENV ?? 'local';
  const authMode = process.env.EXPO_PUBLIC_AUTH_MODE ?? 'development';
  const apiUrl = process.env.EXPO_PUBLIC_API_URL;
  if (appEnvironment !== 'local' && (authMode !== 'clerk' || !apiUrl?.startsWith('https://'))) {
    throw new Error('Beta and production builds require Clerk authentication and an HTTPS API URL.');
  }
  if (authMode !== 'clerk') {
    setNativeHealthAccountScope('local-development');
    setNotificationAccountScope('local-development');
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
