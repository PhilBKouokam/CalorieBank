import { useCallback, useState } from 'react';
import { AppState, Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { Redirect, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { nativeHealthQualification, nativeNutritionQualification } from '../lib/native-health/index.android';
import { foodOriginName } from '../lib/health-connect/food-origins';
import type { NativeAccess, QualificationReport } from '../lib/native-health/evidence';
import { colors, spacing } from '../constants/caloriebank-theme';

export default function AndroidHealthDiagnostics() {
  if (!__DEV__ && process.env.EXPO_PUBLIC_APP_ENV !== 'beta') return <Redirect href="/integrations" />;
  return <QualificationDiagnostics />;
}

function QualificationDiagnostics() {
  const [nutritionOnly, setNutritionOnly] = useState(false);
  const qualification = nutritionOnly ? nativeNutritionQualification : nativeHealthQualification;
  const [access, setAccess] = useState<NativeAccess | null>(null);
  const [report, setReport] = useState<QualificationReport | null>(null);
  const [origin, setOrigin] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  useFocusEffect(useCallback(() => {
    let active = true;
    void qualification.access().then((value) => { if (active) setAccess(value); });
    const subscription = AppState.addEventListener('change', (state) => {
      qualification.cancel(); setReport(null);
      if (state === 'active') void qualification.access().then((value) => { if (active) setAccess(value); });
    });
    return () => { active = false; subscription.remove(); qualification.cancel(); };
  }, [qualification]));
  async function run(action: 'permissions' | 'read' | 'settings') {
    if (busy) return;
    setBusy(true); setReport(null); setMessage('');
    try {
      if (action === 'permissions') setAccess(await qualification.access(true));
      else if (action === 'settings') { if (!await qualification.openSettings()) setMessage('Health Connect settings could not open.'); }
      else { const result = await qualification.inspect(origin); setAccess(result.access); setReport(result); }
    } catch { setMessage('The qualification check could not finish. Try again.'); }
    finally { setBusy(false); }
  }
  return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.content}>
    <Text style={styles.title}>Health Connect qualification</Text>
    <Text>Read-only test tool. This tool does not upload data or change your bank.</Text>
    <Pressable accessibilityRole="switch" accessibilityState={{ checked: nutritionOnly }} disabled={busy} style={styles.button} onPress={() => { setNutritionOnly(!nutritionOnly); setAccess(null); setOrigin(undefined); setReport(null); }}>
      <Text>Nutrition-only qualification: {nutritionOnly ? 'on' : 'off'}</Text>
    </Pressable>
    <Text accessibilityLiveRegion="polite">Availability: {access?.state ?? 'checking'}</Text>
    <Text>Missing permissions: {access?.missing.join(', ') || 'none'}</Text>
    {(['permissions', 'read', 'settings'] as const).map((action) => <Pressable key={action} accessibilityRole="button" disabled={busy} style={styles.button} onPress={() => void run(action)}>
      <Text style={styles.action}>{action === 'permissions' ? 'Request read permissions' : action === 'read' ? 'Inspect recent evidence' : 'Open Health Connect settings'}</Text>
    </Pressable>)}
    <Text>Selected package: {origin ?? 'none — discover first'}</Text>
    {report?.origins.map((source) => <Pressable key={source.id} disabled={busy} accessibilityRole="button" style={styles.button} onPress={() => { setOrigin(source.id); setReport(null); }}><Text>{nutritionOnly ? `${foodOriginName(source.id)} · ` : ''}{source.id}</Text></Pressable>)}
    <Text accessibilityLiveRegion="polite">{busy ? 'Checking…' : message}</Text>
    {report ? <>
      <Text>Result: {report.state}; origin: {report.originState}</Text>
      <Text>Window: {report.windows[7].localDate} through {report.windows[0].localDate}</Text>
      <Text>Read consistency: {report.readConsistency}; forecast use: disabled</Text>
      <Text>Full-day burn: NOT QUALIFIED</Text>
      {Object.entries(report.counts).map(([category, count]) => <Text key={category}>{category}: {count} records</Text>)}
      {report.days.map((day) => <Text key={day.window.localDate}>{day.window.localDate}: food {day.intake.quality}; steps {day.steps.quality}; sessions {day.activityEvidence.length}; burn coverage {day.burnEvidence.coverage}; walking calibration withheld</Text>)}
    </> : null}
  </ScrollView></SafeAreaView>;
}
const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: colors.background }, content: { padding: spacing.lg, gap: spacing.md }, title: { fontSize: 24, fontWeight: '700', color: colors.text }, button: { minHeight: 48, padding: spacing.md, backgroundColor: colors.surface, borderRadius: 8 }, action: { color: colors.primary, fontWeight: '600' } });
