import { compactGlassCard } from '@/constants/card-surface';
import { FrostedView, FrostedScreen as SafeAreaView } from '@/components/caloriebank/FrostedSurface';
import { healthConnectQualificationEnabled } from '@/lib/health-connect/capabilities';
import { useClerk, useUser } from '@clerk/expo';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { useRef, useState } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '@/components/caloriebank/ScaleAwareText';

import { colors, spacing, typography } from '@/constants/caloriebank-theme';
import { SettingsRow } from '@/components/caloriebank/SettingsRow';
import { PrivacyPolicyRow } from '@/components/caloriebank/PrivacyPolicyRow';
import { detachMorningBankUpdateDevice } from '@/lib/notifications/morning-bank-update';

const settingsRows: { href: Href; icon: keyof typeof Ionicons.glyphMap; label: string; detail: string }[] = [
  { href: '/goal-settings', icon: 'flag-outline', label: 'Fitness Goal', detail: 'Set your weight goal and daily adjustment.' },
  { href: '/daily-bank-target' as Href, icon: 'calendar-outline', label: 'Daily Bank Target', detail: 'Choose how much you’d like to bank each day.' },
  { href: '/planned-treat', icon: 'gift-outline', label: 'Banking Goal', detail: 'Manage the goal you’re saving for.' },
  { href: '/integrations', icon: 'heart-outline', label: 'Health Connections', detail: 'Manage the apps that share your calorie data.' },
  { href: '/customize-today', icon: 'options-outline', label: 'Customize Today', detail: 'Choose what appears on Today.' },
  { href: '/morning-bank-update' as Href, icon: 'notifications-outline', label: 'Morning Bank Update', detail: 'Choose whether to receive your morning bank update.' },
];

function AccountSettings() {
  const { signOut } = useClerk();
  const { isLoaded, isSignedIn, user } = useUser();
  const email = isLoaded && isSignedIn ? user.primaryEmailAddress?.emailAddress : null;
  const emailDescription = !isLoaded ? 'Loading account…'
    : !isSignedIn ? 'Not signed in' : email || 'Email unavailable';
  const router = useRouter();
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
    <>
      <Text style={styles.sectionLabel}>Account</Text>
      <FrostedView style={styles.group}>
        <View style={styles.accountInfo}>
          <Text style={styles.accountLabel}>Email address</Text>
          <Text selectable style={styles.accountEmail}>{emailDescription}</Text>
        </View>
        <SettingsRow title={signingOut ? 'Signing out…' : 'Sign Out'} disabled={signingOut} icon="log-out-outline" navigation={false} separator onPress={() => void signOutSafely()} />
        <SettingsRow title="Delete Account" disabled={signingOut} icon="trash-outline" destructive onPress={() => router.push('/delete-account')} />
      </FrostedView>
      {signOutError ? <Text accessibilityLiveRegion="assertive" style={styles.signOutError}>We couldn’t finish signing you out. Please try again.</Text> : null}
    </>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const usesClerk = (process.env.EXPO_PUBLIC_AUTH_MODE ?? 'development') === 'clerk';

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Settings</Text>
        <Text style={styles.sectionLabel}>CalorieBank</Text>
        <FrostedView style={styles.group}>
          {settingsRows.map((row, index) => (
            <SettingsRow key={row.label} title={row.label} description={row.detail} icon={row.icon}
              onPress={() => router.push(row.href)} separator={index < settingsRows.length - 1} />
          ))}
        </FrostedView>

        {Platform.OS === 'android' && healthConnectQualificationEnabled() ? <SettingsRow title="Health Connect qualification" description="Read-only Android data checks." icon="construct-outline" onPress={() => router.push('/health-diagnostics')} /> : null}

        {usesClerk ? <AccountSettings /> : null}
        <FrostedView style={styles.group}><PrivacyPolicyRow /></FrostedView>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
safeArea: { flex: 1, backgroundColor: 'transparent' },
container: { gap: 20, padding: 16, paddingTop: 20, paddingBottom: spacing.xxl },
title: { color: colors.text, fontSize: typography.title, fontWeight: '800' },
sectionLabel: { color: '#53615D', fontSize: typography.caption, fontWeight: '700', marginTop: 4, marginLeft: 4 },
group: { ...compactGlassCard, padding: 0, overflow: 'hidden' },
signOutError: { color: colors.danger, fontSize: typography.caption, lineHeight: 18 },
section: { gap: 10 },
introduction: { color: colors.textMuted, fontSize: typography.body, lineHeight: 23, marginTop: -12 },
accountInfo: { gap: spacing.xs, padding: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
accountLabel: { color: colors.textMuted, fontSize: typography.caption },
accountEmail: { color: colors.text, fontSize: typography.body, fontWeight: '600', flexShrink: 1 }
});
