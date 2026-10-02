import {requireTrialBranch,trialDatabaseId,cloudflareClient,verifyTrialData} from './lib/trial-cloudflare.mjs';
import {readFile,writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
requireTrialBranch();
const id=await trialDatabaseId();
if(!id||!/^[0-9a-f-]{36}$/i.test(id)||/^00000000-/.test(id))throw new Error('Set the dedicated trial D1 database ID in Cloudflare Build variables.');
const api=process.env.OKGU_TRIAL_API_ORIGIN||'';
if(api&&(!/^https:\/\/[a-z0-9.-]+$/.test(api)||api==='https://rlasksk030.github.io'))throw new Error('Use a dedicated HTTPS trial API origin');
const frontend=process.env.OKGU_TRIAL_FRONTEND_ORIGIN||'';
if(frontend&&(!/^https:\/\/[a-z0-9.-]+$/.test(frontend)||frontend==='https://rlasksk030.github.io'))throw new Error('Use a separate trial frontend origin; operating Pages is excluded until approval.');
const config=JSON.parse(await readFile('wrangler.jsonc','utf8'));config.d1_databases[0].database_id=id;config.vars.WEB_ORIGINS=[api,frontend].filter(Boolean).join(',');config.vars.APP_URL=(frontend||api||'')+'/okgu-diary-alarm-/';
// Same-origin trial UI is allowed automatically by the handler; no production origin added.
config.vars.PUSH_MODE='disabled';config.vars.TEST_MODE='synthetic-trial';config.triggers.crons=[];if(process.env.CLOUDFLARE_ACCOUNT_ID)config.account_id=process.env.CLOUDFLARE_ACCOUNT_ID;
await writeFile('.wrangler-trial.json',JSON.stringify(config,null,2)+'\n',{mode:0o600});
if(process.argv.includes('--prepare-only')){console.log('Trial-only config prepared; no remote changes.');process.exit(0);}
// Inspect actual remote D1 metadata/provenance before any migration write.
await verifyTrialData(cloudflareClient(),id);
const run=args=>{const p=spawnSync('node',['node_modules/wrangler/bin/wrangler.js',...args],{stdio:'inherit',env:{...process.env,WRANGLER_SEND_METRICS:'false',XDG_CONFIG_HOME:process.env.XDG_CONFIG_HOME||'/tmp/okgu-wrangler-config'}});if(p.status!==0)process.exit(p.status||1);};
run(['d1','migrations','apply','DB','--remote','--config','.wrangler-trial.json']);
run(['deploy','--config','.wrangler-trial.json']);
