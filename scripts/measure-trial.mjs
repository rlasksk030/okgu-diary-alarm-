import {readFile,mkdir,writeFile} from 'node:fs/promises';import {spawnSync} from 'node:child_process';
import {requireTrialBranch} from './lib/trial-cloudflare.mjs';
requireTrialBranch();
let saved;try{saved=JSON.parse(await readFile('.local/trial-deployment.json','utf8'));}catch{}
const origin=process.env.OKGU_TRIAL_API_ORIGIN||saved?.origin;
if(!origin||!/^https:\/\/[a-z0-9.-]+$/.test(origin)||origin==='https://rlasksk030.github.io')throw new Error('E_REMOTE_TRIAL_ORIGIN: actual verified HTTPS trial URL required; refuses local/operating Pages');
const response=await fetch(origin+'/api/health',{signal:AbortSignal.timeout(30000)});const health=await response.json();if(!response.ok||health.push!=='disabled'||health.runtime!=='Cloudflare Workers'||health.storage!=='D1 + private R2')throw new Error('E_TRIAL_HEALTH');
const frontend=process.env.OKGU_TRIAL_FRONTEND_ORIGIN||origin;
if(!/^https:\/\/[a-z0-9.-]+$/.test(frontend)||frontend==='https://rlasksk030.github.io')throw new Error('E_REMOTE_TRIAL_FRONTEND: operating Pages is excluded');
const configResponse=await fetch(frontend+'/okgu-diary-alarm-/config.js',{signal:AbortSignal.timeout(30000)}),configSource=await configResponse.text();
if(!configResponse.ok||!configSource.includes('window.OKGU_CONFIG')||/localhost|127\.0\.0\.1/.test(configSource))throw new Error('E_REMOTE_STATIC_LOOPBACK: rebuild trial assets before deployment');
const env={...process.env,OKGU_TRIAL_API_ORIGIN:origin,NODE_USE_ENV_PROXY:'1'};
const steps=[];for(const script of ['test','test:browser','test:load','profile:login','test:load:browser']){const result=spawnSync('npm',['run',script],{env,stdio:'inherit'});steps.push({script,exitCode:result.status,signal:result.signal});if(result.status!==0&&script!=='test:load')break;}
// test:load's target miss remains a failure; continue diagnosis/browser measurements without hiding it.
const report={time:new Date().toISOString(),origin,appURL:origin+'/okgu-diary-alarm-/',environment:'actual Cloudflare HTTPS trial',measurementLocation:'Codex cloud through its configured HTTPS proxy; not a student device network',cfRay:response.headers.get('cf-ray'),steps,allChecksPassed:steps.length===5&&steps.every(s=>s.exitCode===0)};
await mkdir('artifacts',{recursive:true});await writeFile('artifacts/cloudflare-trial-run.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));if(!report.allChecksPassed)process.exitCode=1;
