import {readFile,mkdir,writeFile,realpath} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {d1Import} from '../migration/d1.ts';
import {stableId} from '../migration/core.ts';
const fixture=JSON.parse(await readFile('fixtures/snapshot.json','utf8'));if(fixture.synthetic!==true)throw new Error('Only synthetic fixtures are allowed');
const remote=process.argv.includes('--remote');if(remote&&process.env.OKGU_ALLOW_SYNTHETIC_TRIAL_SEED!=='yes')throw new Error('Remote synthetic trial seed requires OKGU_ALLOW_SYNTHETIC_TRIAL_SEED=yes');
const config=remote?'.wrangler-trial.json':'wrangler.jsonc';
if(remote){const parsed=JSON.parse(await readFile(config,'utf8'));if(parsed.name!=='okgu-diary-trial'||parsed.d1_databases[0].database_name!=='okgu-diary-trial')throw new Error('Trial resource only');}
const run=args=>{const p=spawnSync('node',['node_modules/wrangler/bin/wrangler.js',...args],{stdio:'inherit',env:{...process.env,WRANGLER_SEND_METRICS:'false',XDG_CONFIG_HOME:process.env.XDG_CONFIG_HOME||'/tmp/okgu-wrangler-config'}});if(p.status!==0)throw new Error('Wrangler step failed');};
run(['d1','migrations','apply','DB',remote?'--remote':'--local','--config',config,'--persist-to','.local/cloudflare']);
let {sql}=d1Import(fixture);const quote=v=>"'"+v.replace(/'/g,"''")+"'";
const hash='sha256$synthetic-trial-only$'+createHash('sha256').update('synthetic-trial-only|0042').digest('base64');
for(let i=1;i<=13;i++){const id=stableId('synthetic-load','account',String(i)),name='시험학생'+String(i).padStart(2,'0');sql+=`INSERT INTO accounts(id,legacy_identity,display_name,class_id,role) VALUES(${quote(id)},${quote('synthetic-load:'+i)},${quote(name)},${quote(fixture.classId)},'student') ON CONFLICT DO NOTHING;\nINSERT INTO credentials(account_id,login_name,pin_hash) VALUES(${quote(id)},${quote(name)},${quote(hash)}) ON CONFLICT DO NOTHING;\n`;}
await mkdir('.local',{recursive:true});await writeFile('.local/synthetic-seed.sql',sql,{mode:0o600});run(['d1','execute','DB',remote?'--remote':'--local','--config',config,'--persist-to','.local/cloudflare','--file','.local/synthetic-seed.sql']);
for(const f of fixture.files){const bytes=await readFile('fixtures/'+f.path);if(createHash('sha256').update(bytes).digest('hex')!==f.sha256||bytes.length!==f.size)throw new Error('Fixture photo checksum mismatch');run(['r2','object','put','okgu-diary-trial-private/migration/'+f.sha256,remote?'--remote':'--local','--config',config,'--persist-to','.local/cloudflare','--file','fixtures/'+f.path,'--content-type',f.mime]);}
console.log('Synthetic D1 + private R2 seed complete; no real data or live push subscriptions.');
