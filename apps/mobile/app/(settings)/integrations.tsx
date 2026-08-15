import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';

import { colors, radii, spacing, typography } from '@/constants/caloriebank-theme';
import {
  connectAppleHealth,
  disconnectAppleHealthLocally,
  getAppleHealthDiagnostics,
  getAppleHealthConnectionStatus,
  syncAppleHealthToday,
} from '@/lib/healthkit/healthkit-connection';
import {
  deriveAppleHealthPresentationState,
  type AppleHealthPresentationState,
} from '@/lib/healthkit/healthkit-diagnostics';
import {
  disconnectFitbit,
  fetchProviderSelection,
  saveProviderSelection,
  startFitbitAuthorization,
  syncFitbit,
} from '@/lib/api/client';
import type { ProviderSelectionResponse } from '@caloriebank/schemas';

type ScreenState = AppleHealthPresentationState | 'loading' | 'requesting' | 'syncing';

function statusLabel(status: ScreenState) {
  if (status === 'connected' || status === 'syncing') return 'Connected';
  if (status === 'connected_partial') return 'Connected · Some data unavailable';
  if (status === 'sync_error') return 'Connected · Sync issue';
  if (status === 'unavailable') return 'Unavailable on this device';
  if (status === 'requesting') return 'Requesting access';
  if (status === 'loading') return 'Checking';
  return 'Not connected';
}

