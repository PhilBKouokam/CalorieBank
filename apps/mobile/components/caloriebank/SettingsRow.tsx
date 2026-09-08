import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, spacing, typography } from '@/constants/caloriebank-theme';

type SettingsRowProps = {
  title: string;
  description?: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  destructive?: boolean;
  navigation?: boolean;
  separator?: boolean;
  disabled?: boolean;
};

export function SettingsRow({ title, description, icon, onPress, destructive = false, navigation = true, separator = false, disabled = false }: SettingsRowProps) {
  const tint = destructive ? colors.danger : colors.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={description}
      disabled={disabled}
      accessibilityState={{ disabled }}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.icon}>
        <Ionicons name={icon} size={23} color={destructive ? colors.danger : colors.primaryDark} />
      </View>
      <View style={styles.content}>
        <Text style={[styles.title, { color: tint }]}>{title}</Text>
        {description ? <Text style={styles.description}>{description}</Text> : null}
      </View>
      {navigation ? <View accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.chevron}>
        <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
      </View> : null}
      {separator ? <View pointerEvents="none" style={styles.separator} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.md, minHeight: 60 },
  icon: { width: 28, flexShrink: 0, alignItems: 'center', justifyContent: 'center' },
  content: { flex: 1, minWidth: 0, gap: spacing.xs },
  title: { fontSize: typography.body, fontWeight: '700', flexShrink: 1 },
  description: { color: colors.textMuted, fontSize: typography.caption, lineHeight: 19, flexShrink: 1 },
  chevron: { width: 20, flexShrink: 0, alignItems: 'center', justifyContent: 'center' },
  separator: { position: 'absolute', left: spacing.md + 28 + spacing.sm, right: 0, bottom: 0, height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  pressed: { backgroundColor: colors.surfaceMuted },
});
