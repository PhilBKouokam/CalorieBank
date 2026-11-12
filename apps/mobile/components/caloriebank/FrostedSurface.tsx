import { useEffect, useState, forwardRef, createContext, useContext, type ComponentProps } from 'react';
import { AccessibilityInfo, Platform, Pressable, StyleSheet, View, type ViewStyle, type ViewProps, type PressableProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TodayMetricBackdrop } from './TodayMetricBackdrop';

const TransparencyContext = createContext(true);

/** Static cards retain the existing translucent fallback; Today metrics opt into native blur. */
function useReducedTransparency() {
  const [reduced, setReduced] = useState(true);
  useEffect(() => {
    let active = true;
    if (Platform.OS === 'ios') {
      let eventReceived = false;
      let subscription: { remove: () => void } | undefined;
      try {
        subscription = AccessibilityInfo.addEventListener('reduceTransparencyChanged', value => { eventReceived = true; if (active) setReduced(value); });
        Promise.resolve(AccessibilityInfo.isReduceTransparencyEnabled()).then(value => { if (active && !eventReceived) setReduced(value); }).catch(() => { /* Keep opaque on failure. */ });
      } catch { setReduced(true); }
      return () => { active = false; subscription?.remove(); };
    }
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.matchMedia) {
      const preference = window.matchMedia('(prefers-reduced-transparency: reduce)');
      const update = () => setReduced(preference.matches);
      update(); preference.addEventListener?.('change', update);
      return () => preference.removeEventListener?.('change', update);
    }
    setReduced(false);
  }, []);
  return reduced;
}

function material(style: ViewProps['style'], reduced: boolean): ViewStyle {
  const base = StyleSheet.flatten(style) || {};
  const color = typeof base.backgroundColor === 'string' ? base.backgroundColor : '#FFFFFF';
  const match = /^#([a-f0-9]{6})$/i.exec(color);
  const rgb = match ? [0, 2, 4].map(i => parseInt(match[1].slice(i, i + 2), 16)) : [255, 255, 255];
  const backgroundColor = reduced ? (match ? color : '#FFFFFF') : 'rgba(' + rgb.join(',') + ',0.84)';
  const web = Platform.OS === 'web' ? { backdropFilter: reduced ? 'none' : 'blur(18px) saturate(115%)', WebkitBackdropFilter: reduced ? 'none' : 'blur(18px) saturate(115%)' } : {};
  return { ...web, backgroundColor, borderWidth: 1, borderColor: reduced ? '#D7E1DC' : 'rgba(255,255,255,0.96)', shadowColor: '#31594C', shadowOpacity: reduced ? 0 : 0.09, shadowRadius: 16, shadowOffset: { width: 0, height: 5 }, elevation: reduced ? 0 : 2 };
}

export const FrostedView = forwardRef<View, ViewProps>(function FrostedView({ style, ...props }, ref) {
  const reduced = useContext(TransparencyContext);
  return <View {...props} ref={ref} style={[style, material(style, reduced)]} />;
});
export const FrostedPressable = forwardRef<View, PressableProps>(function FrostedPressable({ style, ...props }, ref) {
  const reduced = useContext(TransparencyContext);
  return <Pressable {...props} ref={ref} style={state => { const resolved = typeof style === 'function' ? style(state) : style; return [resolved, material(resolved, reduced)]; }} />;
});

/** Only compact Today metrics float over scrolling content. The shell stays clear;
 * the rounded material is clipped separately so its shadow is not clipped. */
export const FrostedMetric = forwardRef<View, ViewProps>(function FrostedMetric({ style, children, ...props }, ref) {
  const reduced = useContext(TransparencyContext);
  const radius = StyleSheet.flatten(style)?.borderRadius ?? 18;
  return <View {...props} ref={ref} style={[style, {
    backgroundColor: 'transparent', zIndex: 0,
    borderColor: reduced ? '#D7E1DC' : 'rgba(49,89,76,0.18)',
    shadowColor: '#31594C', shadowOpacity: reduced ? 0 : 0.09,
    shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 0,
  }]}>
    <TodayMetricBackdrop reduced={reduced} style={{ ...StyleSheet.absoluteFillObject, zIndex: -1, borderRadius: typeof radius === 'number' ? Math.max(0, radius - 1) : 17, overflow: 'hidden' }} />
    {children}
  </View>;
});

export function FrostedScreen({ style, children, ...props }: ComponentProps<typeof SafeAreaView>) {
  const reduced = useReducedTransparency();
  return <TransparencyContext.Provider value={reduced}><SafeAreaView {...props} style={[style, { backgroundColor: '#EFF4F1' }]}>
    {!reduced ? <View pointerEvents="none" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[StyleSheet.absoluteFillObject, { overflow: 'hidden' }]}>
      {[0,1,2,3,4,5,6,7].map(index => <View key={index} style={{ position:'absolute', top:-200 + index * 16, right:-200 + index * 16, width:600 - index * 32, height:600 - index * 32, borderRadius:400, backgroundColor:'rgba(100,190,164,0.018)' }} />)}
      {[0,1,2,3,4,5,6,7].map(index => <View key={'warm'+index} style={{ position:'absolute', top:360 + index * 16, left:-260 + index * 16, width:600 - index * 32, height:600 - index * 32, borderRadius:400, backgroundColor:'rgba(231,186,108,0.018)' }} />)}
    </View> : null}
    {children}
  </SafeAreaView></TransparencyContext.Provider>;
}
