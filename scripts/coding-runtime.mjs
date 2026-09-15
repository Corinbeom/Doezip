import {mkdirSync,copyFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(new URL('../apps/web/package.json',import.meta.url));
const version=require('@jitl/quickjs-wasmfile-release-sync/package.json').version;
if(version!=='0.32.0')throw new Error('Update the versioned WASM URL together with the runtime package.');
const output=new URL('../apps/web/public/coding-runtime/',import.meta.url);
mkdirSync(output,{recursive:true});
copyFileSync(require.resolve('@jitl/quickjs-wasmfile-release-sync/wasm'),new URL(`quickjs-${version}.wasm`,output));
console.log(`Prepared QuickJS ${version} WASM asset.`);
