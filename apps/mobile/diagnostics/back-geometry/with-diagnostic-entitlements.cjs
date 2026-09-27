const { withEntitlementsPlist } = require('@expo/config-plugins');
module.exports = config => withEntitlementsPlist(config, mod => {
  // This app has no health/account/notification flows. Signing adds its ordinary
  // application identity; no health or push capability belongs in the diagnostic.
  delete mod.modResults['aps-environment'];
  delete mod.modResults['com.apple.developer.healthkit'];
  delete mod.modResults['com.apple.developer.healthkit.access'];
  return mod;
});
