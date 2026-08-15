import { useCallback, useState } from 'react';
import { Redirect, useFocusEffect } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, radii, spacing, typography } from '@/constants/caloriebank-theme';
import { getAppleHealthDiagnostics } from '@/lib/healthkit/healthkit-connection';
import type {
  HealthKitDiagnosticCategory,
  HealthKitDiagnosticsSnapshot,
} from '@/lib/healthkit/healthkit-diagnostics';

const categories: { key: HealthKitDiagnosticCategory; label: string }[] = [
  { key: 'active_energy', label: 'Active Energy' },
  { key: 'resting_energy', label: 'Resting Energy' },
  { key: 'dietary_energy', label: 'Dietary Energy' },
  { key: 'steps', label: 'Steps' },
  { key: 'workouts', label: 'Workouts' },
];

function querySummary(diagnostics: HealthKitDiagnosticsSnapshot, category: HealthKitDiagnosticCategory) {
  const latestDate = diagnostics.rollingDates[0]?.localDate;
  const query = diagnostics.queries.find(
    (item) => item.category === category && item.localDate === latestDate,
  );
  if (!query) return 'Not attempted';
  if (query.status === 'error') {
    return `Error${query.error?.code ? ` · ${query.error.code}` : ''}`;
  }
  if (query.status === 'empty') return 'Query succeeded · Empty';
  if (query.sampleCount !== null) return `Query succeeded · ${query.sampleCount} found`;
  if (query.normalizedAggregate !== null) {
    return `Query succeeded · Aggregate ${query.normalizedAggregate.toLocaleString()}`;
  }
  return 'Query succeeded';
}

export default function HealthDiagnosticsScreen() {
  const [diagnostics, setDiagnostics] = useState<HealthKitDiagnosticsSnapshot | null>(null);

  useFocusEffect(
    useCallback(() => {
      void getAppleHealthDiagnostics().then(setDiagnostics);
    }, []),
  );

  if (!__DEV__) return <Redirect href="/integrations" />;

  return (
    <SafeAreaView edges={['bottom']} style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.intro}>
          Development-only metadata for the latest Apple Health synchronization. No individual
          HealthKit samples are shown.
        </Text>

        <View style={styles.card}>
          <DiagnosticRow
            label="HealthKit available"
            value={diagnostics?.healthKitAvailable === null || !diagnostics
              ? 'Unknown'
              : diagnostics.healthKitAvailable
                ? 'Yes'
                : 'No'}
          />
          <DiagnosticRow
            label="Authorization request"
            value={diagnostics?.authorizationRequest.replaceAll('_', ' ') ?? 'Not completed'}
          />
          <DiagnosticRow label="Last sync" value={diagnostics?.lastSyncAt ?? 'Not run'} />
          <DiagnosticRow
            label="Overall sync result"
            value={diagnostics?.overallSyncResult.replaceAll('_', ' ') ?? 'Not run'}
          />
        </View>

        <View style={styles.card}>
          {categories.map((category) => (
            <DiagnosticRow
              key={category.key}
              label={category.label}
              value={diagnostics ? querySummary(diagnostics, category.key) : 'Not attempted'}
            />
          ))}
        </View>

        <View style={styles.card}>
          <DiagnosticRow label="API upload" value={diagnostics?.upload.status ?? 'Not attempted'} />
          <DiagnosticRow
            label="Uploads completed"
            value={diagnostics
              ? `${diagnostics.upload.completedCount}/${diagnostics.upload.attemptedCount}`
              : '0/0'}
          />
          <DiagnosticRow
            label="Rolling dates attempted"
            value={diagnostics?.rollingDates.map((date) => date.localDate).join(', ') || 'None'}
          />
        </View>

        {diagnostics?.error ? (
          <View style={styles.card}>
            <DiagnosticRow label="Safe error code" value={diagnostics.error.code ?? 'None'} />
            <DiagnosticRow label="Safe error message" value={diagnostics.error.message} />
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function DiagnosticRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text selectable style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  container: { gap: spacing.md, padding: spacing.lg, paddingBottom: spacing.xxl },
  intro: { color: colors.textMuted, fontSize: typography.body, lineHeight: 24 },
  card: {
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    padding: spacing.lg,
  },
  row: { gap: spacing.xs },
  label: { color: colors.textMuted, fontSize: typography.caption, fontWeight: '700' },
  value: { color: colors.text, fontSize: typography.body, lineHeight: 22 },
});
