// Read-only, encrypted capture of the dedicated synthetic trial. Never production.
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {requireTrialBranch,cloudflareClient,trialDatabaseId,verifyTrialData,trialNames} from './lib/trial-cloudflare.mjs';
import {capture,verifyObjects,fingerprint} from '../migration/backup.ts';
import {sealSnapshot} from '../migration/snapshot.ts';
// Provider/SQL errors can contain data: emit a closed, safe category only.
process.on('uncaughtException',error=>{const code=error instanceof Error?error.message.match(/\b(?:E_[A-Z_]+|BACKUP_[A-Z_]+)\b/)?.[0]:null;process.stderr.write('backup_failure '+(code||'UNCLASSIFIED')+' '+(error?.constructor?.name||'Unknown')+' '+(typeof error?.code==='string'&&/^[A-Z_]+$/.test(error.code)?error.code:'')+'\n');process.exitCode=1;});
requireTrialBranch();
if(!/^[a-f0-9]{64}$/i.test(process.env.OKGU_BACKUP_KEY||''))throw Error('E_BACKUP_KEY: supply securely, never in chat or command arguments');
const origin='https://okgu-diary-trial.rlasksk030.workers.dev',client=cloudflareClient(),id=await trialDatabaseId();
console.log('backup_stage provenance');await verifyTrialData(client,id);console.log('backup_stage provenance_done');
async function frozen(){const h=await fetch(origin+'/api/health?backup='+Date.now(),{cache:'no-store'}).then(r=>r.json());if(h.push!=='disabled')throw Error('E_BACKUP_PUSH_STATE');const lock=await client.accountCall('POST','/d1/database/'+id+'/query',{sql:'SELECT writes_paused FROM operation_control WHERE id=1'});if(!lock[0]?.success||lock[0].results[0]?.writes_paused!==1)throw Error('E_BACKUP_REQUIRES_D1_BARRIER');}
console.log('backup_stage freeze');await frozen();console.log('backup_stage freeze_done');
console.log('backup_stage config');const config=JSON.parse(await readFile('.wrangler-trial.json','utf8'));
if(config.name!==trialNames.worker||config.d1_databases[0].database_id!==id||config.r2_buckets[0].bucket_name!==trialNames.bucket)throw Error('E_BACKUP_CONFIG');
console.log('backup_stage config_done');const privateFolder='.local/remote-trial-backups/'+Date.now();await mkdir(privateFolder,{recursive:true,mode:0o700});
const query=async sql=>{const result=await client.accountCall('POST','/d1/database/'+id+'/query',{sql});if(!result[0]?.success)throw Error('E_REMOTE_D1_READ');return {results:result[0].results};};
// Administrative D1 lock + end comparison supply consistency here, not one
// Worker batch transaction. No signed export URL or unencrypted SQL file.
const DB={prepare(sql){return {all:()=>query(sql)};},async batch(statements){const rows=[];for(const statement of statements)rows.push(await statement.all());return rows;}};
 const r2={async get(path){const url='https://api.cloudflare.com/client/v4/accounts/'+client.account+'/r2/buckets/'+trialNames.bucket+'/objects/'+path.split('/').map(encodeURIComponent).join('/');const r=await fetch(url,{headers:{Authorization:'Bearer '+process.env.CLOUDFLARE_API_TOKEN},signal:AbortSignal.timeout(30000)});if(!r.ok)throw Error('E_REMOTE_R2_READ: HTTP '+r.status);const bytes=await r.arrayBuffer();return {arrayBuffer:async()=>bytes,httpMetadata:{contentType:r.headers.get('Content-Type')||'application/octet-stream'}};}};
 const backup=await capture(DB,r2);verifyObjects(backup);await frozen();
 // Recheck every table, catching intervening administrative writes as well as app writes.
 for(const [table,rows] of Object.entries(backup.rows)){const quoted='"'+table.replace(/"/g,'""')+'"',response=await client.accountCall('POST','/d1/database/'+id+'/query',{sql:'SELECT * FROM '+quoted});if(!response[0]?.success||fingerprint(response[0].results)!==fingerprint(rows))throw Error('E_BACKUP_DATABASE_CHANGED');const count=await client.accountCall('POST','/d1/database/'+id+'/query',{sql:'SELECT COUNT(*) n FROM '+quoted});if(!count[0]?.success||Number(count[0].results[0]?.n)!==rows.length)throw Error('E_BACKUP_ROWS_TRUNCATED');}
 const file=privateFolder+'/current.enc';await writeFile(file,JSON.stringify(sealSnapshot(backup,Buffer.from(process.env.OKGU_BACKUP_KEY,'hex'))),{mode:0o600,flag:'wx'});
 const summary={at:new Date().toISOString(),syntheticOnly:true,readOnly:true,format:backup.format,tables:Object.keys(backup.rows).length,photos:backup.photos.length,complete:true,limitations:['Frozen D1 API reads + all-table end comparison, paused application and immutable R2 objects; administrators must not write during capture','No real student source, production binding change or original Sheets/Drive backup']};
 await writeFile(privateFolder+'/summary.json',JSON.stringify(summary,null,2)+'\n',{mode:0o600});
 console.log(JSON.stringify({file,...summary}));
