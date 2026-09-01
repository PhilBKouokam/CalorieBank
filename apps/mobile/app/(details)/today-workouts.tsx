import type { TodayResponse } from '@caloriebank/schemas';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, radii, spacing, typography } from '@/constants/caloriebank-theme';
import { fetchToday } from '@/lib/api/client';
import { getConsumerSourceName } from '@/lib/providers/presentation';
import { formatWorkoutCalorieLines } from '@/lib/today/presentation';

export default function TodayWorkoutsScreen() {
  const [today, setToday] = useState<TodayResponse | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetchToday(Intl.DateTimeFormat().resolvedOptions().timeZone)
      .then(setToday)
      .catch(() => setFailed(true));
  }, []);

  return (
    <SafeAreaView edges={['bottom']} style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Logged workouts</Text>
        <Text style={styles.description}>
          {today?.workouts.source ? `Workouts imported from ${getConsumerSourceName(today.workouts.source)} today.` : 'Workouts imported from your selected activity source today.'}
        </Text>
        <View style={styles.card}>
          {!today && !failed ? <ActivityIndicator color={colors.primary} /> : null}
          {failed ? <Text style={styles.description}>Workouts could not load. Try again later.</Text> : null}
          {today && today.workouts.items.length === 0 ? (
            <Text style={styles.description}>No workouts logged today</Text>
          ) : null}
          {today?.workouts.items.map((workout) => (
            <View key={workout.id} style={styles.row}>
              <Text style={styles.workoutName}>
                {workout.displayName} · {workout.durationMinutes} min
              </Text>
              {workout.totalEnergyBurned !== null ? (() => {
                const lines = formatWorkoutCalorieLines({
                  totalSteps: workout.totalSteps,
                  rawCalories: workout.totalEnergyBurned,
                  adjustmentFactor: today.burned.adjustmentFactor,
                });
                return (
                  <>
                    <Text style={styles.description}>{lines.reported}</Text>
                    <Text style={styles.description}>{lines.estimated}</Text>
                  </>
                );
              })() : null}
              <Text style={styles.source}>
                Imported from {getConsumerSourceName(workout.source)}
              </Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  container: { gap: spacing.md, padding: spacing.lg, paddingBottom: spacing.xxl },
  title: { color: colors.text, fontSize: typography.heading, fontWeight: '800' },
  description: { color: colors.textMuted, fontSize: typography.body, lineHeight: 23 },
  card: {
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    padding: spacing.lg,
  },
  row: { gap: spacing.xs, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, paddingVertical: spacing.sm },
  workoutName: { color: colors.text, fontSize: typography.body, fontWeight: '700' },
  source: { color: colors.textMuted, fontSize: typography.caption },
});
