import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable } from 'react-native';
import { useRouter, type Href } from 'expo-router';

import { colors } from '@/constants/caloriebank-theme';

/** Nested stack roots still need a way back to the parent that opened them. */
export function NavigationBackButton({ fallback }: { fallback: Href }) {
  const router = useRouter();
  return (
    <Pressable
      accessibilityLabel="Back"
      accessibilityRole="button"
      style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}
      onPress={() => {
        if (router.canGoBack()) router.back();
        else router.replace(fallback);
      }}
    >
      <Ionicons accessible={false} name="chevron-back" size={28} color={colors.text} />
    </Pressable>
  );
}
