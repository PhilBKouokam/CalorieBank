// A separate browser entry: never imported by Expo Router or a production entry.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const esbuild = require('esbuild');
if (process.versions.node.split('.')[0] !== '20') throw new Error('Use repository-pinned Node 20 (nvm use).');
const root = path.resolve(__dirname, '../..');
// Optional reviewed synthetic fixture entry for an isolated feature worktree.
// This runner is development-only; the same transport rejection and CSP apply.
const entry = process.env.CALORIEBANK_PLAYGROUND_ENTRY
  ? path.resolve(process.env.CALORIEBANK_PLAYGROUND_ENTRY) : path.join(__dirname, 'preview.tsx');
const output = fs.mkdtempSync(path.join(os.tmpdir(), 'caloriebank-playground-'));
const stub = path.join(__dirname, 'api-stub.ts');
const port = Number(process.env.CALORIEBANK_PLAYGROUND_PORT || 4173);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Use a playground port from 1024 through 65535.');
const nativeProxy = `import React from 'react'; import * as RN from 'react-native-web'; export * from 'react-native-web';
const scale=new URLSearchParams(location.search).get('scale')==='2'?2:1;
const scaled=style=>{const flat=RN.StyleSheet.flatten(style)||{};return {...flat,...(flat.fontSize?{fontSize:flat.fontSize*scale}:{}),...(flat.lineHeight?{lineHeight:flat.lineHeight*scale}:{})};};
export const Text=React.forwardRef((props,ref)=><RN.Text {...props} ref={ref} style={props.allowFontScaling===false?props.style:scaled(props.style)}/>);
export const TextInput=React.forwardRef((props,ref)=><RN.TextInput {...props} ref={ref} style={scaled(props.style)}/>);
export const useWindowDimensions=()=>({...RN.useWindowDimensions(),fontScale:scale});`;
const plugins = [{ name: 'synthetic-only', setup(build) {
  build.onResolve({filter:/^expo-router$/},()=>({path:'router-stub',namespace:'router-stub'}));
  build.onLoad({filter:/.*/,namespace:'router-stub'},()=>({contents:"export const Link=({children})=>children;",loader:'jsx',resolveDir:root}));
  build.onResolve({filter:/^(react-native)$/},()=>({path:'native-proxy',namespace:'playground'}));
  build.onLoad({filter:/.*/,namespace:'playground'},()=>({contents:nativeProxy,loader:'jsx',resolveDir:root}));
  build.onResolve({filter:/^(@expo\/vector-icons|expo-web-browser)$/},args=>({path:args.path,namespace:'native-stub'}));
  build.onLoad({filter:/.*/,namespace:'native-stub'},args=>({contents:args.path==='expo-web-browser'?"export async function openBrowserAsync(){if(new URLSearchParams(location.search).get('state')==='error')throw new Error('Synthetic browser error');}":"import React from 'react';export const Ionicons=({size,name})=><span aria-hidden='true' style={{fontSize:size,width:size,display:'inline-block'}}>{name==='chevron-forward'?'›':'▤'}</span>;",loader:'jsx',resolveDir:root}));
  build.onResolve({filter:/AndroidKeyboardSafeScrollView$/},()=>({path:'web-scroll',namespace:'web-scroll'}));
  build.onLoad({filter:/.*/,namespace:'web-scroll'},()=>({contents:"export {ScrollView as AndroidKeyboardSafeScrollView} from 'react-native-web';",loader:'js',resolveDir:root}));
  build.onResolve({filter:/(client|settings-concurrency)$/},args=>{
    const resolved=args.path.startsWith('@/')?path.join(root,'apps/mobile',args.path.slice(2)):path.resolve(args.resolveDir,args.path);
    if([path.join(root,'apps/mobile/lib/api/client'),path.join(root,'apps/mobile/lib/api/settings-concurrency')].includes(resolved)) return {path:stub};
  });
}}];
(async()=>{
 const build=await esbuild.build({metafile:true,entryPoints:[entry],nodePaths:[path.join(root,'node_modules')],tsconfig:path.join(root,'apps/mobile/tsconfig.json'),bundle:true,outfile:path.join(output,'bundle.js'),jsx:'automatic',resolveExtensions:['.web.tsx','.tsx','.web.ts','.ts','.web.jsx','.jsx','.web.js','.js','.json'],alias:{'@':path.join(root,'apps/mobile')},define:{'process.env.NODE_ENV':'"development"'},plugins});
 if(Object.keys(build.metafile.inputs).some(file=>/apps\/mobile\/lib\/api\/(client|settings-concurrency)\.ts$/.test(file))) throw new Error('Unsafe real API transport in playground bundle');
 const html='<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src \'self\'; connect-src \'none\'; style-src \'self\' \'unsafe-inline\'; script-src \'self\'; font-src \'self\' data:"><title>CalorieBank synthetic playground</title><style>body{font-family:system-ui;margin:16px;background:#eee}header{max-width:850px}a,select{min-height:44px;display:inline-block;margin:4px}h1{font-size:22px}</style></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>';
 if(process.argv.includes('--check')) { console.log('Synthetic playground bundle passed (no server started).'); return; }
 const server=http.createServer((req,res)=>{if(req.url?.split('?')[0]==='/bundle.js'){res.setHeader('Content-Type','text/javascript');fs.createReadStream(path.join(output,'bundle.js')).pipe(res);}else{res.setHeader('Content-Type','text/html');res.end(html);}});
 server.listen(port,'127.0.0.1',()=>console.log(`Synthetic playground: http://127.0.0.1:${port} (Ctrl+C to stop)`));
})().catch(error=>{console.error(error);process.exitCode=1;});
