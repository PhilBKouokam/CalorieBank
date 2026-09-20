import { healthConnectQualificationEnabled } from '@/lib/health-connect/capabilities';
import { useClerk } from '@clerk/expo';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { useRef, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, radii, spacing, typography } from '@/constants/caloriebank-theme';
import { SettingsRow } from '@/components/caloriebank/SettingsRow';
import { PrivacyPolicyRow } from '@/components/caloriebank/PrivacyPolicyRow';
import { detachMorningBankUpdateDevice } from '@/lib/notifications/morning-bank-update';

const settingsRows: { href: Href; icon: keyof typeof Ionicons.glyphMap; label: string; detail: string }[] = [
  { href: '/goal-settings', icon: 'flag-outline', label: 'Fitness Goal', detail: 'Set your weight goal and daily adjustment.' },
  { href: '/daily-bank-target' as Href, icon: 'calendar-outline', label: 'Daily Bank Target', detail: 'Choose how much you’d like to bank each day.' },
  { href: '/integrations', icon: 'heart-outline', label: 'Health Connections', detail: 'Manage the apps that share your calorie data.' },
  { href: '/customize-today', icon: 'options-outline', label: 'Customize Today', detail: 'Choose what appears on Today.' },
  { href: '/morning-bank-update' as Href, icon: 'notifications-outline', label: 'Morning Bank Update', detail: 'Choose whether to receive your morning bank update.' },
];

export default function SettingsScreen() {
  const { signOut } = useClerk();
  const router = useRouter();
  const usesClerk = (process.env.EXPO_PUBLIC_AUTH_MODE ?? 'development') === 'clerk';
  const [signOutError, setSignOutError] = useState(false);
  const signingOutRef = useRef(false);
  const [signingOut, setSigningOut] = useState(false);
  async function signOutSafely() {
    if (signingOutRef.current) return;
    signingOutRef.current = true;
    setSigningOut(true);
    setSignOutError(false);
    try {
      await detachMorningBankUpdateDevice();
      await signOut();
      router.replace('/sign-in');
    } catch { setSignOutError(true); }
    finally { signingOutRef.current = false; setSigningOut(false); }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Settings</Text>
        <Text style={styles.sectionLabel}>CalorieBank</Text>
        <View style={styles.group}>
          {settingsRows.map((row, index) => (
            <SettingsRow key={row.label} title={row.label} description={row.detail} icon={row.icon}
              onPress={() => router.push(row.href)} separator={index < settingsRows.length - 1} />
          ))}
        </View>

        {Platform.OS === 'android' && healthConnectQualificationEnabled() ? <SettingsRow title="Health Connect qualification" description="Read-only Android data checks." icon="construct-outline" onPress={() => router.push('/health-diagnostics')} /> : null}

        {usesClerk ? <>
          <Text style={styles.sectionLabel}>Account</Text>
          <View style={styles.group}>
            <SettingsRow title={signingOut ? 'Signing out…' : 'Sign Out'} disabled={signingOut} icon="log-out-outline" navigation={false} separator onPress={() => void signOutSafely()} />
            <SettingsRow title="Delete Account" disabled={signingOut} icon="trash-outline" destructive onPress={() => router.push('/delete-account')} />
          </View>
          {signOutError ? <Text accessibilityLiveRegion="assertive" style={styles.signOutError}>We couldn’t finish signing you out. Please try again.</Text> : null}
        </> : null}
        {Platform.OS === 'android' ? <View style={styles.group}><PrivacyPolicyRow /></View> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  container: { gap: spacing.md, padding: spacing.lg, paddingBottom: spacing.xxl },
  title: { color: colors.text, fontSize: typography.title, fontWeight: '800' },
  sectionLabel: { color: colors.textMuted, fontSize: typography.caption, fontWeight: '800', marginTop: spacing.sm, textTransform: 'uppercase' },
  group: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.md, borderWidth: 1, overflow: 'hidden' },
  signOutError: { color: colors.danger, fontSize: typography.caption, lineHeight: 18 },
});
