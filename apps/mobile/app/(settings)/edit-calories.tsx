import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Text } from '@/components/caloriebank/ScaleAwareText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import type { IntakeAdjustmentState } from '@caloriebank/schemas';
import { fetchIntakeAdjustment } from '@/lib/api/client';
import { IntakeAdjustmentEditor } from '@/components/caloriebank/IntakeAdjustmentEditor';
import { colors, spacing } from '@/constants/caloriebank-theme';
export default function EditCaloriesScreen() {
  const router = useRouter();
  const [state, setState] = useState<IntakeAdjustmentState | null>(null), [error, setError] = useState('');
  useEffect(() => {
    let current = true;
    void fetchIntakeAdjustment().then(value => { if (current) setState(value); })
      .catch(() => { if (current) setError('Couldn’t load your calories. Go back and try again.'); });
    return () => { current = false; };
  }, []);
  return <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
    {state ? <IntakeAdjustmentEditor state={state} onSaved={() => router.back()} onCancel={() => router.back()} />
      : <View style={{ padding: spacing.lg, gap: spacing.md }}><Text>{error || 'Loading your calories…'}</Text><Pressable accessibilityRole="button" onPress={() => router.back()} style={{ padding: spacing.md, minHeight: 48 }}><Text>Cancel</Text></Pressable></View>}
  </SafeAreaView>;
}
