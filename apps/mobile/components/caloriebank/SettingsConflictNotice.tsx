import { Pressable, View } from 'react-native';
import { Text } from './ScaleAwareText';
import { colors, spacing, typography } from '@/constants/caloriebank-theme';

export function SettingsConflictNotice({ latest, onReview }: { latest: string; onReview: () => void }) {
  return <View style={{ gap: spacing.sm }}>
    <Text accessibilityRole="alert" style={{ color: colors.text, fontSize: typography.body }}>
      This setting changed elsewhere. Your edits are still here. Latest saved value: {latest}
    </Text>
    <Pressable accessibilityRole="button" onPress={onReview} style={{ minHeight: 48, padding: spacing.md, borderWidth: 1, borderColor: colors.primary }}>
      <Text style={{ color: colors.primary, fontSize: typography.body, fontWeight: '700' }}>Keep my edits</Text>
    </Pressable>
    <Text style={{ color: colors.textMuted, fontSize: typography.body }}>Review both values, then choose Keep my edits to enable Save. Nothing changes until you save.</Text>
  </View>;
}
