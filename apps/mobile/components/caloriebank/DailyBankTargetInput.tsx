import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, radii, spacing, typography } from '@/constants/caloriebank-theme';

export function DailyBankTargetInput({ value, onChange, disabled = false }: {
  value: string; onChange: (value: string) => void; disabled?: boolean;
}) {
  return <View style={styles.container}>
    <Text style={styles.title}>How much would you like to bank each day?</Text>
    <Text style={styles.detail}>Choose an amount you’d like to save for the foods and moments you enjoy.</Text>
    <View style={styles.presets}>
      {[0, 100, 200, 300].map((calories) => <Pressable key={calories}
        accessibilityRole="button" accessibilityLabel={`${calories} calories per day`}
        accessibilityState={{ selected: value === String(calories), disabled }} disabled={disabled}
        onPress={() => onChange(String(calories))}
        style={[styles.preset, value === String(calories) && styles.selected]}>
        <Text style={[styles.label, value === String(calories) && styles.selectedText]}>{calories} kcal</Text>
      </Pressable>)}
    </View>
    <Text style={styles.label}>Daily Bank Target (kcal)</Text>
    <TextInput accessibilityLabel="Daily Bank Target in calories" editable={!disabled}
      keyboardType="number-pad" maxLength={4} value={value}
      onChangeText={(text) => onChange(text.replace(/\D/g, ''))} style={styles.input} />
    <Text style={styles.detail}>This is a flexible target, separate from your Fitness Goal. Choose 0 for no daily target. You can change it later.</Text>
  </View>;
}

const styles = StyleSheet.create({
  container: { gap: spacing.sm },
  title: { color: colors.text, fontSize: typography.heading, fontWeight: '700' },
  detail: { color: colors.textMuted, fontSize: typography.body },
  presets: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  preset: { flexGrow: 1, flexBasis: '40%', minHeight: 48, alignItems: 'center', justifyContent: 'center', padding: spacing.sm, borderRadius: radii.sm, borderWidth: 1, borderColor: colors.border },
  selected: { backgroundColor: colors.primary, borderColor: colors.primary },
  selectedText: { color: colors.surface },
  label: { color: colors.text, fontSize: typography.body, fontWeight: '600' },
  input: { minHeight: 48, borderWidth: 1, borderColor: colors.border, borderRadius: radii.sm, padding: spacing.md, fontSize: typography.body, color: colors.text },
});
