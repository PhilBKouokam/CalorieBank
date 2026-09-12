import { notificationSettingsName } from '@/lib/native-health/copy';
import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, radii, spacing, typography } from '@/constants/caloriebank-theme';
import {
  disableMorningBankUpdate,
  enableMorningBankUpdate,
  openNotificationSettings,
  loadMorningBankUpdateSettings,
  type MorningUpdatePermission,
} from '@/lib/notifications/morning-bank-update';
import { confirmPreferenceChange, createSettingsRequestGate } from '@/lib/notifications/notification-operations';

export default function MorningBankUpdateSettingsScreen() {
  const [enabled, setEnabled] = useState(false);
  const [permission, setPermission] = useState<MorningUpdatePermission>('not_determined');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const gate = useRef(createSettingsRequestGate());

  const refresh = useCallback(async () => {
    const request = gate.current.begin();
    if (!request) return;
    setLoading(true);
    try {
      const result = await loadMorningBankUpdateSettings();
      if (!request.isCurrent()) return;
      setPermission(result.permission);
      setEnabled(result.settings.enabled && result.permission === 'granted' && result.settings.deviceActive);
      setMessage(null);
    } catch { if (request.isCurrent()) setMessage("We couldn't refresh your notification settings. Try again."); }
    finally { if (request.isCurrent()) setLoading(false); request.finish(); }
  }, []);

  useFocusEffect(useCallback(() => {
    void refresh();
    const currentGate = gate.current;
    return () => currentGate.invalidate();
  }, [refresh]));

  async function change(next: boolean) {
    const request = gate.current.begin();
    if (!request) return;
    setLoading(true);
    setMessage(null);
    try {
      // A timed-out write may still have succeeded. Read truth without registering again.
      const result = await confirmPreferenceChange(next,
        () => next ? enableMorningBankUpdate() : disableMorningBankUpdate().then((settings) => ({ permission, settings })),
        loadMorningBankUpdateSettings,
        (state) => state.settings.enabled && state.permission === 'granted' && state.settings.deviceActive);
      if (!request.isCurrent()) return;
      setPermission(result.state.permission);
      setEnabled(result.state.settings.enabled && result.state.permission === 'granted' && result.state.settings.deviceActive);
      setMessage(result.message ?? (next && result.state.permission !== 'granted' ? `Turn on notifications for CalorieBank in ${notificationSettingsName}.` : null));
    } catch { if (request.isCurrent()) setMessage("We couldn't confirm your change. Try again."); }
    finally { if (request.isCurrent()) setLoading(false); request.finish(); }
  }

  return <SafeAreaView style={styles.safeArea} edges={['bottom']}>
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.row}>
        <View style={styles.copy}>
          <Text style={styles.title}>Morning Bank Update</Text>
          <Text style={styles.detail}>Wake up knowing how your bank updated overnight.</Text>
        </View>
        <Switch disabled={loading} accessibilityLabel="Morning Bank Update" accessibilityState={{ busy: loading, disabled: loading }} onValueChange={(value) => void change(value)} value={enabled} />
      </View>
      {loading ? <ActivityIndicator accessibilityLabel="Updating notification settings" color={colors.primary} /> : <Text style={styles.status}>{permission === 'denied' ? `Notifications are off in ${notificationSettingsName}` : enabled ? 'On' : 'Off'}</Text>}
      {permission === 'denied' ? <Pressable accessibilityRole="button" onPress={() => void openNotificationSettings().then((opened) => { if (!opened) setMessage('Open Settings on your iPhone, then choose CalorieBank and Notifications.'); })} style={styles.button}><Text style={styles.buttonText}>Open Notification Settings</Text></Pressable> : null}
      {message ? <Text accessibilityLiveRegion="polite" style={styles.message}>{message}</Text> : null}
      {message && !loading ? <Pressable accessibilityRole="button" onPress={() => void refresh()} style={styles.button}><Text style={styles.buttonText}>Try again</Text></Pressable> : null}
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  container: { gap: spacing.md, padding: spacing.lg },
  row: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.md, borderWidth: 1, flexDirection: 'row', gap: spacing.md, padding: spacing.lg },
  copy: { flex: 1, gap: spacing.xs }, title: { color: colors.text, fontSize: typography.subheading, fontWeight: '800' },
  detail: { color: colors.textMuted, fontSize: typography.body, lineHeight: 23 }, status: { color: colors.text, fontSize: typography.body, fontWeight: '700' },
  button: { alignItems: 'center', borderColor: colors.primary, borderRadius: radii.sm, borderWidth: 1, minHeight: 50, justifyContent: 'center', padding: spacing.md },
  buttonText: { color: colors.primaryDark, fontSize: typography.body, fontWeight: '800' }, message: { color: colors.textMuted, fontSize: typography.body },
});
