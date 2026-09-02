import { useCallback, useState } from 'react';
import { Redirect, useFocusEffect } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, radii, spacing, typography } from '@/constants/caloriebank-theme';
import {
  checkApiReachability,
  fetchGoogleHealthBurnParityDiagnostic,
  type ApiNetworkDiagnostics,
} from '@/lib/api/client';
import type { GoogleHealthBurnParityDiagnosticResponse } from '@caloriebank/schemas';
import { getAppleHealthDiagnostics } from '@/lib/healthkit/healthkit-connection';
import type {
  HealthKitDiagnosticCategory,
  HealthKitDiagnosticsSnapshot,
} from '@/lib/healthkit/healthkit-diagnostics';
import {
  runDietaryEnergySourceDiagnostic,
  type DietaryEnergySourceDiagnosticError,
  type DietaryEnergySourceDiagnosticReport,
} from '@/lib/healthkit/dietary-energy-source-diagnostic';

const categories: { key: HealthKitDiagnosticCategory; label: string }[] = [
  { key: 'active_energy', label: 'Active Energy' },
  { key: 'resting_energy', label: 'Resting Energy' },
  { key: 'dietary_energy', label: 'Dietary Energy' },
  { key: 'steps', label: 'Steps' },
  { key: 'workouts', label: 'Workouts' },
];

