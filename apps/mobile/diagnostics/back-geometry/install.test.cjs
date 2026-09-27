const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const screens = path.dirname(require.resolve('react-native-screens/package.json'));
const original = fs.readFileSync(path.join(screens,'ios/RNSScreenStackHeaderSubview.mm'),'utf8');
const script = fs.readFileSync(path.join(__dirname,'install.cjs'),'utf8');
const payload = fs.readFileSync(path.join(__dirname,'CBBackGeometry.inc'),'utf8');
function run(env, input=original) {
  const writes = new Map();
  const fakeFs = { readFileSync: p => p.endsWith('.inc') ? payload : input, writeFileSync: (p,v) => writes.set(p,v) };
  const req = n => n === 'node:fs' ? fakeFs : require(n);
  req.resolve = require.resolve;
  const module = { exports: {} };
  vm.runInNewContext(script,{require:req,module,__dirname,process:{env},console:{log() {}}});
  module.exports.install();
  return writes;
}
test('production installation never writes diagnostics and rejects contaminated dependencies',()=>{
  assert.equal(run({}).size,0);
  assert.throws(()=>run({},original+'CB_BACK_GEOMETRY_DIAGNOSTIC_ONLY'),/outside diagnostic profile/);
  assert.throws(()=>run({CB_BACK_GEOMETRY_DIAGNOSTIC:'1'}),/profile required/);
});
test('diagnostic hooks preserve build-9 implementation and are idempotent',()=>{
  const env={CB_BACK_GEOMETRY_DIAGNOSTIC:'1',EAS_BUILD_PROFILE:'back-geometry-diagnostic',EAS_BUILD_GIT_COMMIT_HASH:'a'.repeat(40)};
  const writes=run(env); assert.equal(writes.size,2);
  const native=[...writes].find(([p])=>p.endsWith('.mm'))[1];
  assert.match(native,/CBBackDidMount\(self\)/);
  assert.match(native,/CBBackDidLayout\(self\)/);
  assert.match(native,/CBFabricMetrics =/);
  assert.equal(run(env,native).size,0);
  for (const method of ['cb_centeredBackBarItemView','intrinsicContentSize']) {
    const start=original.indexOf(method+'\n{');
    assert.ok(start>0);
    const end=original.indexOf('\n}\n',start)+3;
    assert.ok(native.includes(original.slice(start,end)));
  }
});
test('export omits text and identity; captures actual rendered paint and coordinate spaces',()=>{
  assert.doesNotMatch(payload,/@"(?:text|attributedText|accessibilityLabel|userId|token|calories)"\s*:/);
  assert.match(payload,/text.length != 1/);
  assert.match(payload,/characterAtIndex:0\] != 0xf229/);
  for(const key of ['windowCenter','alignmentRectInsets','paintBoundsWindow','fabricMetrics','barButtonCustomViewId','constraints']) assert.ok(payload.includes('@"'+key+'"'));
  assert.doesNotMatch(payload,/setFrame:|setBounds:|setTransform:|setNeedsLayout|layoutIfNeeded/);
});
test('isolated routes import no account/provider/API code and reuse unchanged Back component',()=>{
  const root=path.resolve(__dirname,'../../diagnostic-app');
  const files=fs.readdirSync(root,{recursive:true}).filter(p=>p.endsWith('.tsx'));
  for(const f of files) assert.doesNotMatch(fs.readFileSync(path.join(root,f),'utf8'),/clerk|fetch\(|lib\/api|healthkit|health-connect|lifecycle/);
  assert.match(fs.readFileSync(path.join(root,'(settings)/_layout.tsx'),'utf8'),/NavigationBackButton fallback="\/settings"/);
});
