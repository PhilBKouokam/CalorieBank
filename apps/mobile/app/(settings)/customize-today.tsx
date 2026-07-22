import type {
  DashboardPreferencesPatch,
  DashboardPreferencesResponse,
} from '@caloriebank/schemas';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, radii, spacing, typography } from '@/constants/caloriebank-theme';
import { fetchDashboardPreferences, updateDashboardPreferences } from '@/lib/api/client';

const optionalCards: {
  key: keyof DashboardPreferencesPatch;
  label: string;
}[] = [
  { key: 'showLatestFinalizedContribution', label: 'Latest finalized contribution' },
  { key: 'showTodaySoFar', label: 'Today so far' },
  { key: 'showPlannedTreat', label: 'Planned Treat' },
  { key: 'showSteps', label: 'Steps today' },
  { key: 'showWorkouts', label: 'Logged workouts' },
  { key: 'showCurrentGoal', label: 'Current goal' },
];

export default function CustomizeTodayScreen() {
  const [preferences, setPreferences] = useState<DashboardPreferencesResponse | null>(null);
  const [savingKey, setSavingKey] = useState<keyof DashboardPreferencesPatch | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchDashboardPreferences()
      .then(setPreferences)
      .catch(() => setMessage('Today preferences could not load. Try again later.'));
  }, []);

  async function toggle(key: keyof DashboardPreferencesPatch, value: boolean) {
    if (!preferences || savingKey) return;
    const previous = preferences;
    setPreferences({ ...preferences, [key]: value });
    setSavingKey(key);
    setMessage(null);
    try {
      setPreferences(await updateDashboardPreferences({ [key]: value }));
    } catch {
      setPreferences(previous);
      setMessage('That preference could not be saved. Try again.');
    } finally {
      setSavingKey(null);
    }
  }

  return (
    <SafeAreaView edges={['bottom']} style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Customize Today</Text>
        <Text style={styles.description}>
          Choose which supporting cards appear. Available Bank always stays first.
        </Text>

        <View style={styles.list}>
          <View style={styles.row}>
            <View style={styles.labelGroup}>
              <Text style={styles.label}>Available Bank</Text>
              <Text style={styles.detail}>Always visible</Text>
            </View>
            <Switch accessibilityLabel="Show Available Bank" disabled value />
          </View>

          {preferences ? (
            optionalCards.map((card) => (
              <View key={card.key} style={styles.row}>
                <Text style={styles.label}>{card.label}</Text>
                <Switch
                  accessibilityLabel={`Show ${card.label}`}
                  disabled={savingKey !== null}
                  onValueChange={(value) => void toggle(card.key, value)}
                  trackColor={{ false: colors.border, true: colors.primary }}
                  value={preferences[card.key]}
                />
              </View>
            ))
          ) : !message ? (
            <ActivityIndicator color={colors.primary} />
          ) : null}
        </View>
        {message ? <Text style={styles.error}>{message}</Text> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  container: { gap: spacing.md, padding: spacing.lg, paddingBottom: spacing.xxl },
  title: { color: colors.text, fontSize: typography.heading, fontWeight: '800' },
  description: { color: colors.textMuted, fontSize: typography.body, lineHeight: 23 },
  list: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
  },
  row: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  labelGroup: { flex: 1, gap: spacing.xs },
  label: { flex: 1, color: colors.text, fontSize: typography.body, fontWeight: '600' },
  detail: { color: colors.textMuted, fontSize: typography.caption },
  error: { color: colors.danger, fontSize: typography.body },
});
