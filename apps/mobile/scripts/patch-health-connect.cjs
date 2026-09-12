// Preserve Health Connect NutritionRecord.energy nulls; upstream 4.1.3 coerces them to zero.
// Fail closed if an upgrade changes the target. Android only; no iOS native source edits.
const fs = require('node:fs');
const path = require('node:path');
const packageFile = require.resolve('react-native-health-connect/package.json');
if (JSON.parse(fs.readFileSync(packageFile, 'utf8')).version !== '4.1.3') {
  throw new Error('Review the Health Connect nutrition-null patch before upgrading.');
}
const file = path.join(path.dirname(packageFile), 'android/src/main/java/dev/matinzd/healthconnect/records/ReactNutritionRecord.kt');
const before = 'putMap("energy", energyToJsMap(record.energy))';
const after = 'putMap("energy", record.energy?.let { energyToJsMap(it) })';
const source = fs.readFileSync(file, 'utf8');
if (!source.includes(after)) {
  if (source.split(before).length !== 2) throw new Error('Health Connect nutrition-null patch target changed.');
  fs.writeFileSync(file, source.replace(before, after));
}
