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

import { colors, radii, spacing, typography } from '@/constants/caloriebank-theme';
import {
  connectAppleHealth,
  disconnectAppleHealthLocally,
  getAppleHealthConnectionStatus,
  syncAppleHealthToday,
  type AppleHealthConnectionStatus,
} from '@/lib/healthkit/healthkit-connection';

type ScreenState = AppleHealthConnectionStatus | 'loading' | 'requesting' | 'syncing' | 'error';

function statusLabel(status: ScreenState) {
  if (status === 'connected' || status === 'syncing') return 'Connected';
  if (status === 'unavailable') return 'Unavailable on this device';
  if (status === 'needs_attention') return 'Needs attention';
  if (status === 'error') return 'Could not refresh';
  if (status === 'requesting') return 'Requesting access';
  if (status === 'loading') return 'Checking';
  return 'Not connected';
}

export default function IntegrationsScreen() {
  const [status, setStatus] = useState<ScreenState>('loading');
  const [message, setMessage] = useState(
    'Connect to read active energy, basal energy, dietary energy, steps, and workouts from Apple Health.',
  );

  const refreshStatus = useCallback(async () => {
    setStatus('loading');
    setStatus(await getAppleHealthConnectionStatus());
  }, []);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  async function connect() {
    setStatus('requesting');
    setMessage('Choose which Health categories CalorieBank may read.');
    try {
      const nextStatus = await connectAppleHealth();
      setStatus(nextStatus);
      setMessage(
        nextStatus === 'connected'
          ? 'Apple Health is connected. Today will refresh when you return to it.'
          : 'Apple Health could not be connected on this device.',
      );
    } catch {
      setStatus('needs_attention');
      setMessage('Health data is unavailable. Review access in iOS Settings or the Health app.');
    }
  }

  async function refresh() {
    setStatus('syncing');
    try {
      const result = await syncAppleHealthToday({ force: true, trigger: 'manual_refresh' });
      setStatus(result.connectionStatus);
      setMessage(
        result.expenditureFound || result.intakeFound || result.stepsFound || result.workoutCount > 0
          ? 'Today’s Apple Health activity context was refreshed.'
          : 'No matching Health data was found today. Read access may also be limited.',
      );
    } catch {
      setStatus('error');
      setMessage('Today’s Health data could not be refreshed. Try again.');
    }
  }

  async function disconnect() {
    await disconnectAppleHealthLocally();
    setStatus('not_connected');
    setMessage(
      'Automatic refresh is off in CalorieBank. Manage or revoke Health access in iOS Settings or the Health app.',
    );
  }

  const isBusy = status === 'loading' || status === 'requesting' || status === 'syncing';
  const isConnected = status === 'connected' || status === 'syncing';

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
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  container: { padding: spacing.lg, paddingBottom: spacing.xxl },
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
