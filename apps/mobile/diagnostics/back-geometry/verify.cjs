if (process.env.CB_BACK_GEOMETRY_DIAGNOSTIC === '1') {
  const fs = require('node:fs');
  const path = require('node:path');
  const crypto = require('node:crypto');
  const root = path.dirname(require.resolve('react-native-screens/package.json'));
  for (const file of ['RNSScreenStackHeaderSubview.mm','CBBackGeometry.inc','CBBackTrace.inc']) {
    const source = fs.readFileSync(path.join(root,'ios',file),'utf8');
    if (!source.includes(file.endsWith('.mm') ? 'CB_BACK_RESIZE_TRACE_V2' : file === 'CBBackGeometry.inc' ? process.env.EAS_BUILD_GIT_COMMIT_HASH : 'CBTraceReport')) throw new Error('Diagnostic compiled source provenance missing.');
    console.log('POST-BUILD geometry source',file,crypto.createHash('sha256').update(source).digest('hex'));
  }
}
