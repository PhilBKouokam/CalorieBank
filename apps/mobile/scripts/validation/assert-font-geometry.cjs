/** Physical diagnostic capture gate. Input units are physical pixels, not dp/sp.
 * This validates measurements; it does not synthesize a passing native capture.
 */
function assertFontGeometry(before, after) {
  if (!(after.fontScale > before.fontScale)) throw new Error('Expected an enlarged-font capture.');
  if (after.jsFontScale !== after.fontScale || after.nativeFontScale !== after.fontScale) {
    throw new Error('Font scale did not reach JS and native text.');
  }
  for (const name of ['title', 'save', 'calculation']) {
    const old = before.labels[name], next = after.labels[name];
    if (!old || !next) throw new Error(`Missing ${name} measurements.`);
    if (name !== 'calculation' && old.text !== next.text) throw new Error(`${name} must be unchanged.`);
    if (next.allocatedHeightPx + 1 < next.paragraphHeightPx) throw new Error(`${name} is clipped.`);
    if (next.paragraphHeightPx > old.allocatedHeightPx + 1 && next.allocatedHeightPx <= old.allocatedHeightPx) {
      throw new Error(`${name} retained stale layout bounds.`);
    }
  }
}
module.exports = { assertFontGeometry };
if (require.main === module) {
  const fs = require('node:fs');
  const [before, after] = process.argv.slice(2);
  if (!before || !after) throw new Error('Provide before.json and after.json native measurement captures.');
  assertFontGeometry(JSON.parse(fs.readFileSync(before, 'utf8')), JSON.parse(fs.readFileSync(after, 'utf8')));
  console.log('Native font geometry capture passed.');
}
