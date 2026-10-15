import { createContext, forwardRef, useContext, type PropsWithChildren } from 'react';
import { Text as NativeText, useWindowDimensions, type TextProps } from 'react-native';

const FontScaleContext = createContext(1);

export function FontScaleProvider({ children }: PropsWithChildren) {
  const { fontScale } = useWindowDimensions();
  return <FontScaleContext.Provider value={fontScale}>{children}</FontScaleContext.Provider>;
}

export function useTextLayoutScale() {
  return useContext(FontScaleContext);
}

/**
 * RN 0.81 can draw new-size glyphs inside stale paragraph measurements after a
 * system font change. Recreate only the native paragraph, never its screen or
 * editor. Native scaling, nested text styles and accessibility props stay intact.
 * Do not put stateful controls/TextInputs inside this presentation-only wrapper.
 */
export const Text = forwardRef<NativeText, TextProps>(function ScaleAwareText(props, ref) {
  const fontScale = useTextLayoutScale();
  return <NativeText key={fontScale} {...props} ref={ref} />;
});