export default function IntegrationsScreen() {
  const [status, setStatus] = useState<ScreenState>('loading');
  const [message, setMessage] = useState(
    'Connect to read active energy, basal energy, dietary energy, steps, and workouts from Apple Health.',
  );
  const [providers, setProviders] = useState<ProviderSelectionResponse | null>(null);
  const [fitbitBusy, setFitbitBusy] = useState(false);
  const [fitbitMessage, setFitbitMessage] = useState('Connect Fitbit to use its daily calorie-burn total.');

  const refreshStatus = useCallback(async () => {
    setStatus('loading');
    const [connectionStatus, diagnostics, providerState] = await Promise.all([
      getAppleHealthConnectionStatus(),
      getAppleHealthDiagnostics(),
      fetchProviderSelection().catch(() => null),
    ]);
    setStatus(deriveAppleHealthPresentationState(connectionStatus, diagnostics));
    setProviders(providerState);
  }, []);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  async function connect() {
    setStatus('requesting');
    setMessage('Choose which Health categories CalorieBank may read.');
    try {
      const nextStatus = await connectAppleHealth();
      const diagnostics = await getAppleHealthDiagnostics();
      setStatus(deriveAppleHealthPresentationState(nextStatus, diagnostics));
      setMessage(
        nextStatus === 'connected'
          ? 'Apple Health is connected. Available categories refresh independently.'
          : 'Apple Health could not be connected on this device.',
      );
    } catch {
      const connectionStatus = await getAppleHealthConnectionStatus();
      setStatus(connectionStatus === 'connected' ? 'sync_error' : connectionStatus);
      setMessage(
        connectionStatus === 'connected'
          ? 'Apple Health remains connected, but the latest refresh did not complete. Try again.'
          : 'Apple Health could not complete the connection request. Try again.',
      );
    }
  }

  async function refresh() {
    setStatus('syncing');
    try {
      const result = await syncAppleHealthToday({ force: true, trigger: 'manual_refresh' });
      setStatus(
        result.connectionStatus !== 'connected'
          ? result.connectionStatus
          : result.syncStatus === 'failure'
            ? 'sync_error'
            : result.syncStatus === 'partial'
              ? 'connected_partial'
              : 'connected',
      );
      setMessage(
        result.expenditureFound || result.intakeFound || result.stepsFound || result.workoutCount > 0
          ? result.syncStatus === 'partial'
            ? 'Apple Health refreshed. Some categories have no data or could not be read.'
            : 'Today’s Apple Health activity context was refreshed.'
          : 'Apple Health is connected, but no matching Health data was found today.',
      );
    } catch {
      setStatus('sync_error');
      setMessage('Apple Health remains connected, but today’s data could not refresh. Try again.');
    }
  }

  async function disconnect() {
    await disconnectAppleHealthLocally();
    setStatus('not_connected');
    setMessage(
      'Automatic refresh is off in CalorieBank. Manage or revoke Health access in iOS Settings or the Health app.',
    );
  }

  async function connectFitbit() {
    setFitbitBusy(true);
    setFitbitMessage('Opening Fitbit authorization.');
    try {
      const { authorizationUrl } = await startFitbitAuthorization();
      const result = await WebBrowser.openAuthSessionAsync(authorizationUrl, 'caloriebank://integrations');
      if (result.type !== 'success') {
        setFitbitMessage('Fitbit connection was not completed.');
        return;
      }
      await syncFitbit(Intl.DateTimeFormat().resolvedOptions().timeZone, true);
      setFitbitMessage('Fitbit is connected. Select it below to use it for calorie burn.');
      await refreshStatus();
    } catch {
      setFitbitMessage('Fitbit could not connect. Check the server configuration and try again.');
    } finally {
      setFitbitBusy(false);
    }
  }

  async function selectFitbit() {
    setFitbitBusy(true);
    try {
      setProviders(await saveProviderSelection({
        authoritativeExpenditureProvider: 'fitbit', authoritativeIntakeProvider: 'apple_health',
      }));
      await syncFitbit(Intl.DateTimeFormat().resolvedOptions().timeZone, true);
      setFitbitMessage('Fitbit is used for calorie burn.');
    } catch {
      setFitbitMessage('Fitbit could not be selected. Refresh the connection and try again.');
    } finally { setFitbitBusy(false); }
  }

  async function removeFitbit() {
    setFitbitBusy(true);
    try {
      await disconnectFitbit();
      setFitbitMessage('Fitbit was disconnected. Apple Health is the calorie-burn fallback.');
      await refreshStatus();
    } catch { setFitbitMessage('Fitbit could not be disconnected.'); }
    finally { setFitbitBusy(false); }
  }

  const isBusy = status === 'loading' || status === 'requesting' || status === 'syncing';
  const isConnected =
    status === 'connected' ||
    status === 'connected_partial' ||
    status === 'sync_error' ||
    status === 'syncing';

  return (
    <SafeAreaView edges={['bottom']} style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.card}>
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.title}>Apple Health</Text>
              <Text style={styles.status}>{statusLabel(status)}</Text>
            </View>
            {isBusy ? <ActivityIndicator color={colors.primary} /> : null}
          </View>

          <Text style={styles.body}>{message}</Text>
          <Text style={styles.body}>
            CalorieBank requests read access only. Apple does not reveal whether individual read categories were denied,
            so an empty result may also mean there is no data today.
          </Text>

          <View style={styles.actions}>
            {!isConnected ? (
              <Pressable
                accessibilityRole="button"
                disabled={isBusy}
                onPress={() => void connect()}
                style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
              >
                <Text style={styles.primaryButtonText}>Connect Apple Health</Text>
              </Pressable>
            ) : (
              <Pressable
                accessibilityRole="button"
                disabled={isBusy}
                onPress={() => void refresh()}
                style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
              >
                <Text style={styles.primaryButtonText}>Refresh</Text>
              </Pressable>
            )}

            <Pressable
              accessibilityRole="button"
              onPress={() => void Linking.openSettings()}
              style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
            >
              <Text style={styles.secondaryButtonText}>Open iOS Settings</Text>
            </Pressable>

            {__DEV__ ? (
              <Link href="/health-diagnostics" asChild>
                <Pressable
                  accessibilityRole="button"
                  style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
                >
                  <Text style={styles.secondaryButtonText}>Diagnostics</Text>
                </Pressable>
              </Link>
            ) : null}

            {isConnected ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => void disconnect()}
                style={({ pressed }) => [styles.textButton, pressed && styles.pressed]}
              >
                <Text style={styles.textButtonText}>Disconnect in CalorieBank</Text>
              </Pressable>
            ) : null}
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.title}>Fitbit</Text>
              <Text style={styles.status}>
                {providers?.connectedProviders.find((provider) => provider.provider === 'fitbit')?.status === 'connected'
                  ? providers.expenditure.authoritativeProvider === 'fitbit'
                    ? 'Connected · Used for calorie burn'
                    : 'Connected · Available'
                  : 'Not connected'}
              </Text>
            </View>
            {fitbitBusy ? <ActivityIndicator color={colors.primary} /> : null}
          </View>
          <Text style={styles.body}>{fitbitMessage}</Text>
          <Text style={styles.body}>Apple Health remains the source for Dietary Energy, steps, and workouts.</Text>
          <View style={styles.actions}>
            {providers?.connectedProviders.find((provider) => provider.provider === 'fitbit')?.status === 'connected' ? (
              <>
                {providers.expenditure.authoritativeProvider !== 'fitbit' ? (
                  <Pressable accessibilityRole="button" disabled={fitbitBusy} onPress={() => void selectFitbit()} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
                    <Text style={styles.primaryButtonText}>Use Fitbit for calorie burn</Text>
                  </Pressable>
                ) : (
                  <Pressable accessibilityRole="button" disabled={fitbitBusy} onPress={() => void syncFitbit(Intl.DateTimeFormat().resolvedOptions().timeZone, true).then(refreshStatus)} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
                    <Text style={styles.primaryButtonText}>Refresh Fitbit</Text>
                  </Pressable>
                )}
                <Pressable accessibilityRole="button" disabled={fitbitBusy} onPress={() => void removeFitbit()} style={({ pressed }) => [styles.textButton, pressed && styles.pressed]}>
                  <Text style={styles.textButtonText}>Disconnect Fitbit</Text>
                </Pressable>
              </>
            ) : (
              <Pressable accessibilityRole="button" disabled={fitbitBusy} onPress={() => void connectFitbit()} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
                <Text style={styles.primaryButtonText}>Connect Fitbit</Text>
              </Pressable>
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  container: { gap: spacing.lg, padding: spacing.lg, paddingBottom: spacing.xxl },
  card: {
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    padding: spacing.lg,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { color: colors.text, fontSize: typography.heading, fontWeight: '800' },
  status: { color: colors.primaryDark, fontSize: typography.body, fontWeight: '700', marginTop: spacing.xs },
  body: { color: colors.textMuted, fontSize: typography.body, lineHeight: 24 },
  actions: { gap: spacing.sm, marginTop: spacing.sm },
  primaryButton: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
  },
  primaryButtonText: { color: colors.surface, fontSize: typography.body, fontWeight: '700' },
  secondaryButton: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
  },
  secondaryButtonText: { color: colors.text, fontSize: typography.body, fontWeight: '700' },
  textButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  textButtonText: { color: colors.textMuted, fontSize: typography.body, fontWeight: '700' },
  pressed: { opacity: 0.72 },
});
