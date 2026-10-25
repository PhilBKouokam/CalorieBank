import { requireNativeModule } from 'expo';
import { forwardRef, useCallback, useEffect, useRef, useState } from 'react';
import { AppState, findNodeHandle, ScrollView, StyleSheet, View, type ScrollViewProps } from 'react-native';
import { focusedScrollTarget, keyboardOverlap, type KeyboardGeometry } from '@/lib/keyboard/geometry';

type Registration = { status: 'attached' | 'pending' | 'error'; reason?: string };
let nextOwner = 0;
type GeometryModule = {
  watch(tag: number, owner: string): Promise<Registration>;
  unwatch(tag: number, owner: string): Promise<void>;
  measure(outer: number, scroll: number, owner: string): Promise<KeyboardGeometry | null>;
  addListener(event: 'geometryChanged', listener: (event: { tag: number; owner: string }) => void): { remove(): void };
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
  const owner = useRef('');
  const watchedTag = useRef<number | null>(null);
  const registration = useRef<Promise<void> | null>(null);
  const [overlap, setOverlap] = useState(0);

  const refresh = useCallback(async () => {
    const outerTag = findNodeHandle(outer.current), scrollTag = findNodeHandle(scroll.current);
    if (!module.current || outerTag === null || scrollTag === null) return;
    const request = ++revision.current;
    const lifetime = owner.current;
    const geometry = await module.current.measure(outerTag, scrollTag, lifetime);
    if (!mounted.current || lifetime !== owner.current || request !== revision.current || !geometry) return;
    const next = keyboardOverlap(geometry);
    if (next !== overlapRef.current) {
      overlapRef.current = next;
      setOverlap(next);
      return; // Reassess focus from onLayout AFTER the new viewport is committed.
    }
    const target = focusedScrollTarget(geometry);
    if (target !== null) scroll.current?.scrollTo({ y: target, animated: false });
  }, []);

  const register = useCallback(() => {
    const native = module.current;
    const tag = findNodeHandle(outer.current);
    if (!mounted.current || !native || tag === null || registration.current) return;
    const lifetime = owner.current;
    if (watchedTag.current !== tag) {
      ++revision.current;
      if (watchedTag.current !== null) void native.unwatch(watchedTag.current, lifetime);
      watchedTag.current = tag;
    }
    const pending = native.watch(tag, lifetime).then(result => {
      if (!mounted.current || owner.current !== lifetime) return;
      if (result.status === 'attached') void refresh();
      else if (result.status === 'error') console.warn('Keyboard observer registration failed:', result.reason);
      // Pending view lookup is recovered by native window-layout/attachment events.
      // Layout/foreground below also reattempt, including a temporarily absent Activity.
    }).catch(() => {
      if (mounted.current && owner.current === lifetime) console.warn('Keyboard observer registration failed.');
    }).finally(() => {
      if (registration.current === pending) registration.current = null;
    });
    registration.current = pending;
  }, [refresh]);

  const layoutChanged = useCallback(() => { register(); void refresh(); }, [register, refresh]);

  useEffect(() => {
    ++revision.current;
    mounted.current = true;
    const lifetime = `keyboard-${++nextOwner}`;
    owner.current = lifetime;
    registration.current = null;
    const native = requireNativeModule<GeometryModule>('CalorieBankKeyboardGeometry');
    module.current = native;
    watchedTag.current = null;
    const subscription = native.addListener('geometryChanged', event => {
      if (mounted.current && owner.current === lifetime && event.owner === lifetime && event.tag === watchedTag.current) void refresh();
    });
    const foreground = AppState.addEventListener('change', state => { if (state === 'active') register(); });
    register(); // Also recovers layout-before-effect ordering; no prior onLayout is required.
    return () => {
      mounted.current = false;
      ++revision.current;
      module.current = null;
      subscription.remove();
      foreground.remove();
      if (watchedTag.current !== null) void native.unwatch(watchedTag.current, lifetime);
      watchedTag.current = null;
    };
  }, [refresh, register]);

  return <View ref={outer} collapsable={false} style={[styles.host, style]} onLayout={layoutChanged}>
    <ScrollView {...props} ref={value => {
      scroll.current = value;
      if (typeof forwardedRef === 'function') forwardedRef(value);
      else if (forwardedRef) forwardedRef.current = value;
    }} style={[styles.scroll, { marginBottom: overlap }]}
      automaticallyAdjustKeyboardInsets={false} keyboardDismissMode="none" keyboardShouldPersistTaps="handled"
      onLayout={event => { onLayout?.(event); layoutChanged(); }}
      onContentSizeChange={(width, height) => { onContentSizeChange?.(width, height); layoutChanged(); }}
    />
  </View>;
});
const styles = StyleSheet.create({ host: { flex: 1 }, scroll: { flex: 1 } });
