import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { ManualIntakeState } from '@caloriebank/schemas';
import { fetchManualIntake } from '@/lib/api/client';
import { ManualEstimateEditor } from '@/components/caloriebank/ManualEstimateEditor';
import { colors, spacing } from '@/constants/caloriebank-theme';

export default function ManualEstimateScreen() {
  const router = useRouter(), params = useLocalSearchParams<{ mode?: string }>();
  const mode = params.mode === 'today' ? 'today' : params.mode === 'usual' ? 'usual' : 'select';
  const [state, setState] = useState<ManualIntakeState | null>(null), [error, setError] = useState('');
  useEffect(() => {
    let current = true;
    void fetchManualIntake().then((value) => {
      if (!current) return;
      if ((mode === 'select' && !value.selectionEnabled && !value.selected) || (mode !== 'select' && !value.selected)) {
        setError('Your calorie source changed. Go back and try again.'); return;
      }
      setState(value);
    }).catch(() => { if (current) setError('Couldn’t load your estimate. Go back and try again.'); });
    return () => { current = false; };
  }, [mode]);
  return <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
    {state ? <ManualEstimateEditor state={state} mode={mode} onSaved={() => router.back()} onCancel={() => router.back()} />
      : <View style={{ padding: spacing.lg, gap: spacing.md }}><Text>{error || 'Loading your estimate…'}</Text><Pressable accessibilityRole="button" onPress={() => router.back()} style={{ padding: spacing.md, minHeight: 48 }}><Text>Cancel</Text></Pressable></View>}
  </SafeAreaView>;
}
