const { withMainApplication } = require('@expo/config-plugins');
const fs = require('node:fs');
const path = require('node:path');

const marker = '// CalorieBank RN 0.81.5 font-scale initialization';
function patchMainApplication(source) {
  if (source.includes(marker)) return source;
  const call = 'loadReactNative(this)';
  if (source.split(call).length !== 2) throw new Error('Unexpected React Native startup; review font-scale integration.');
  return source.replace(call, `loadCalorieBankReactNative()`)
    .replace('import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative', '')
    .replace(/\n}\s*$/, `
  ${marker}
  // Pinned internal loader is the only RN 0.81.5 entry point accepting one provider.
  // Delegate every stable flag except font-scale layout invalidation; never override twice.
  @Suppress("INVISIBLE_MEMBER", "INVISIBLE_REFERENCE")
  private fun loadCalorieBankReactNative() {
    check(BuildConfig.IS_NEW_ARCHITECTURE_ENABLED)
    check(DefaultNewArchitectureEntryPoint.releaseLevel == ReleaseLevel.STABLE)
    com.facebook.soloader.SoLoader.init(this, com.facebook.react.soloader.OpenSourceMergedSoMapping)
    val stable = com.facebook.react.internal.featureflags.ReactNativeFeatureFlagsOverrides_RNOSS_Stable_Android(true, true, true)
    val flags = object : com.facebook.react.internal.featureflags.ReactNativeFeatureFlagsProvider by stable {
      override fun enableFontScaleChangesUpdatingLayout(): Boolean = true
    }
    DefaultNewArchitectureEntryPoint.loadWithFeatureFlags(flags)
    if (BuildConfig.IS_EDGE_TO_EDGE_ENABLED) com.facebook.react.views.view.setEdgeToEdgeFeatureFlagOn()
  }
}
`);
}
module.exports = function withFabricFontScale(config) {
  return withMainApplication(config, mod => {
    const rnPackage = require.resolve('react-native/package.json', { paths: [mod.modRequest.projectRoot] });
    if (JSON.parse(fs.readFileSync(rnPackage, 'utf8')).version !== '0.81.5') {
      throw new Error('Review native font-scale integration before changing React Native version.');
    }
    const entry = fs.readFileSync(path.join(path.dirname(rnPackage), 'ReactAndroid/src/main/java/com/facebook/react/defaults/DefaultNewArchitectureEntryPoint.kt'), 'utf8');
    if (!entry.includes('internal fun loadWithFeatureFlags(featureFlags: ReactNativeFeatureFlagsProvider)')) {
      throw new Error('Pinned feature-flag loader changed.');
    }
    if (mod.modResults.language !== 'kt') throw new Error('Expected Kotlin MainApplication.');
    mod.modResults.contents = patchMainApplication(mod.modResults.contents);
    return mod;
  });
};
module.exports.patchMainApplication = patchMainApplication;
