import { Link } from 'expo-router';
import { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors, radii, spacing, typography } from '@/constants/caloriebank-theme';

type RouteLink = {
  href: '/onboarding' | '/sign-in' | '/today' | '/add-food' | '/history' | '/ledger' | '/settings';
  label: string;
  variant?: 'primary' | 'secondary';
};

type Metric = {
  label: string;
  value: string;
};

type PlaceholderScreenProps = {
  eyebrow: string;
  title: string;
  description: string;
  metrics?: Metric[];
  children?: ReactNode;
  links?: RouteLink[];
};

export function PlaceholderScreen({
  eyebrow,
  title,
  description,
  metrics = [],
  children,
  links = [],
}: PlaceholderScreenProps) {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.brandRow}>
        <View style={styles.mark}>
          <Text style={styles.markText}>CB</Text>
        </View>
        <Text style={styles.brand}>CalorieBank</Text>
      </View>

      <View style={styles.header}>
        <Text style={styles.eyebrow}>{eyebrow}</Text>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.description}>{description}</Text>
      </View>

      {metrics.length > 0 ? (
        <View style={styles.metricsGrid}>
          {metrics.map((metric) => (
            <View key={metric.label} style={styles.metricCard}>
              <Text style={styles.metricLabel}>{metric.label}</Text>
              <Text style={styles.metricValue}>{metric.value}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {children ? <View style={styles.panel}>{children}</View> : null}

      {links.length > 0 ? (
        <View style={styles.actions}>
          {links.map((link) => (
            <Link key={link.href} href={link.href} asChild>
              <Pressable style={[styles.button, link.variant === 'secondary' && styles.secondaryButton]}>
                <Text style={[styles.buttonText, link.variant === 'secondary' && styles.secondaryButtonText]}>
                  {link.label}
                </Text>
              </Pressable>
            </Link>
          ))}
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    gap: spacing.lg,
    padding: spacing.lg,
    paddingTop: spacing.xl,
    backgroundColor: colors.background,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  mark: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md,
    backgroundColor: colors.primary,
  },
  markText: {
    color: colors.surface,
    fontSize: typography.caption,
    fontWeight: '800',
  },
  brand: {
    color: colors.text,
    fontSize: typography.subheading,
    fontWeight: '800',
  },
  header: {
    gap: spacing.sm,
  },
  eyebrow: {
    color: colors.primary,
    fontSize: typography.caption,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  title: {
    color: colors.text,
    fontSize: typography.title,
    fontWeight: '800',
  },
  description: {
    color: colors.textMuted,
    fontSize: typography.body,
    lineHeight: 24,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  metricCard: {
    minWidth: '47%',
    flexGrow: 1,
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    padding: spacing.md,
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
  panel: {
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    padding: spacing.md,
  },
  actions: {
    gap: spacing.sm,
  },
  button: {
    alignItems: 'center',
    borderRadius: radii.sm,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  buttonText: {
    color: colors.surface,
    fontSize: typography.body,
    fontWeight: '700',
  },
  secondaryButtonText: {
    color: colors.text,
  },
});
