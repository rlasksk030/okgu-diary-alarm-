import {mkdir,writeFile} from 'node:fs/promises';import {spawnSync} from 'node:child_process';
import {requireTrialBranch,cloudflareClient,provisionTrial,saveTrialResources} from './lib/trial-cloudflare.mjs';
requireTrialBranch();
const client=cloudflareClient();const resources=await provisionTrial(client,{existingId:process.env.OKGU_TRIAL_D1_DATABASE_ID});await saveTrialResources(resources);
const env={...process.env,OKGU_TRIAL_D1_DATABASE_ID:resources.databaseId,OKGU_ALLOW_SYNTHETIC_TRIAL_SEED:'yes',NODE_USE_ENV_PROXY:'1',WRANGLER_SEND_METRICS:'false',XDG_CONFIG_HOME:process.env.XDG_CONFIG_HOME||'/tmp/okgu-wrangler-config'};
function run(script,args=[]){const result=spawnSync('npm',['run',script,...args],{env,stdio:'inherit'});if(result.status!==0)throw new Error('Trial launch stopped at '+script+'; do not activate paid billing automatically');}
run('deploy:trial');run('seed',['--','--remote']);
const subdomain=await client.accountCall('GET','/workers/subdomain');if(!/^[a-z0-9-]+$/.test(subdomain.subdomain||''))throw new Error('E_WORKERS_DEV_SUBDOMAIN: use the actual deployment URL from Cloudflare; no URL guessed');
const origin=process.env.OKGU_TRIAL_API_ORIGIN||'https://'+resources.worker+'.'+subdomain.subdomain+'.workers.dev';
const response=await fetch(origin+'/api/health',{signal:AbortSignal.timeout(30000)});const health=await response.json();if(!response.ok||health.runtime!=='Cloudflare Workers'||health.storage!=='D1 + private R2'||health.push!=='disabled')throw new Error('E_TRIAL_HEALTH: launch not verified');
const report={format:1,origin,appURL:origin+'/okgu-diary-alarm-/',verifiedAt:new Date().toISOString(),health,syntheticOnly:true,accounts:{students:'시험학생01~13',teacher:'가상교사',PIN:'0042'},measureCommand:'npm run trial:measure'};
await mkdir('.local',{recursive:true});await writeFile('.local/trial-deployment.json',JSON.stringify(report,null,2)+'\n',{mode:0o600});console.log(JSON.stringify(report,null,2));
