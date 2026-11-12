import { Platform, View, type ViewStyle } from 'react-native';

export type TodayMetricBackdropProps = { reduced: boolean; style: ViewStyle };

/** Web is a visual approximation. Android stays opaque: no experimental blur. */
export function TodayMetricBackdrop({ reduced, style }: TodayMetricBackdropProps) {
  const web = Platform.OS === 'web' && !reduced;
  const material: ViewStyle = {
    backgroundColor: web ? 'rgba(255,255,255,0.72)' : '#FFFFFF',
    ...(web ? { backdropFilter: 'blur(18px) saturate(115%)', WebkitBackdropFilter: 'blur(18px) saturate(115%)' } : {}),
    borderWidth: reduced ? 0 : 1,
    borderColor: 'rgba(255,255,255,0.92)',
  };
  return <View pointerEvents="none" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[style, material]} />;
}
