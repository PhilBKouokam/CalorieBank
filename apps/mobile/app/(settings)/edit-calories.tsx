import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Text } from '@/components/caloriebank/ScaleAwareText';
import { FrostedScreen as SafeAreaView } from '@/components/caloriebank/FrostedSurface';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import type { IntakeAdjustmentState } from '@caloriebank/schemas';
import { fetchIntakeAdjustment, fetchHistoricalIntakeAdjustment, ApiHttpError } from '@/lib/api/client';
import { IntakeAdjustmentEditor } from '@/components/caloriebank/IntakeAdjustmentEditor';
import { colors, spacing } from '@/constants/caloriebank-theme';
export default function EditCaloriesScreen() {
  const router = useRouter();
  const { localDate } = useLocalSearchParams<{ localDate?: string | string[] }>();
  const historical = localDate !== undefined;
  const focusOwner = useRef(0);
  const routeOwner = useRef(0);
  const [focusGeneration, setFocusGeneration] = useState(0);
  useFocusEffect(useCallback(() => {
    const owner = ++focusOwner.current;
    setFocusGeneration(owner);
    return () => { focusOwner.current++; };
  }, []));
  const [state, setState] = useState<IntakeAdjustmentState | null>(null), [error, setError] = useState('');
  const routeGeneration = routeOwner.current;
  // Acknowledged state belongs to the dated route even while it is blurred.
  // Navigation separately belongs only to the focus that initiated the save.
  const returnAfterSave = (savedState: IntakeAdjustmentState) => {
    if (routeOwner.current !== routeGeneration || savedState.localDate !== state?.localDate) return;
    setState(savedState);
    if (focusGeneration > 0 && focusOwner.current === focusGeneration) router.back();
  };
  useEffect(() => {
    let current = true;
    const owner = ++routeOwner.current;
    setState(null); setError('');
    if (historical && (typeof localDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(localDate))) {
      setError('Choose a valid day from History.'); return;
    }
    const request = historical ? fetchHistoricalIntakeAdjustment(localDate as string) : fetchIntakeAdjustment();
    void request.then(value => {
      if (!current) return;
      if (historical && value.localDate !== localDate) { setError('The selected day changed. Go back and try again.'); return; }
      setState(value);
    }).catch(failure => { if (current) setError(failure instanceof ApiHttpError && failure.kind === 'conflict'
      ? 'This day can no longer be edited. Return to History and refresh.' : 'Couldn’t load your calories. Go back and try again.'); });
    return () => { current = false; routeOwner.current = owner + 1; };
  }, [historical, localDate]);
  return <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
    {state ? <IntakeAdjustmentEditor key={`${state.localDate}:${state.revision}`} historical={historical} state={state} onSaved={returnAfterSave} onCancel={() => router.back()} />
      : <View style={{ padding: spacing.lg, gap: spacing.md }}><Text>{error || 'Loading your calories…'}</Text><Pressable accessibilityRole="button" onPress={() => router.back()} style={{ padding: spacing.md, minHeight: 48 }}><Text>Cancel</Text></Pressable></View>}
  </SafeAreaView>;
}
