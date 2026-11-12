import { BlurView } from 'expo-blur';
import { View, type ViewStyle } from 'react-native';

type Props = { reduced: boolean; style: ViewStyle };

/** Matches the existing light canvas in either OS appearance. This is a UIKit
 * thin material, not iOS 26 Liquid Glass. No white alpha sheet hides the blur. */
export function TodayMetricBackdrop({ reduced, style }: Props) {
  const decoration = { pointerEvents: 'none' as const, accessible: false, accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants' as const };
  if (reduced) return <View {...decoration} style={[style, { backgroundColor: '#FFFFFF' }]} />;
  return <BlurView {...decoration} tint="systemThinMaterialLight" intensity={100} style={[style, { borderWidth: 1, borderColor: 'rgba(255,255,255,0.92)' }]} />;
}
