import { StyleSheet, Text } from 'react-native';
import { colors, typography } from '@/constants/caloriebank-theme';

export function CompletedContribution({ sentence }: { sentence: string }) {
  const match = /^(You (?:banked|enjoyed) )(\d[\d,]* kcal)( .+)$/.exec(sentence);
  return <Text accessibilityLabel={sentence.replace('kcal', 'kilocalories')} style={styles.sentence}>
    {match ? <>{match[1]}<Text style={styles.amount}>{match[2]}</Text>{match[3]}</> : sentence}
  </Text>;
}
const styles = StyleSheet.create({
  sentence: { color: colors.textMuted, fontSize: typography.body, lineHeight: 29 },
  amount: { color: colors.primaryDark, fontSize: 21, fontWeight: '800' },
});
