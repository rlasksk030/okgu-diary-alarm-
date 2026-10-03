import WebSocket from 'ws';import {HttpsProxyAgent} from 'https-proxy-agent';
import {randomUUID} from 'node:crypto';import {mkdir,writeFile} from 'node:fs/promises';
import {cloudflareClient,trialDatabaseId,verifyTrialData,requireTrialBranch,trialNames} from './lib/trial-cloudflare.mjs';
import {hashPin,verifyPin} from '../worker/auth.ts';
requireTrialBranch();const client=cloudflareClient(),id=await trialDatabaseId();await verifyTrialData(client,id);
const origin='https://okgu-diary-trial.rlasksk030.workers.dev';
const health=await fetch(origin+'/api/health').then(r=>r.json());if(!health.ok||health.push!=='disabled')throw new Error('E_TRIAL_HEALTH');
const settings=await client.accountCall('GET','/workers/scripts/'+trialNames.worker+'/settings');
if(!settings.bindings.some(x=>x.name==='TEST_MODE'&&x.text==='synthetic-trial')||!settings.bindings.some(x=>x.name==='LOGIN_DIAGNOSTICS'&&x.text==='stage-only'))throw new Error('E_ENABLE_TRIAL_STAGE_DIAGNOSTICS');
const q=async(sql,params=[])=>{const r=await client.accountCall('POST','/d1/database/'+id+'/query',{sql,params});if(!r[0]?.success)throw new Error('E_TRIAL_QUERY');return r[0];};
// Preserve the public synthetic PIN, strengthen one existing virtual credential
// offline to distinguish first-login upgrade from subsequent KDF verification.
const row=(await q("SELECT c.account_id,c.pin_hash FROM credentials c JOIN accounts a ON a.id=c.account_id WHERE c.login_name=? AND a.legacy_identity=?",['시험학생13','synthetic-load:13'])).results[0];
if(!row||!await verifyPin('0042',row.pin_hash))throw new Error('E_SYNTHETIC_CREDENTIAL_CHANGED');
let changedCount=0;if(row.pin_hash.startsWith('sha256$')){const next=await hashPin('0042');changedCount=(await q('UPDATE credentials SET pin_hash=? WHERE account_id=? AND pin_hash=?',[next,row.account_id,row.pin_hash])).meta.changes;if(changedCount!==1)throw new Error('E_SYNTHETIC_CREDENTIAL_RACE');}
else if(!row.pin_hash.startsWith('pbkdf2$600000$'))throw new Error('E_SYNTHETIC_CREDENTIAL_FORMAT');
const legacyRow=(await q("SELECT c.pin_hash FROM credentials c JOIN accounts a ON a.id=c.account_id WHERE c.login_name=? AND a.legacy_identity=?",['시험학생10','synthetic-load:10'])).results[0];if(!legacyRow)throw new Error('E_SYNTHETIC_CREDENTIAL_MISSING');
const hasLegacy=legacyRow.pin_hash.startsWith('sha256$');const names=['wrong-pin',hasLegacy?'legacy-upgrade':'pbkdf2-repeat-login','pbkdf2-verify'],cases=new Map(names.map(name=>[name+'-'+randomUUID(),name]));
const stages=new Set(['credential_read_begin','credential_read_done','pin_verify_begin','pin_verify_done','pin_upgrade_begin','pin_upgrade_done','session_create_begin','session_create_done','conflict_verify_begin','conflict_verify_done','session_validate_done']);
const events=[],requests=[];let tail,socket,failure;
try{
 tail=await client.accountCall('POST','/workers/scripts/'+trialNames.worker+'/tails',{filters:[]});
 const u=new URL(tail.url);if(u.protocol!=='wss:'||u.hostname!=='tail.developers.workers.dev')throw new Error('E_TAIL_DESTINATION');
 const proxy=process.env.HTTPS_PROXY||process.env.HTTP_PROXY;
 socket=new WebSocket(tail.url,'trace-v1',{...(proxy?{agent:new HttpsProxyAgent(proxy)}:{}),handshakeTimeout:15000});
 socket.on('message',bytes=>{try{const e=JSON.parse(bytes.toString()),eventURL=new URL(e.event?.request?.url),tag=eventURL.searchParams.get('trial_cpu_case'),internal=eventURL.hostname==='kdf.internal'&&eventURL.pathname==='/derive';if(!cases.has(tag)&&!internal)return;const safeStages=(e.logs||[]).flatMap(log=>log.message?.[0]==='login_stage'&&stages.has(log.message[1])?[log.message[1]]:[]);const stageTimings=(e.logs||[]).flatMap(log=>{if(log.message?.[0]!=='login_stage'||!stages.has(log.message[1]))return [];const at=typeof log.timestamp==='number'?log.timestamp:Date.parse(log.timestamp);return Number.isFinite(at)?[{stage:log.message[1],atMs:at}]:[];});events.push({stageTimings,case:internal?'internal-kdf':cases.get(tag),engines:(e.logs||[]).flatMap(log=>log.message?.[0]==='kdf_engine'&&['native','fallback','fallback-sync'].includes(log.message[1])?[log.message[1]]:[]),outcome:['ok','exception','exceededCpu','exceededMemory','canceled'].includes(e.outcome)?e.outcome:'unknown',stages:safeStages,...(typeof e.cpuTime==='number'?{cpuTimeMs:e.cpuTime}:{}),...(typeof e.wallTime==='number'?{wallTimeMs:e.wallTime}:{})});}catch{}});
 await new Promise((resolve,reject)=>{socket.once('open',resolve);socket.once('error',()=>reject(new Error('E_TAIL_CONNECT')));});
 await new Promise((resolve,reject)=>socket.send(JSON.stringify({debug:false}),error=>error?reject(new Error('E_TAIL_HANDSHAKE')):resolve()));
 await new Promise(resolve=>setTimeout(resolve,1000));
 for(const [tag,name] of cases){
  const started=performance.now();const r=await fetch(origin+'/api/rpc?trial_cpu_case='+tag,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','X-OKGU-Request':'1'},body:JSON.stringify({method:'login',args:[name==='pbkdf2-verify'?'시험학생13':'시험학생10',name==='wrong-pin'?'wrong':'0042',false]}),signal:AbortSignal.timeout(30000)});
  const text=await r.text();let value;try{value=JSON.parse(text);}catch{}
  requests.push({case:name,httpStatus:r.status,durationMs:Math.round(performance.now()-started),hasToken:!!value?.token,cpuError1102:/error\s*(?:code\s*)?1102/i.test(text),...(value?.code==='E_AUTH'?{code:'E_AUTH'}:{}),cfRay:r.headers.get('cf-ray')});
 }
 const until=Date.now()+10000;while(events.filter(x=>x.case!=='internal-kdf').length<3&&Date.now()<until)await new Promise(r=>setTimeout(r,100));
}catch(e){failure={code:/^E_[A-Z_]+$/.test(e.message)?e.message:'E_TRACE_FAILED'};}
finally{socket?.terminate();if(tail)await client.accountCall('DELETE','/workers/scripts/'+trialNames.worker+'/tails/'+tail.id);}
const report={at:new Date().toISOString(),origin,environment:'actual deployed Cloudflare Free trial; no Paid activation',measurementLocation:'Codex cloud via configured proxy; TLS verification enabled',credentialPreparation:{accountAlias:'synthetic-load:13',hash:'PBKDF2-HMAC-SHA256 600000',samePublicSyntheticPin:true,changedCount},requests,events,tailDeleted:true,tailComplete:events.filter(x=>x.case!=='internal-kdf').length===3,allLoginSucceeded:requests.filter(x=>x.case!=='wrong-pin').every(x=>x.httpStatus===200&&x.hasToken)&&requests.length===3,...(failure?{failure}:{}),limitations:['Wall request durations are not CPU timings or successful login speed','Tail outcome and last completed stage locate the failure; CPU milliseconds only if provided by tail','No tokens, PINs, credential hashes, signed tail URLs, headers or raw events are stored','Synthetic fixture seed upload is separate from authenticated app photo-save verification']};
await mkdir('artifacts',{recursive:true});await writeFile('artifacts/cloudflare-login-stage-20261003.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));if(failure||!events.some(x=>x.case!=='internal-kdf')||!report.allLoginSucceeded)process.exitCode=1;
