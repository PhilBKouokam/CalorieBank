import { useClerk } from '@clerk/expo';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, radii, spacing, typography } from '@/constants/caloriebank-theme';
import { deleteCalorieBankAccount } from '@/lib/api/client';
import { prepareMorningBankUpdateAccountDeletion } from '@/lib/notifications/morning-bank-update';

export default function DeleteAccountScreen() {
  const [confirmation, setConfirmation] = useState('');
  const [status, setStatus] = useState<'idle' | 'deleting' | 'failed'>('idle');
  const { signOut } = useClerk();
  const router = useRouter();

  const remove = async () => {
    if (confirmation !== 'DELETE' || status === 'deleting') return;
    setStatus('deleting');
    try {
      await prepareMorningBankUpdateAccountDeletion();
      await deleteCalorieBankAccount();
      await signOut().catch(() => undefined);
      router.replace('/sign-in');
    } catch {
      setStatus('failed');
    }
  };

  return <SafeAreaView edges={['bottom']} style={styles.safeArea}>
    <ScrollView automaticallyAdjustKeyboardInsets keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" contentContainerStyle={styles.container}>
      <Text style={styles.title}>Delete your CalorieBank account?</Text>
      <Text style={styles.body}>This permanently removes your CalorieBank history, imported health data, goals, preferences, and connected services. You can manage Apple Health permissions separately in iOS.</Text>
      <Text style={styles.label}>Type DELETE to confirm</Text>
      <TextInput accessibilityLabel="Type DELETE to confirm" autoCapitalize="characters" autoCorrect={false} editable={status !== 'deleting'} onChangeText={setConfirmation} style={styles.input} value={confirmation} />
      {status === 'failed' ? <Text accessibilityRole="alert" style={styles.error}>Deletion hasn’t finished yet. Please try again. If it already started, we’ll keep working to finish it safely.</Text> : null}
      <Pressable accessibilityRole="button" disabled={confirmation !== 'DELETE' || status === 'deleting'} onPress={() => void remove()} style={({ pressed }) => [styles.button, (confirmation !== 'DELETE' || status === 'deleting') && styles.disabled, pressed && styles.pressed]}>
        {status === 'deleting' ? <ActivityIndicator color={colors.surface} /> : <Text style={styles.buttonText}>Delete Account</Text>}
      </Pressable>
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  container: { gap: spacing.md, padding: spacing.lg },
  title: { color: colors.text, fontSize: typography.title, fontWeight: '800' },
  body: { color: colors.textMuted, fontSize: typography.body, lineHeight: 24 },
  label: { color: colors.text, fontSize: typography.body, fontWeight: '700' },
  input: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.sm, borderWidth: 1, color: colors.text, fontSize: typography.body, minHeight: 52, paddingHorizontal: spacing.md },
  error: { color: colors.danger, fontSize: typography.caption, lineHeight: 19 },
  button: { alignItems: 'center', backgroundColor: colors.danger, borderRadius: radii.sm, justifyContent: 'center', minHeight: 52 },
  buttonText: { color: colors.surface, fontSize: typography.body, fontWeight: '800' },
  disabled: { opacity: 0.45 }, pressed: { opacity: 0.75 },
});
