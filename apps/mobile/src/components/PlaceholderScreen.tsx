import { Link } from 'expo-router';
import { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, radii, spacing, typography } from '../theme/tokens';

type RouteLink = {
  href: '/onboarding' | '/sign-in' | '/home' | '/log-food' | '/history' | '/settings';
  label: string;
};

type PlaceholderScreenProps = {
  eyebrow: string;
  title: string;
  description: string;
  children?: ReactNode;
  links?: RouteLink[];
};

export function PlaceholderScreen({ eyebrow, title, description, children, links = [] }: PlaceholderScreenProps) {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>{eyebrow}</Text>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.description}>{description}</Text>
      </View>

      {children ? <View style={styles.panel}>{children}</View> : null}

      {links.length > 0 ? (
        <View style={styles.actions}>
          {links.map((link) => (
            <Link key={link.href} href={link.href} asChild>
              <Pressable style={styles.button}>
                <Text style={styles.buttonText}>{link.label}</Text>
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
    padding: spacing.lg,
    gap: spacing.lg,
    backgroundColor: colors.background,
  },
  header: {
    gap: spacing.sm,
    paddingTop: spacing.xl,
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
  panel: {
    gap: spacing.md,
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
  buttonText: {
    color: colors.surface,
    fontSize: typography.body,
    fontWeight: '700',
  },
});
