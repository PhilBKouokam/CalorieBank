const { withEntitlementsPlist, withPodfileProperties, withXcodeProject } = require('@expo/config-plugins');
module.exports = config => {
  // Build 9 targeted iOS 17.0 via the Clerk plugin. The offline app omits that
  // plugin but must retain its deployment target for the pinned native pods.
  config = withPodfileProperties(config, mod => {
    mod.modResults['ios.deploymentTarget'] = '17.0';
    return mod;
  });
  config = withXcodeProject(config, mod => {
    for (const section of Object.values(mod.modResults.pbxXCBuildConfigurationSection())) {
      if (typeof section === 'object' && section.buildSettings) section.buildSettings.IPHONEOS_DEPLOYMENT_TARGET = '17.0';
    }
    return mod;
  });
  return withEntitlementsPlist(config, mod => {
  // This app has no health/account/notification flows. Signing adds its ordinary
  // application identity; no health or push capability belongs in the diagnostic.
  delete mod.modResults['aps-environment'];
  delete mod.modResults['com.apple.developer.healthkit'];
  delete mod.modResults['com.apple.developer.healthkit.access'];
  return mod;
  });
};
