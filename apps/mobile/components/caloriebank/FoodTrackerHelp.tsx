import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { foodTrackerGuidance } from '@/lib/healthkit/food-tracker-guidance';
import { colors, spacing, typography } from '@/constants/caloriebank-theme';

export function FoodTrackerHelp({ provider, bundleId, chosenTracker }: { provider: string; bundleId?: string | null; chosenTracker?: string | null }) {
  const [open, setOpen] = useState(false);
  const help = foodTrackerGuidance(provider, bundleId, chosenTracker);
  if (!help) return null;
  return <View style={styles.content}>
    <Text style={styles.body}>{help.message}</Text>
    <Pressable accessibilityRole="button" onPress={() => setOpen(true)} style={styles.button}><Text style={styles.link}>{help.action}</Text></Pressable>
    <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
      <SafeAreaView style={styles.screen}><ScrollView contentContainerStyle={styles.content}>
        <Text accessibilityRole="header" style={styles.title}>{help.title}</Text>
        {help.steps.map((step, index) => <Text key={step} style={styles.body}>{index + 1}. {step}</Text>)}
        <Pressable accessibilityRole="button" onPress={() => setOpen(false)} style={styles.button}><Text style={styles.link}>Done</Text></Pressable>
      </ScrollView></SafeAreaView>
    </Modal>
  </View>;
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { gap: spacing.md, paddingVertical: spacing.md, paddingHorizontal: spacing.sm },
  body: { color: colors.textMuted, fontSize: typography.body },
  title: { color: colors.text, fontSize: typography.heading, fontWeight: '700' },
  button: { minHeight: 48, justifyContent: 'center', paddingVertical: spacing.sm },
  link: { color: colors.primaryDark, fontSize: typography.body, fontWeight: '700' },
});
