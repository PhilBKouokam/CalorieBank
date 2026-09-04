import { useClerk } from '@clerk/expo';
import { Ionicons } from '@expo/vector-icons';
import { Link, useRouter, type Href } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, radii, spacing, typography } from '@/constants/caloriebank-theme';

const settingsRows: { href: Href; icon: keyof typeof Ionicons.glyphMap; label: string; detail: string }[] = [
  { href: '/goal-settings', icon: 'flag-outline', label: 'Goal', detail: 'Choose how completed days contribute to your bank.' },
  { href: '/integrations', icon: 'heart-outline', label: 'Health Connections', detail: 'Manage where burned and eaten calories come from.' },
  { href: '/customize-today', icon: 'options-outline', label: 'Customize Today', detail: 'Choose which supporting cards appear on Today.' },
];

export default function SettingsScreen() {
  const { signOut } = useClerk();
  const router = useRouter();
  const usesClerk = (process.env.EXPO_PUBLIC_AUTH_MODE ?? 'development') === 'clerk';

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Settings</Text>
        <Text style={styles.sectionLabel}>CalorieBank</Text>
        <View style={styles.group}>
          {settingsRows.map((row) => (
            <Link href={row.href} asChild key={row.label}>
              <Pressable accessibilityHint={row.detail} accessibilityRole="button" style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
                <Ionicons color={colors.primaryDark} name={row.icon} size={23} />
                <View style={styles.rowCopy}><Text style={styles.rowLabel}>{row.label}</Text><Text style={styles.rowDetail}>{row.detail}</Text></View>
                <Ionicons color={colors.textMuted} name="chevron-forward" size={20} />
              </Pressable>
            </Link>
          ))}
        </View>

        {usesClerk ? <>
          <Text style={styles.sectionLabel}>Account</Text>
          <Pressable accessibilityLabel="Sign out of CalorieBank" accessibilityRole="button" onPress={() => void signOut().then(() => router.replace('/sign-in'))} style={({ pressed }) => [styles.signOut, pressed && styles.pressed]}>
            <Ionicons color={colors.text} name="log-out-outline" size={22} />
            <Text style={styles.signOutText}>Sign Out</Text>
          </Pressable>
          <Link href="/delete-account" asChild>
            <Pressable accessibilityRole="button" style={({ pressed }) => [styles.deleteAccount, pressed && styles.pressed]}>
              <Ionicons color={colors.danger} name="trash-outline" size={22} />
              <Text style={styles.deleteAccountText}>Delete Account</Text>
            </Pressable>
          </Link>
        </> : null}
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
  row: { alignItems: 'center', borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: spacing.md, minHeight: 72, padding: spacing.md },
  rowCopy: { flex: 1, gap: spacing.xs }, rowLabel: { color: colors.text, fontSize: typography.body, fontWeight: '700' },
  rowDetail: { color: colors.textMuted, fontSize: typography.caption, lineHeight: 18 },
  signOut: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.md, borderWidth: 1, flexDirection: 'row', gap: spacing.sm, minHeight: 52, paddingHorizontal: spacing.md },
  signOutText: { color: colors.text, fontSize: typography.body, fontWeight: '700' }, pressed: { opacity: 0.7 },
  deleteAccount: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm, minHeight: 52, paddingHorizontal: spacing.md },
  deleteAccountText: { color: colors.danger, fontSize: typography.body, fontWeight: '700' },
});
