import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import type { ManualIntakeState } from '@caloriebank/schemas';
import { usualEstimateSourceLabel } from '@/lib/providers/presentation';
import { fetchManualIntake } from '@/lib/api/client';
import { colors, radii, spacing, typography } from '@/constants/caloriebank-theme';

export function ManualSourceChoice({ disabled = false, onOpen }: { disabled?: boolean; onOpen?: () => void }) {
  const router = useRouter(), [state, setState] = useState<ManualIntakeState | null>(null);
  useFocusEffect(useCallback(() => {
    let current = true;
    void fetchManualIntake().then((result) => { if (current) setState(result); }).catch(() => {});
    return () => { current = false; };
  }, []));
  if (!state?.selected && !state?.selectionEnabled) return null;
  const openEditor = () => {
    onOpen?.(); router.push({ pathname: '/manual-estimate', params: { mode: state.selected ? 'usual' : 'select' } });
  };
  return <View style={styles.card}>
    {state.selected ? <View style={styles.action}>
      <Text style={styles.title}>{usualEstimateSourceLabel(state.estimate?.usualCalories)}</Text>
      <Text style={styles.detail}>Usual daily estimate</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Edit estimate" accessibilityHint="Change your usual daily calorie estimate" accessibilityState={{ disabled }} disabled={disabled} onPress={openEditor} style={({ pressed }) => [styles.editButton, pressed && styles.pressed, disabled && styles.disabled]}>
        <Text style={styles.editButtonText}>Edit estimate</Text>
      </Pressable>
    </View> : <Pressable accessibilityRole="button" accessibilityLabel="I don’t track calories" accessibilityState={{ disabled }} disabled={disabled} style={styles.action} onPress={openEditor}>
      <Text style={styles.title}>I don’t track calories</Text>
      <Text style={styles.detail}>Tell CalorieBank about how many calories you usually eat in a day. You can adjust today’s number anytime.</Text>
    </Pressable>}
  </View>;
}
const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: radii.md },
  action: { padding: spacing.md, minHeight: 48, gap: spacing.sm },
  title: { color: colors.text, fontSize: typography.subheading, fontWeight: '700' },
  editButton: { alignItems: 'center', justifyContent: 'center', minHeight: 48, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderWidth: 1, borderColor: colors.primary, borderRadius: radii.md, marginTop: spacing.sm },
  editButtonText: { color: colors.primary, fontSize: typography.body, fontWeight: '700', textAlign: 'center' },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.5 },
  detail: { color: colors.textMuted, fontSize: typography.body },
});
