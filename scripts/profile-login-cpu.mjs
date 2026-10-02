import {login,hashPin} from '../worker/auth.ts';
import {database} from '../tests/helpers/d1.mjs';
import {createHash} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
const realCrypto=globalThis.crypto,original=Object.getOwnPropertyDescriptor(globalThis,'crypto');
const limitedSubtle=new Proxy(realCrypto.subtle,{get(target,key){if(key==='deriveBits')return async()=>{throw new DOMException('Pbkdf2 failed: iteration counts above 100000 are not supported (requested 600000).','NotSupportedError');};const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;}});
const limitedCrypto={subtle:limitedSubtle,getRandomValues:realCrypto.getRandomValues.bind(realCrypto),randomUUID:realCrypto.randomUUID.bind(realCrypto)};
const legacy='sha256$synthetic-only$'+createHash('sha256').update('synthetic-only|0042').digest('base64');
const strong=await hashPin('0042'),samples=[];
try{for(const mode of ['native-pbkdf2','fallback-legacy-upgrade','fallback-pbkdf2-verify','wrong-legacy-pin'])for(let i=0;i<3;i++){
 Object.defineProperty(globalThis,'crypto',{configurable:true,value:mode.startsWith('fallback')?limitedCrypto:realCrypto});
 const db=await database();db.sqlite.exec("INSERT INTO classes VALUES('c','가상반');INSERT INTO accounts(id,legacy_identity,display_name,class_id,role) VALUES('a','synthetic:a','가상로그인','c','student')");db.sqlite.prepare('INSERT INTO credentials VALUES(?,?,?)').run('a','가상로그인',mode.includes('legacy')?legacy:strong);
 const begin=performance.now(),cpu=process.cpuUsage(),stages=[];
 const observe=stage=>{const use=process.cpuUsage(cpu);stages.push({stage,wallMs:+(performance.now()-begin).toFixed(3),processCpuMs:+((use.user+use.system)/1000).toFixed(3)});};
 let outcome;try{await login({DB:db.DB},'가상로그인',mode==='wrong-legacy-pin'?'wrong':'0042',false,observe);outcome='authenticated';}catch(e){outcome=e.code||'unexpected';}finally{db.close();}
 const use=process.cpuUsage(cpu);const intervals=[];
 for(const [label,start,end] of [['D1_credentials','credential_read_begin','credential_read_done'],['PIN_verify','pin_verify_begin','pin_verify_done'],['PIN_upgrade','pin_upgrade_begin','pin_upgrade_done'],['session_create','session_create_begin','session_create_done'],['session_revalidate','session_create_done','session_validate_done']]){const a=stages.find(x=>x.stage===start),b=stages.find(x=>x.stage===end);if(a&&b)intervals.push({label,wallMs:+(b.wallMs-a.wallMs).toFixed(3),processCpuMs:+(b.processCpuMs-a.processCpuMs).toFixed(3)});}
 samples.push({mode,outcome,wallMs:+(performance.now()-begin).toFixed(3),processCpuMs:+((use.user+use.system)/1000).toFixed(3),stages,intervals});
}}finally{if(original)Object.defineProperty(globalThis,'crypto',original);else delete globalThis.crypto;}
const report={at:new Date().toISOString(),environment:'Codex cloud Node process + synthetic SQLite D1 adapter; NOT deployed Worker CPU',hash:'PBKDF2-HMAC-SHA256 600000, unchanged',conditions:'Sequential samples, no other test suite; fallback forced by native-cap shim only in this process; full login, no authentication bypass',samples,limitations:['process.cpuUsage covers the Node process/native threads; not Cloudflare billed CPU','SQLite timings are not remote D1 network latency','No tokens, credential hashes or PIN values are stored']};
await mkdir('artifacts',{recursive:true});await writeFile('artifacts/login-cpu-profile-20261003.json',JSON.stringify(report,null,2)+'\n');
for(const mode of new Set(samples.map(x=>x.mode))){const xs=samples.filter(x=>x.mode===mode);console.log(JSON.stringify({mode,processCpuMs:xs.map(x=>x.processCpuMs),wallMs:xs.map(x=>x.wallMs),intervals:xs[0].intervals}));}
