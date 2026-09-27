import { requireNativeModule } from 'expo';
import { forwardRef, useCallback, useEffect, useRef, useState } from 'react';
import { findNodeHandle, ScrollView, StyleSheet, View, type ScrollViewProps } from 'react-native';
import { focusedScrollTarget, keyboardOverlap, type KeyboardGeometry } from '@/lib/keyboard/geometry';

type GeometryModule = {
  watch(tag: number): Promise<void>;
  unwatch(tag: number): Promise<void>;
  measure(outer: number, scroll: number): Promise<KeyboardGeometry | null>;
  addListener(event: 'geometryChanged', listener: (event: { tag: number }) => void): { remove(): void };
};

/** The stable outer frame measures overlap; only the inner viewport shrinks. */
export const AndroidKeyboardSafeScrollView = forwardRef<ScrollView, ScrollViewProps>(function AndroidKeyboardSafeScrollView(
  { style, onLayout, onContentSizeChange, ...props }, forwardedRef,
) {
  const outer = useRef<View>(null);
  const scroll = useRef<ScrollView>(null);
  const module = useRef<GeometryModule | null>(null);
  const mounted = useRef(false);
  const revision = useRef(0);
  const overlapRef = useRef(0);
  const [overlap, setOverlap] = useState(0);

  const refresh = useCallback(async () => {
    const outerTag = findNodeHandle(outer.current), scrollTag = findNodeHandle(scroll.current);
    if (!module.current || outerTag === null || scrollTag === null) return;
    const request = ++revision.current;
    const geometry = await module.current.measure(outerTag, scrollTag);
    if (!mounted.current || request !== revision.current || !geometry) return;
    const next = keyboardOverlap(geometry);
    if (next !== overlapRef.current) {
      overlapRef.current = next;
      setOverlap(next);
      return; // Reassess focus from onLayout AFTER the new viewport is committed.
    }
    const target = focusedScrollTarget(geometry);
    if (target !== null) scroll.current?.scrollTo({ y: target, animated: false });
  }, []);

  useEffect(() => {
    ++revision.current; // Invalidate measurements from a previous effect lifetime.
    mounted.current = true;
    const native = requireNativeModule<GeometryModule>('CalorieBankKeyboardGeometry');
    module.current = native;
    const tag = findNodeHandle(outer.current);
    const subscription = native.addListener('geometryChanged', event => {
      if (event.tag === tag) void refresh();
    });
    if (tag !== null) void native.watch(tag);
    return () => {
      mounted.current = false;
      subscription.remove();
      if (tag !== null) void native.unwatch(tag);
    };
  }, [refresh]);

  return <View ref={outer} collapsable={false} style={[styles.host, style]} onLayout={() => void refresh()}>
    <ScrollView {...props} ref={value => {
      scroll.current = value;
      if (typeof forwardedRef === 'function') forwardedRef(value);
      else if (forwardedRef) forwardedRef.current = value;
    }} style={[styles.scroll, { marginBottom: overlap }]}
      automaticallyAdjustKeyboardInsets={false} keyboardDismissMode="none" keyboardShouldPersistTaps="handled"
      onLayout={event => { onLayout?.(event); void refresh(); }}
      onContentSizeChange={(width, height) => { onContentSizeChange?.(width, height); void refresh(); }}
    />
  </View>;
});
const styles = StyleSheet.create({ host: { flex: 1 }, scroll: { flex: 1 } });
