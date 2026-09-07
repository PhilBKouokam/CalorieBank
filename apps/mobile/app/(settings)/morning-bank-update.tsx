import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, radii, spacing, typography } from '@/constants/caloriebank-theme';
import {
  disableMorningBankUpdate,
  enableMorningBankUpdate,
  openNotificationSettings,
  syncMorningBankUpdateDevice,
  type MorningUpdatePermission,
} from '@/lib/notifications/morning-bank-update';

export default function MorningBankUpdateSettingsScreen() {
  const [enabled, setEnabled] = useState(false);
  const [permission, setPermission] = useState<MorningUpdatePermission>('not_determined');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const result = await syncMorningBankUpdateDevice();
      setPermission(result.permission);
      setEnabled(result.settings.enabled && result.permission === 'granted' && result.settings.deviceActive);
      setMessage(null);
    } catch { setMessage("We couldn't load your notification settings. Try again."); }
    finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));

  async function change(next: boolean) {
    setLoading(true);
    setMessage(null);
    try {
      if (next) {
        const result = await enableMorningBankUpdate();
        setPermission(result.permission);
        setEnabled(result.settings.enabled && result.permission === 'granted');
        if (result.permission !== 'granted') setMessage('Turn on notifications for CalorieBank in iOS Settings.');
      } else {
        await disableMorningBankUpdate();
        setEnabled(false);
      }
    } catch { setMessage("We couldn't save your change. Try again."); }
    finally { setLoading(false); }
  }

  return <SafeAreaView style={styles.safeArea} edges={['bottom']}>
    <View style={styles.container}>
      <View style={styles.row}>
        <View style={styles.copy}>
          <Text style={styles.title}>Morning Bank Update</Text>
          <Text style={styles.detail}>Wake up knowing how your bank updated overnight.</Text>
        </View>
        {loading ? <ActivityIndicator color={colors.primary} /> : <Switch accessibilityLabel="Morning Bank Update" onValueChange={(value) => void change(value)} value={enabled} />}
      </View>
      <Text style={styles.status}>{permission === 'denied' ? 'Notifications are off in iOS Settings' : enabled ? 'On' : 'Off'}</Text>
      {permission === 'denied' ? <Pressable accessibilityRole="button" onPress={() => void openNotificationSettings()} style={styles.button}><Text style={styles.buttonText}>Open iOS Settings</Text></Pressable> : null}
      {message ? <Text accessibilityLiveRegion="polite" style={styles.message}>{message}</Text> : null}
    </View>
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
