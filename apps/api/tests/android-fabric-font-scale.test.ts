import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
const require = createRequire(__filename);
const { patchMainApplication } = require('../../mobile/plugins/with-fabric-font-scale.cjs') as { patchMainApplication: (s: string) => string };
const rn = resolve(__dirname, '../../../node_modules/react-native');
const read = (path: string) => readFileSync(resolve(rn, path), 'utf8');
it('installs one version-pinned startup provider, delegates stable flags and changes only font scale', () => {
  const source = 'import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative\nclass MainApplication {\nfun onCreate() { loadReactNative(this) }\n}\n';
  const patched = patchMainApplication(source);
  expect(patchMainApplication(patched)).toBe(patched);
  expect(patched).toContain('ReactNativeFeatureFlagsProvider by stable');
  expect(patched.match(/override fun /g)).toHaveLength(1);
  expect(patched).toContain('override fun enableFontScaleChangesUpdatingLayout(): Boolean = true');
  expect(patched.match(/loadWithFeatureFlags\(flags\)/g)).toHaveLength(1);
  expect(patched).not.toContain('dangerously'); expect(patched).not.toContain('loadReactNative(this)');
  expect(() => patchMainApplication('class Unexpected {}')).toThrow();
});
it('pins the actual Fabric path from scale changes through layout context to text measurement cache identity', () => {
  expect(JSON.parse(read('package.json')).version).toBe('0.81.5');
  const surface = read('ReactAndroid/src/main/java/com/facebook/react/runtime/ReactSurfaceImpl.kt');
  expect(surface).toContain('ReactNativeFeatureFlags.enableFontScaleChangesUpdatingLayout()');
  expect(surface).toContain('context.getResources().getConfiguration().fontScale');
  expect(surface.match(/getFontScale\(context\)/g)?.length).toBeGreaterThanOrEqual(2);
  expect(read('ReactAndroid/src/main/jni/react/fabric/SurfaceHandlerBinding.cpp')).toContain('fontSizeMultiplier = fontScale');
  expect(read('ReactCommon/react/renderer/components/text/ParagraphShadowNode.cpp')).toContain('layoutContext.fontSizeMultiplier');
  expect(read('ReactCommon/react/renderer/textlayoutmanager/TextMeasureCache.h')).toContain('fontSizeMultiplier');
});
it('rejects the measured diagnostic clipping even when the newly changed calculation fits', () => {
  const { assertFontGeometry } = require('../../mobile/scripts/validation/assert-font-geometry.cjs') as { assertFontGeometry: (before: unknown, after: unknown) => void };
  // Synthetic-data device captures: title/Save remained unchanged; calculation changed to 151.
  const before = { fontScale: 1, labels: {
    title: { text: 'Calories eaten today', allocatedHeightPx: 66, paragraphHeightPx: 66 },
    save: { text: 'Save', allocatedHeightPx: 46, paragraphHeightPx: 46 },
    calculation: { text: '1,935 + 150 = 2,085 kcal', allocatedHeightPx: 46, paragraphHeightPx: 46 },
  } };
  const after = { fontScale: 2, jsFontScale: 2, nativeFontScale: 2, labels: {
    title: { text: 'Calories eaten today', allocatedHeightPx: 66, paragraphHeightPx: 246 },
    save: { text: 'Save', allocatedHeightPx: 46, paragraphHeightPx: 251 },
    calculation: { text: '1,935 + 151 = 2,086 kcal', allocatedHeightPx: 171, paragraphHeightPx: 171 },
  } };
  // Granting correct scale propagation alone must never conceal the observed geometry failure.
  expect(() => assertFontGeometry(before, after)).toThrow('title is clipped');
});
