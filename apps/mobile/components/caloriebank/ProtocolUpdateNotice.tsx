import { useSyncExternalStore } from 'react';
import { Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { UPDATE_REQUIRED_MESSAGE } from '@caloriebank/schemas';
import { isUpdateRequired, subscribeToProtocolState } from '@/lib/api/protocol-state';
import { colors, spacing, typography } from '@/constants/caloriebank-theme';

export function ProtocolUpdateNotice() {
  const required = useSyncExternalStore(subscribeToProtocolState, isUpdateRequired, isUpdateRequired);
  if (!required) return null;
  return <SafeAreaView edges={['top', 'left', 'right']} style={{ padding: spacing.md, backgroundColor: colors.surface }}>
    <Text accessibilityRole="alert" accessibilityLiveRegion="assertive" style={{ color: colors.text, fontSize: typography.body, fontWeight: '600' }}>{UPDATE_REQUIRED_MESSAGE}</Text>
  </SafeAreaView>;
}
