// Preparation only. This cannot import student data or open production writes/push.
import {readFile} from 'node:fs/promises';import {spawnSync} from 'node:child_process';
import {requireTrialBranch,cloudflareClient} from './lib/trial-cloudflare.mjs';
try{
 requireTrialBranch();const r=JSON.parse(await readFile('.local/production-resources.private.json'));
 if(r.databaseName!=='okgu-diary-production'||r.bucketName!=='okgu-diary-production-private'||!/^[a-f0-9-]{36}$/i.test(r.databaseId))throw Error('E_PRODUCTION_RESOURCES');
 const client=cloudflareClient();if((await client.accountCall('GET','/d1/database/'+r.databaseId)).name!==r.databaseName)throw Error('E_PRODUCTION_DATABASE');
 const env={...process.env,OKGU_PRODUCTION_API_ORIGIN:r.apiOrigin,OKGU_PRODUCTION_D1_DATABASE_ID:r.databaseId,WRANGLER_SEND_METRICS:'false',XDG_CONFIG_HOME:process.env.XDG_CONFIG_HOME||'/tmp/okgu-wrangler-config'};
 const run=(script,args=[])=>{const p=spawnSync(process.execPath,[script,...args],{env,stdio:'pipe'});if(p.status!==0)throw Error('E_PRODUCTION_COMMAND');};
 run('scripts/prepare-production-candidate.mjs');run('scripts/verify-production-candidate.mjs');
 const config='.local/production-candidate/wrangler.production.json',c=JSON.parse(await readFile(config));
 if(c.vars.WRITE_MODE!=='paused'||c.vars.PUSH_MODE!=='disabled'||c.triggers.crons.length||c.assets||c.vars.TEST_MODE)throw Error('E_PRODUCTION_UNSAFE_CONFIG');
 run('node_modules/wrangler/bin/wrangler.js',['d1','migrations','apply','DB','--remote','--config',config]);
 const locked=await client.accountCall('POST','/d1/database/'+r.databaseId+'/query',{sql:'UPDATE operation_control SET writes_paused=1 WHERE id=1;SELECT writes_paused FROM operation_control WHERE id=1;'});
 if(!locked.every(x=>x.success)||locked.at(-1).results[0]?.writes_paused!==1)throw Error('E_PRODUCTION_BARRIER');
 run('node_modules/wrangler/bin/wrangler.js',['deploy','--config',config]);
 console.log('Paused production API deployed. D1 barrier=1, push disabled, cron0. Existing Pages and GAS unchanged.');
}catch(e){console.error(e?.message?.match(/\bE_[A-Z_]+\b/)?.[0]||'E_PRODUCTION_PAUSED_DEPLOY');process.exitCode=1;}
