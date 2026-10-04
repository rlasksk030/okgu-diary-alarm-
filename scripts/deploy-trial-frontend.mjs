import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';import {spawnSync,execFileSync} from 'node:child_process';
import {requireTrialBranch,cloudflareClient,verifyTrialData,trialDatabaseId} from './lib/trial-cloudflare.mjs';
requireTrialBranch();const api='https://okgu-diary-trial.rlasksk030.workers.dev',name='okgu-diary-pages-trial';
const mode=process.argv.includes('--legacy-sw')?'legacy':'current',c=cloudflareClient();await verifyTrialData(c,await trialDatabaseId());
try{const previous=await c.accountCall('GET','/workers/scripts/'+name+'/settings');if(!previous.bindings.some(x=>x.name==='TRIAL_FRONTEND'&&x.text==='synthetic-only')||previous.bindings.some(x=>['d1','r2_bucket','durable_object_namespace','secret_text'].includes(x.type)))throw new Error('E_FOREIGN_FRONTEND');}catch(e){if(e.status!==404)throw e;}
const run=spawnSync('node',['scripts/build-trial.mjs'],{env:{...process.env,OKGU_TRIAL_API_ORIGIN:api},stdio:'inherit'});if(run.status!==0)throw new Error('E_FRONTEND_BUILD');
for(const folder of ['.local/trial-frontend-web','.local/trial-frontend-web/okgu-diary-alarm-']){
 await mkdir(folder,{recursive:true});for(const file of ['index.html','manifest.json','sw.js','okgu_icon.png','rpc.js','fast-ui.js','student-pin.js','app-update.js','app-release.json','config.js'])await copyFile('trial-web/'+file,folder+'/'+file);
 if(mode==='legacy')await writeFile(folder+'/sw.js',execFileSync('git',['show','964985d3ff683617de18e89f71521f2c224d50f2:sw.js']));
 // Revalidate HTML/JS/SW on refresh; this is a trial Worker setting, not a Pages claim.
 await writeFile(folder+'/_headers','/*\n  Cache-Control: no-cache\n');
}
const config={name,main:'../worker/trial-frontend.ts',compatibility_date:'2026-10-02',account_id:c.account,workers_dev:true,preview_urls:false,assets:{directory:'trial-frontend-web',binding:'ASSETS',run_worker_first:['/api/*']},vars:{TRIAL_FRONTEND:'synthetic-only'},triggers:{crons:[]},observability:{enabled:false}};
await writeFile('.local/trial-frontend.json',JSON.stringify(config,null,2)+'\n',{mode:0o600});
const deployed=spawnSync('node',['node_modules/wrangler/bin/wrangler.js','deploy','--config','.local/trial-frontend.json'],{stdio:'inherit',env:{...process.env,WRANGLER_SEND_METRICS:'false',XDG_CONFIG_HOME:process.env.XDG_CONFIG_HOME||'/tmp/okgu-wrangler-config'}});if(deployed.status!==0)throw new Error('E_FRONTEND_DEPLOY');console.log('Independent synthetic frontend deployed; SW mode:',mode);
