import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '@/components/caloriebank/ScaleAwareText';
import { PrivacyPolicyRow } from '@/components/caloriebank/PrivacyPolicyRow';
import { colors, radii, spacing, typography } from '@/constants/caloriebank-theme';

/** Shown in the normal connection flow before an authorization request exists. */
export function FitbitConnectionDisclosure({ onContinue, onCancel }: {
  onContinue: () => Promise<void>;
  onCancel: () => void;
}) {
  const continuing = useRef(false);
  const [busy, setBusy] = useState(false);
  async function continueConnection() {
    if (continuing.current) return;
    continuing.current = true;
    setBusy(true);
    try { await onContinue(); }
    finally { continuing.current = false; setBusy(false); }
  }
  return <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
    <ScrollView contentContainerStyle={styles.content}>
      <Text accessibilityRole="header" style={styles.title}>Connect Fitbit</Text>
      <Text style={styles.body}>Connect Fitbit through Google Health. CalorieBank reads your calorie burn, steps and workouts to calculate your bank and history and show activity and planning estimates.</Text>
      <Text style={styles.body}>This information is stored in your CalorieBank account on our servers. Our service providers process it to run CalorieBank.</Text>
      <Text style={styles.body}>If you enable Morning Bank Update, notification services receive your bank-update content.</Text>
      <Text style={styles.body}>We do not sell your health information or use it for advertising.</Text>
      <PrivacyPolicyRow />
      <View style={styles.actions}>
        <Pressable accessibilityRole="button" accessibilityState={{ disabled: busy, busy }} disabled={busy} onPress={() => void continueConnection()} style={[styles.button, styles.primary]}>
          {busy ? <ActivityIndicator accessibilityLabel="Connecting Fitbit" color={colors.surface} /> : <Text style={styles.primaryText}>Continue to Google</Text>}
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityState={{ disabled: busy }} disabled={busy} onPress={onCancel} style={styles.button}><Text style={styles.cancelText}>Cancel</Text></Pressable>
      </View>
    </ScrollView>
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1, gap: spacing.md, padding: spacing.lg, paddingBottom: spacing.xxl },
  title: { color: colors.text, fontSize: typography.title, fontWeight: '800' },
  body: { color: colors.text, fontSize: typography.body, lineHeight: 24 },
  actions: { gap: spacing.sm },
  button: { alignItems: 'center', justifyContent: 'center', minHeight: 52, padding: spacing.md, borderRadius: radii.sm },
  primary: { backgroundColor: colors.primary },
  primaryText: { color: colors.surface, fontSize: typography.body, fontWeight: '800', textAlign: 'center' },
  cancelText: { color: colors.primaryDark, fontSize: typography.body, fontWeight: '700' },
});
