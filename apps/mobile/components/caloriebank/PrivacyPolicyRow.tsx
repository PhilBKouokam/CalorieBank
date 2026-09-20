import { useState } from 'react';
import { Platform, Text, View } from 'react-native';
import { openBrowserAsync } from 'expo-web-browser';

import { colors, spacing, typography } from '@/constants/caloriebank-theme';
import { SettingsRow } from '@/components/caloriebank/SettingsRow';

export function PrivacyPolicyRow() {
  const [failed, setFailed] = useState(false);
  const [opening, setOpening] = useState(false);
  if (Platform.OS !== 'android') return null;

  async function openPolicy() {
    if (opening) return;
    setOpening(true);
    setFailed(false);
    try {
      await openBrowserAsync('https://caloriebank.philbk.dev/privacy');
    } catch {
      setFailed(true);
    } finally {
      setOpening(false);
    }
  }

  return (
    <View>
      <SettingsRow title="Privacy Policy" icon="document-text-outline" disabled={opening}
        onPress={() => void openPolicy()} />
      {failed ? <Text accessibilityLiveRegion="polite" style={{ color: colors.textMuted, fontSize: typography.caption, paddingHorizontal: spacing.md, paddingBottom: spacing.md }}>
        We couldn’t open the Privacy Policy. Please try again.
      </Text> : null}
    </View>
  );
}
