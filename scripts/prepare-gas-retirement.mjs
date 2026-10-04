// Produces a private deployment candidate. Requires Apps Script deployment access to apply.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {retireGas,guardedFunctions} from './lib/gas-retirement.mjs';
const source=await readFile(process.argv[2],'utf8');
const code=retireGas(source);
await mkdir('.local/gas-retirement',{recursive:true,mode:0o700});
await writeFile('.local/gas-retirement/Code.cloud-only.private.gs',code,{mode:0o600});
console.log(JSON.stringify({guardedFunctions:guardedFunctions.length,allHttpRpcBlocked:true,secretCopied:false,sourceRowsModified:false,deployed:false}));