function shiftDate(localDate: string, days: number) {
  const date = new Date(`${localDate}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function completedLocalDate(daysAgo = 1) {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts();
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return shiftDate(`${value.year}-${value.month}-${value.day}`, -daysAgo);
}

function querySummary(
  diagnostics: HealthKitDiagnosticsSnapshot,
  category: HealthKitDiagnosticCategory,
  localDate = diagnostics.rollingDates[0]?.localDate,
) {
  const query = diagnostics.queries.find(
    (item) => item.category === category && item.localDate === localDate,
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

function uploadSummary(
  diagnostics: HealthKitDiagnosticsSnapshot,
  category: HealthKitDiagnosticCategory,
  localDate: string,
) {
  const uploadCategory = category === 'active_energy' || category === 'resting_energy'
    ? 'expenditure'
    : category === 'dietary_energy'
      ? 'intake'
      : category;
  const upload = diagnostics.upload.items?.find(
    (item) => item.category === uploadCategory && item.localDate === localDate,
  );
  if (!upload) return 'not queued';
  return upload.errorType ? `${upload.status} · ${upload.errorType}` : upload.status;
}

function categoryPresent(
  diagnostics: HealthKitDiagnosticsSnapshot,
  category: HealthKitDiagnosticCategory,
) {
  return diagnostics.queries.some((query) =>
    query.category === category
    && query.status === 'success'
    && (query.normalizedAggregate !== null || (query.sampleCount ?? 0) > 0));
}

function completeBurnPresent(diagnostics: HealthKitDiagnosticsSnapshot) {
  return diagnostics.rollingDates.some(({ localDate }) =>
    diagnostics.queries.some((query) =>
      query.localDate === localDate && query.category === 'active_energy' && query.status === 'success')
    && diagnostics.queries.some((query) =>
      query.localDate === localDate && query.category === 'resting_energy' && query.status === 'success'));
}

export default function HealthDiagnosticsScreen() {
  const [diagnostics, setDiagnostics] = useState<HealthKitDiagnosticsSnapshot | null>(null);
  const [apiDiagnostics, setApiDiagnostics] = useState<ApiNetworkDiagnostics | null>(null);
  const [sourceDiagnostic, setSourceDiagnostic] =
    useState<DietaryEnergySourceDiagnosticReport | null>(null);
  const [sourceDiagnosticError, setSourceDiagnosticError] = useState<string | null>(null);
  const [sourceDiagnosticRunning, setSourceDiagnosticRunning] = useState(false);
  const [burnDate, setBurnDate] = useState(() => completedLocalDate());
  const [burnDiagnostic, setBurnDiagnostic] =
    useState<GoogleHealthBurnParityDiagnosticResponse | null>(null);
  const [burnDiagnosticError, setBurnDiagnosticError] = useState<string | null>(null);
  const [burnDiagnosticRunning, setBurnDiagnosticRunning] = useState(false);

  useFocusEffect(
    useCallback(() => {
      void getAppleHealthDiagnostics().then(setDiagnostics);
      void checkApiReachability().then(setApiDiagnostics);
    }, []),
  );

  if (!__DEV__) return <Redirect href="/integrations" />;

  async function runSourceDiagnostic() {
    if (sourceDiagnosticRunning) return;
    setSourceDiagnosticRunning(true);
    setSourceDiagnosticError(null);
    try {
      setSourceDiagnostic(await runDietaryEnergySourceDiagnostic());
    } catch (error) {
      setSourceDiagnosticError(
        error instanceof Error ? error.message : 'Dietary Energy source diagnostic failed.',
      );
    } finally {
      setSourceDiagnosticRunning(false);
    }
  }

  async function runBurnDiagnostic() {
    if (burnDiagnosticRunning) return;
    setBurnDiagnosticRunning(true);
    setBurnDiagnosticError(null);
    try {
      setBurnDiagnostic(await fetchGoogleHealthBurnParityDiagnostic(
        burnDate,
        Intl.DateTimeFormat().resolvedOptions().timeZone,
      ));
    } catch (error) {
      setBurnDiagnostic(null);
      setBurnDiagnosticError(error instanceof Error ? error.message : 'Burn parity diagnostic failed.');
    } finally {
      setBurnDiagnosticRunning(false);
    }
  }

  return (
    <SafeAreaView edges={['bottom']} style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.intro}>
          Internal metadata for the latest Apple Health synchronization. No individual
          HealthKit samples are shown.
        </Text>

        <View style={styles.card}>
          <DiagnosticRow label="API base URL" value={apiDiagnostics?.baseUrl ?? 'Not configured'} />
          <DiagnosticRow
            label="API reachability"
            value={apiDiagnostics?.reachability.replaceAll('_', ' ') ?? 'Checking'}
          />
          <DiagnosticRow
            label="Last API request"
            value={apiDiagnostics?.lastRequestStatus ?? 'Checking'}
          />
          <DiagnosticRow
            label="Last API endpoint"
            value={apiDiagnostics?.lastRequestPath ?? 'Not checked'}
          />
          <DiagnosticRow
            label="Last API HTTP status"
            value={apiDiagnostics?.lastHttpStatus === null || !apiDiagnostics
              ? 'None'
              : String(apiDiagnostics.lastHttpStatus)}
          />
          <DiagnosticRow
            label="Last API request time"
            value={apiDiagnostics?.lastRequestAt ?? 'Not checked'}
          />
        </View>

        {__DEV__ ? <View style={styles.card}>
          <Text style={styles.sectionTitle}>Google Health Burn Parity</Text>
          <Text style={styles.intro}>
            Read-only comparison of the live total-calories rollup with CalorieBank storage.
          </Text>
          <View style={styles.dateControls}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Previous completed date"
              onPress={() => { setBurnDate((value) => shiftDate(value, -1)); setBurnDiagnostic(null); }}
              style={({ pressed }) => [styles.dateButton, pressed && styles.pressed]}
            >
              <Text style={styles.dateButtonText}>Previous</Text>
            </Pressable>
            <Text selectable style={styles.dateValue}>{burnDate}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Next completed date"
              disabled={burnDate >= completedLocalDate()}
              onPress={() => { setBurnDate((value) => shiftDate(value, 1)); setBurnDiagnostic(null); }}
              style={({ pressed }) => [
                styles.dateButton,
                pressed && styles.pressed,
                burnDate >= completedLocalDate() && styles.disabled,
              ]}
            >
              <Text style={styles.dateButtonText}>Next</Text>
            </Pressable>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Run Google Health burn parity diagnostic"
            disabled={burnDiagnosticRunning}
            onPress={() => void runBurnDiagnostic()}
            style={({ pressed }) => [
              styles.diagnosticButton,
              pressed && styles.pressed,
              burnDiagnosticRunning && styles.disabled,
            ]}
          >
            {burnDiagnosticRunning ? <ActivityIndicator color={colors.surface} /> : null}
            <Text style={styles.diagnosticButtonText}>
              {burnDiagnosticRunning ? 'Reading Google Health' : 'Run burn diagnostic'}
            </Text>
          </Pressable>
          {burnDiagnosticError ? <DiagnosticRow label="Diagnostic error" value={burnDiagnosticError} /> : null}
          {burnDiagnostic ? <BurnParityRows diagnostic={burnDiagnostic} /> : null}
        </View> : null}

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
          <DiagnosticRow label="Sync running" value={diagnostics?.syncRunning ? 'Yes' : 'No'} />
          <DiagnosticRow label="Last sync trigger" value={diagnostics?.lastSyncTrigger ?? 'Not run'} />
          <DiagnosticRow label="Last sync started" value={diagnostics?.lastSyncStartedAt ?? 'Not run'} />
          <DiagnosticRow label="Last sync completed" value={diagnostics?.lastSyncCompletedAt ?? 'Not run'} />
          <DiagnosticRow
            label="Overall sync result"
            value={diagnostics?.overallSyncResult.replaceAll('_', ' ') ?? 'Not run'}
          />
          <DiagnosticRow label="Current-account refresh completed" value={diagnostics?.lastSyncCompletedAt ? 'Yes' : 'No'} />
          <DiagnosticRow label="Dietary Energy present" value={diagnostics && categoryPresent(diagnostics, 'dietary_energy') ? 'Yes' : 'No'} />
          <DiagnosticRow label="Steps present" value={diagnostics && categoryPresent(diagnostics, 'steps') ? 'Yes' : 'No'} />
          <DiagnosticRow label="Workouts present" value={diagnostics && categoryPresent(diagnostics, 'workouts') ? 'Yes' : 'No'} />
          <DiagnosticRow label="Active Energy present" value={diagnostics && categoryPresent(diagnostics, 'active_energy') ? 'Yes' : 'No'} />
          <DiagnosticRow label="Basal Energy present" value={diagnostics && categoryPresent(diagnostics, 'resting_energy') ? 'Yes' : 'No'} />
          <DiagnosticRow label="Complete total burn" value={diagnostics && completeBurnPresent(diagnostics) ? 'Available' : 'Unavailable'} />
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
          <DiagnosticRow
            label="Outbox queued uploads"
            value={String(diagnostics?.outbox.queuedCount ?? 0)}
          />
          <DiagnosticRow
            label="Oldest queued date"
            value={diagnostics?.outbox.oldestQueuedDate ?? 'None'}
          />
          <DiagnosticRow
            label="Last outbox retry"
            value={diagnostics?.outbox.lastRetryStatus ?? 'not run'}
          />
        </View>

        {diagnostics?.rollingDates.map((date) => (
          <View key={date.localDate} style={styles.card}>
            <Text style={styles.sectionTitle}>{date.localDate}</Text>
            {categories.map((category) => (
              <DiagnosticRow
                key={`${date.localDate}:${category.key}`}
                label={category.label}
                value={`${querySummary(diagnostics, category.key, date.localDate)} · Upload ${uploadSummary(diagnostics, category.key, date.localDate)}`}
              />
            ))}
          </View>
        ))}

        {diagnostics?.error ? (
          <View style={styles.card}>
            <DiagnosticRow label="Safe error code" value={diagnostics.error.code ?? 'None'} />
            <DiagnosticRow label="Safe error message" value={diagnostics.error.message} />
          </View>
        ) : null}

        {__DEV__ ? <View style={styles.card}>
          <Text style={styles.sectionTitle}>Dietary Energy sources</Text>
          <Text style={styles.intro}>
            Read-only comparison for the three most recent completed local dates. Results remain
            on this screen and are not uploaded.
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Run Dietary Energy source diagnostic"
            disabled={sourceDiagnosticRunning}
            onPress={() => void runSourceDiagnostic()}
            style={({ pressed }) => [
              styles.diagnosticButton,
              pressed && styles.pressed,
              sourceDiagnosticRunning && styles.disabled,
            ]}
          >
            {sourceDiagnosticRunning ? <ActivityIndicator color={colors.surface} /> : null}
            <Text style={styles.diagnosticButtonText}>
              {sourceDiagnosticRunning ? 'Reading HealthKit' : 'Run source diagnostic'}
            </Text>
          </Pressable>
          {sourceDiagnosticError ? (
            <DiagnosticRow label="Diagnostic error" value={sourceDiagnosticError} />
          ) : null}
        </View> : null}

        {__DEV__ ? sourceDiagnostic?.dates.map((date) => (
          <View key={`source:${date.localDate}`} style={styles.card}>
            <Text style={styles.sectionTitle}>{date.localDate}</Text>
            <DiagnosticRow label="All-source total" value={formatKcal(date.allSourceTotalKcal)} />
            <DiagnosticRow label="Grouped-source total" value={formatKcal(date.groupedSourceTotalKcal)} />
            <DiagnosticRow
              label="All-source matches grouped"
              value={formatAgreement(date.allSourceMatchesGroupedTotal)}
            />
            <DiagnosticRow
              label="querySources writers"
              value={date.querySourcesCount === null ? 'Unavailable' : String(date.querySourcesCount)}
            />
            <QueryError label="All-source statistics error" error={date.allSourceStatisticsError} />
            <QueryError label="Raw samples error" error={date.rawSamplesError} />
            <QueryError label="Separate-by-source error" error={date.separateBySourceError} />
            <QueryError label="querySources error" error={date.querySourcesError} />
            {date.writers.length === 0 ? (
              <Text style={styles.value}>No Dietary Energy writers found.</Text>
            ) : date.writers.map((writer) => (
              <View key={`${date.localDate}:${writer.bundleIdentifier}`} style={styles.sourceGroup}>
                <Text selectable style={styles.sourceName}>{writer.sourceName}</Text>
                <DiagnosticRow label="Bundle identifier" value={writer.bundleIdentifier} />
                <DiagnosticRow label="Samples" value={String(writer.sampleCount)} />
                <DiagnosticRow label="Duplicate UUID count" value={String(writer.duplicateUuidCount)} />
                <DiagnosticRow label="Raw sum" value={formatKcal(writer.rawSumKcal)} />
                <DiagnosticRow
                  label="Separate-by-source sum"
                  value={formatKcal(writer.separateBySourceSumKcal)}
                />
                <DiagnosticRow
                  label="Filtered-statistics sum"
                  value={formatKcal(writer.filteredStatisticsSumKcal)}
                />
                <DiagnosticRow
                  label="Raw matches separate"
                  value={formatAgreement(writer.rawMatchesSeparateBySource)}
                />
                <DiagnosticRow
                  label="Raw matches filtered"
                  value={formatAgreement(writer.rawMatchesFilteredStatistics)}
                />
                <DiagnosticRow
                  label="Separate matches filtered"
                  value={formatAgreement(writer.separateBySourceMatchesFilteredStatistics)}
                />
                <QueryError label="Filtered-statistics error" error={writer.filteredStatisticsError} />
              </View>
            ))}
          </View>
        )) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function formatKcal(value: number | null) {
  return value === null ? 'Unavailable' : `${value.toLocaleString()} kcal`;
}

function formatAgreement(value: boolean | null) {
  if (value === null) return 'Not comparable';
  return value ? 'Yes' : 'No';
}

function BurnParityRows({
  diagnostic,
}: {
  diagnostic: GoogleHealthBurnParityDiagnosticResponse;
}) {
  const stored = diagnostic.persistedAggregate;
  const snapshot = diagnostic.latestSnapshot;
  return (
    <View style={styles.sourceGroup}>
      <DiagnosticRow label="Live Google Health API" value={formatExactKcal(diagnostic.liveApiKcal)} />
      <DiagnosticRow label="↓ Normalized" value={formatKcal(diagnostic.normalizedKcal)} />
      <DiagnosticRow label="↓ Persisted aggregate" value={formatKcal(stored?.rawKcal ?? null)} />
      <DiagnosticRow label="↓ Latest bank snapshot" value={formatKcal(snapshot?.rawKcal ?? null)} />
      <DiagnosticRow label="Adjusted / credited burn" value={formatKcal(snapshot?.adjustedKcal ?? stored?.adjustedKcal ?? null)} />
      <DiagnosticRow label="Status" value={diagnostic.lifecycle?.status ?? 'No snapshot yet'} />
      <DiagnosticRow label="Locks" value={diagnostic.lifecycle?.locksAt ?? 'Unavailable'} />
      <DiagnosticRow label="Provider fetched" value={stored?.providerFetchedAt ?? 'No persisted aggregate'} />
      <DiagnosticRow label="Aggregate updated" value={stored?.aggregateUpdatedAt ?? 'No persisted aggregate'} />
      <DiagnosticRow label="Latest calculation" value={snapshot?.calculatedAt ?? 'No snapshot yet'} />
      <DiagnosticRow label="API → normalized" value={formatMatch(diagnostic.parity.apiToNormalized)} />
      <DiagnosticRow label="Normalized → stored" value={formatMatch(diagnostic.parity.normalizedToStored)} />
      <DiagnosticRow label="Stored → snapshot" value={formatMatch(diagnostic.parity.storedToSnapshot)} />
    </View>
  );
}

function formatExactKcal(value: number | null) {
  return value === null ? 'No data for this date' : `${value} kcal`;
}

function formatMatch(value: boolean | null) {
  return value === null ? 'Not comparable' : value ? 'Match' : 'Mismatch';
}

function QueryError({
  label,
  error,
}: {
  label: string;
  error: DietaryEnergySourceDiagnosticError | null;
}) {
  if (!error) return null;
  return (
    <DiagnosticRow
      label={label}
      value={`${error.code ? `${error.code} · ` : ''}${error.message}`}
    />
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
  sectionTitle: { color: colors.text, fontSize: typography.body, fontWeight: '700' },
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
  sourceGroup: {
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
  },
  sourceName: { color: colors.text, fontSize: typography.body, fontWeight: '700' },
  dateControls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  dateButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.sm },
  dateButtonText: { color: colors.accent, fontSize: typography.body, fontWeight: '700' },
  dateValue: { color: colors.text, fontSize: typography.body, fontWeight: '700' },
  diagnosticButton: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: radii.md,
    backgroundColor: colors.text,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  diagnosticButtonText: { color: colors.surface, fontSize: typography.body, fontWeight: '700' },
  pressed: { opacity: 0.8 },
  disabled: { opacity: 0.65 },
});
