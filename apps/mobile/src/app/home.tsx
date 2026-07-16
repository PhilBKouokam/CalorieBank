import { StyleSheet, Text, View } from 'react-native';
import { PlaceholderScreen } from '../components/PlaceholderScreen';
import { colors, spacing, typography } from '../theme/tokens';

export default function HomeScreen() {
  return (
    <PlaceholderScreen
      eyebrow="Mobile V1 Foundation"
      title="Today"
      description="Placeholder dashboard for the calorie bank balance, today's consumed calories, target, and projected change."
      links={[
        { href: '/log-food', label: 'Open Food Log Placeholder' },
        { href: '/history', label: 'View History Placeholder' },
        { href: '/settings', label: 'Open Settings Placeholder' },
      ]}
    >
      <View style={styles.metricRow}>
        <Metric label="Bank Balance" value="0 cal" />
        <Metric label="Projected Today" value="0 cal" />
      </View>
      <Text style={styles.note}>Business logic will come from the shared domain package after the foundation is verified.</Text>
    </PlaceholderScreen>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  metricRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  metric: {
    flex: 1,
    gap: spacing.xs,
  },
  metricLabel: {
    color: colors.textMuted,
    fontSize: typography.caption,
  },
  metricValue: {
    color: colors.text,
    fontSize: typography.heading,
    fontWeight: '800',
  },
  note: {
    color: colors.textMuted,
    fontSize: typography.caption,
    lineHeight: 19,
  },
});
