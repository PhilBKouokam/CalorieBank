import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import type { ManualIntakeState } from '@caloriebank/schemas';
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
  return <View style={styles.card}>
    <Pressable accessibilityRole="button" accessibilityLabel={state.selected ? 'Edit usual daily estimate' : 'I don’t track calories'} disabled={disabled} style={styles.action} onPress={() => {
      onOpen?.(); router.push({ pathname: '/manual-estimate', params: { mode: state.selected ? 'usual' : 'select' } });
    }}>
      <Text style={styles.title}>{state.selected ? 'CalorieBank estimate' : 'I don’t track calories'}</Text>
      <Text style={styles.detail}>{state.selected
        ? `Usual daily estimate: ${state.estimate?.usualCalories.toLocaleString() ?? '—'} kcal. Edit estimate.`
        : 'Tell CalorieBank about how many calories you usually eat in a day. You can adjust today’s number anytime.'}</Text>
    </Pressable>
  </View>;
}
const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: radii.md },
  action: { padding: spacing.md, minHeight: 48, gap: spacing.sm },
  title: { color: colors.text, fontSize: typography.subheading, fontWeight: '700' },
  detail: { color: colors.textMuted, fontSize: typography.body },
});
