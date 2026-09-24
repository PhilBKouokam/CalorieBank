import { HeaderBackButton } from '@react-navigation/elements';
import { useRouter, type Href } from 'expo-router';

import { colors } from '@/constants/caloriebank-theme';

/** Nested stack roots still need a way back to the parent that opened them. */
export function NavigationBackButton({ fallback }: { fallback: Href }) {
  const router = useRouter();
  return (
    <HeaderBackButton
      accessibilityLabel="Back"
      label="Back"
      displayMode="minimal"
      tintColor={colors.text}
      style={{ minWidth: 48, minHeight: 48 }}
      onPress={() => {
        if (router.canGoBack()) router.back();
        else router.replace(fallback);
      }}
    />
  );
}
