import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import type { Href } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radii, spacing, typography } from '@/constants/caloriebank-theme';

type SummaryCardProps = {
  label: string;
  value: string;
  detail?: string;
  href?: Href;
  accessibilityLabel: string;
  accessibilityHint?: string;
};

function CardContent({ interactive, label, value, detail }: SummaryCardProps & { interactive: boolean }) {
  return (
    <>
      <View style={styles.copy}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.value}>{value}</Text>
        {detail ? <Text style={styles.detail}>{detail}</Text> : null}
      </View>
      {interactive ? <Ionicons name="chevron-forward" size={20} color={colors.textMuted} /> : null}
    </>
  );
}

export function SummaryCard(props: SummaryCardProps) {
  const cardContent = <CardContent {...props} interactive={Boolean(props.href)} />;

  if (!props.href) {
    return <View style={styles.card}>{cardContent}</View>;
  }

  return (
    <Link href={props.href} asChild>
      <Pressable
        accessibilityHint={props.accessibilityHint}
        accessibilityLabel={props.accessibilityLabel}
        accessibilityRole="button"
        style={({ pressed }) => [styles.card, styles.interactiveCard, pressed && styles.pressedCard]}
      >
        {cardContent}
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 88,
    minWidth: '47%',
    flexGrow: 1,
    flexBasis: '47%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    padding: spacing.md,
  },
  interactiveCard: {
    borderColor: colors.primary,
  },
  pressedCard: {
    opacity: 0.72,
  },
  copy: {
    flex: 1,
    gap: spacing.xs,
  },
  label: {
    color: colors.textMuted,
    fontSize: typography.caption,
  },
  value: {
    color: colors.text,
    fontSize: typography.heading,
    fontWeight: '800',
  },
  detail: {
    color: colors.textMuted,
    fontSize: typography.caption,
    lineHeight: 18,
  },
});
