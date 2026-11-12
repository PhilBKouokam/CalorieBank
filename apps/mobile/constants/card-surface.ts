import type { ViewStyle } from 'react-native';

/** Translucent, high-contrast glass-inspired fallback. No native module or build required. */
export const compactGlassCard: ViewStyle = {
  backgroundColor: 'rgba(255,255,255,0.78)',
  borderColor: 'rgba(255,255,255,0.96)',
  borderWidth: 1,
  borderRadius: 22,
  padding: 14,
  shadowColor: '#254B40',
  shadowOpacity: 0.07,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 3 },
  elevation: 2,
};
