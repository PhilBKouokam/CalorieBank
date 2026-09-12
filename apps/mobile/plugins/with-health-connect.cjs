const { withAndroidManifest, withDangerousMod, AndroidConfig } = require('@expo/config-plugins');
const fs = require('node:fs/promises');
const path = require('node:path');

module.exports = function withCalorieBankHealthConnect(config) {
  config = withAndroidManifest(config, (mod) => {
    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(mod.modResults);
    const main = AndroidConfig.Manifest.getMainActivityOrThrow(mod.modResults);
    const rationale = 'androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE';
    // A Health Connect policy intent must show the policy, not the ordinary Today screen.
    main['intent-filter'] = (main['intent-filter'] || []).filter((f) => !(f.action || []).some((a) => a.$['android:name'] === rationale));
    app.activity = (app.activity || []).filter((a) => a.$['android:name'] !== '.HealthConnectRationaleActivity');
    app.activity.push({ $: { 'android:name': '.HealthConnectRationaleActivity', 'android:exported': 'true' },
      'intent-filter': [{ action: [{ $: { 'android:name': rationale } }] }] });
    app['activity-alias'] = (app['activity-alias'] || []).filter((a) => a.$['android:name'] !== 'ViewPermissionUsageActivity');
    app['activity-alias'].push({ $: { 'android:name': 'ViewPermissionUsageActivity', 'android:exported': 'true', 'android:targetActivity': '.HealthConnectRationaleActivity', 'android:permission': 'android.permission.START_VIEW_PERMISSION_USAGE' },
      'intent-filter': [{ action: [{ $: { 'android:name': 'android.intent.action.VIEW_PERMISSION_USAGE' } }], category: [{ $: { 'android:name': 'android.intent.category.HEALTH_PERMISSIONS' } }] }] });
    return mod;
  });
  return withDangerousMod(config, ['android', async (mod) => {
    const packageName = mod.android.package;
    const dir = path.join(mod.modRequest.platformProjectRoot, 'app/src/main/java', ...packageName.split('.'));
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, 'HealthConnectRationaleActivity.java'), `package ${packageName};
import android.app.Activity;
import android.os.Bundle;
import android.widget.ScrollView;
import android.widget.TextView;
public class HealthConnectRationaleActivity extends Activity {
  @Override public void onCreate(Bundle state) {
    super.onCreate(state);
    TextView text = new TextView(this);
    text.setText("CalorieBank — Health Connect access\\n\\nCalorieBank's Android qualification tool reads calories eaten, steps, exercise sessions, distance, active and total calories burned, and resting metabolic rate. It checks source identity and recent history to determine which data can safely support CalorieBank.\\n\\nThis qualification build does not write health data, upload Health Connect records, or change your bank from these records. Data is inspected in memory. Diagnostics display counts, source packages and quality states, not raw health records.\\n\\nYou control access in Health Connect settings and can revoke any permission. No background access or unrelated health categories are requested.");
    text.setTextSize(18);
    int padding = (int)(24 * getResources().getDisplayMetrics().density);
    text.setPadding(padding, padding, padding, padding);
    ScrollView scroll = new ScrollView(this); scroll.addView(text); setContentView(scroll);
  }
}
`);
    return mod;
  }]);
};
