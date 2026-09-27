const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const root = path.dirname(require.resolve('react-native-screens/package.json'));
const target = path.join(root, 'ios/RNSScreenStackHeaderSubview.mm');
const marker = 'CB_BACK_GEOMETRY_DIAGNOSTIC_ONLY';
function install() {
let source = fs.readFileSync(target, 'utf8');
if (process.env.CB_BACK_GEOMETRY_DIAGNOSTIC !== '1') {
  if (source.includes(marker)) throw new Error('Diagnostic native source present outside diagnostic profile; restore dependencies before production.');
  return;
}
if (process.env.EAS_BUILD_PROFILE !== 'back-geometry-diagnostic') throw new Error('Diagnostic profile required.');
if (!source.includes('CB_IOS_BACK_ALIGNMENT_V2')) throw new Error('Build-9 patch must precede diagnostics.');
if (source.includes(marker)) return;
const commit = process.env.EAS_BUILD_GIT_COMMIT_HASH || execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
if (!/^[0-9a-f]{40}$/.test(commit)) throw new Error('Exact source commit required.');
function replaceOnce(from,to) {
  if (source.split(from).length !== 2) throw new Error('Diagnostic source anchor changed.');
  source = source.replace(from,to);
}
replaceOnce('@implementation RNSScreenStackHeaderSubview {', `// ${marker}\n#include "CBBackGeometry.inc"\n\n@implementation RNSScreenStackHeaderSubview {`);
replaceOnce('- (void)layoutSubviews\n{\n  [super layoutSubviews];', '- (void)layoutSubviews\n{\n  [super layoutSubviews];\n  if (self.type == RNSScreenStackHeaderSubviewTypeLeft) CBBackDidLayout(self);');
replaceOnce('    [self layoutNavigationBar];\n  }\n}\nRNS_IGNORE_SUPER_CALL_END', '    if (self.type == RNSScreenStackHeaderSubviewTypeLeft) CBFabricMetrics = @{ @"incoming": CBRect(frame), @"stored": CBRect(RCTCGRectFromRect(_layoutMetrics.frame)), @"elapsedSeconds": @(CACurrentMediaTime()-CBStarted) };\n    [self layoutNavigationBar];\n  }\n}\nRNS_IGNORE_SUPER_CALL_END');
replaceOnce('- (nullable UINavigationBar *)findNavigationBar', '- (void)didMoveToWindow\n{\n  [super didMoveToWindow];\n  if (self.type == RNSScreenStackHeaderSubviewTypeLeft) CBBackDidMount(self);\n}\n\n- (nullable UINavigationBar *)findNavigationBar');
const payload = fs.readFileSync(path.join(__dirname,'CBBackGeometry.inc'),'utf8').replace('__CB_SOURCE_COMMIT__',commit);
fs.writeFileSync(path.join(root,'ios/CBBackGeometry.inc'),payload);
fs.writeFileSync(target,source);
console.log('Back geometry diagnostic source SHA256:',crypto.createHash('sha256').update(source).digest('hex'));
console.log('Back geometry diagnostic payload SHA256:',crypto.createHash('sha256').update(payload).digest('hex'));

}
module.exports = { install };
if (require.main === module) install();
