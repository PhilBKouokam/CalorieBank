import { FrostedMetric } from '@/components/caloriebank/FrostedSurface';
import { compactGlassCard } from '@/constants/card-surface';
import type { TodayResponse } from '@caloriebank/schemas';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { currentDateSnapshot } from '@/lib/today/current-date';
import { projectedBurnGuidance } from '@/lib/today/projected-burn-guidance';
import { Text } from '@/components/caloriebank/ScaleAwareText';
import { colors, typography } from '@/constants/caloriebank-theme';

type Props = {
  steps: TodayResponse['steps'] | undefined;
  pending: boolean;
  refreshFailed: boolean;
  width?: number;
};

/** Current-day observation only: never a forecast or a bank input. */
export function TodayStepsCard({ steps, pending, refreshFailed, width }: Props) {
  const { fontScale } = useWindowDimensions();
  const count = steps?.count;
  const hasCount = typeof count === 'number' && Number.isFinite(count) && count >= 0
    && steps?.status !== 'not_connected';
  const value = hasCount ? count.toLocaleString()
    : pending || steps?.status === 'syncing' ? 'Loading…' : 'Unavailable';
  const detail = hasCount
    ? pending || steps?.status === 'syncing' ? 'Refreshing…'
      : refreshFailed || steps?.status === 'stale' || steps?.status === 'error' ? 'May be out of date'
        : steps?.status === 'partial' ? 'Still updating' : null
    : pending || steps?.status === 'syncing' ? null
      : refreshFailed || steps?.status === 'error' ? 'Pull down to try again'
        : steps?.status === 'not_connected' ? 'Connect a tracker in Settings' : 'No step data yet';

  return (
    <FrostedMetric accessible accessibilityLabel={`Steps today, ${value}${hasCount ? ' steps' : ''}${detail ? `. ${detail}` : ''}`} style={[styles.card, fontScale > 1.3 && styles.largeTextCard, width !== undefined && { width }]}>
      <Ionicons accessible={false} name="walk-outline" size={16} color="#B54708" />
      <View style={styles.content}>
        <Text style={styles.label}>Steps today</Text>
        <Text style={[styles.value, !hasCount && styles.statusValue]}>{value}</Text>
        {detail ? <Text style={styles.detail}>{detail}</Text> : null}
      </View>
    </FrostedMetric>
  );
}

const styles = StyleSheet.create({
  largeTextCard: { alignItems: 'center' },
  row: { gap: 8, flexDirection: 'row', alignItems: 'stretch' },
  card: { ...compactGlassCard, flex: 1, minWidth: 0, padding: 0, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 18, gap: 7, flexDirection: 'row', alignItems: 'center' },
  content: { flexShrink: 1, minWidth: 0, gap: 1 },
  label: { color: colors.textMuted, fontSize: 12 },
  value: { color: colors.text, fontSize: 18, fontWeight: '700', fontVariant: ['tabular-nums'] },
  statusValue: { fontSize: 16 },
  detail: { color: colors.textMuted, fontSize: typography.caption },
});


/** A pinned summary must leave most of the viewport for reading and editing. */
export function canStickTodayActivityHeader(headerHeight: number, viewportHeight: number, keyboardVisible: boolean) {
  return !keyboardVisible && Number.isFinite(headerHeight) && Number.isFinite(viewportHeight)
    && headerHeight > 0 && viewportHeight > 0 && headerHeight <= viewportHeight * 0.25;
}

type ActivityProps = {
  today: TodayResponse | null;
  pending: boolean;
  refreshFailed: boolean;
  restingAllowed: boolean;
  walkingAllowed: boolean;
  now: Date;
};

const validRate = (value: number | null | undefined): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0;

/** Displays existing rates; never derives calories from a step count. */
export function TodayActivityCards({ today, pending, refreshFailed, restingAllowed, walkingAllowed, now }: ActivityProps) {
  today = currentDateSnapshot(today, now);
  const { width, fontScale } = useWindowDimensions();
  // Keep the horizontal icon-and-value layout readable. Rest remains in Today details.
  const showResting = width >= 560 && fontScale <= 1.3;
  const factor = today?.burned.adjustmentFactor;
  const adjustment = typeof factor === 'number' && Number.isFinite(factor) ? factor : null;
  const rest = today?.restOfDayProjection;
  const restingReady = !pending && !refreshFailed && adjustment !== null
    && projectedBurnGuidance(today, now, restingAllowed) !== null
    && validRate(rest?.adjustedKcalPerHour) && validRate(rest?.providerKcalPerHour);
  const steps = today?.steps;
  const walkingReady = !pending && !refreshFailed && walkingAllowed && adjustment !== null
    && today?.burned.status === 'ready' && steps?.status === 'ready' && steps.estimationStatus === 'ready'
    && validRate(steps.adjustedCaloriesPer1000Steps) && validRate(steps.providerReportedCaloriesPer1000Steps);
  return (
    <View style={[styles.row, fontScale > 1.3 && { flexDirection: 'column' }]}>
      <TodayStepsCard steps={steps} pending={pending} refreshFailed={refreshFailed} />
      <RateCard showDetail={!walkingReady} title="Per 1,000 steps" icon="footsteps-outline"
        value={walkingReady ? `~${Math.round(steps!.adjustedCaloriesPer1000Steps!).toLocaleString()} kcal` : pending ? 'Loading…' : 'Unavailable'}
        detail={walkingReady ? `Estimate · ${Math.round(steps!.providerReportedCaloriesPer1000Steps!).toLocaleString()} × ${adjustment}` : 'Needs walking data'} />
      {showResting ? <RateCard showDetail={!restingReady} title="Resting burn" icon="bed-outline"
        value={restingReady ? `~${Math.round(rest!.adjustedKcalPerHour!).toLocaleString()} kcal/h` : pending ? 'Loading…' : 'Unavailable'}
        detail={restingReady ? `Estimate · ${Math.round(rest!.providerKcalPerHour!).toLocaleString()} × ${adjustment}` : 'Needs recent burn data'} /> : null}
    </View>
  );
}

function RateCard({ width, title, icon, value, detail, showDetail }: {
  width?: number; showDetail: boolean; title: string; icon: 'bed-outline' | 'footsteps-outline'; value: string; detail: string;
}) {
  const { fontScale } = useWindowDimensions();
  return <FrostedMetric accessible accessibilityLabel={`${title}, ${value.replace('kcal/h', 'kilocalories per hour')}. ${detail}`} style={[styles.card, fontScale > 1.3 && styles.largeTextCard, { width }]}>
    <Ionicons accessible={false} name={icon} size={16} color={icon === 'bed-outline' ? '#245BA6' : '#9C3D66'} />
    <View style={styles.content}>
      <Text style={styles.label}>{title}</Text>
      <Text style={[styles.value, { fontSize: 16 }]}>{value}</Text>
      {showDetail ? <Text style={styles.detail}>{detail}</Text> : null}
    </View>
  </FrostedMetric>;
}
