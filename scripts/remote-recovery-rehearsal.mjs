// Frozen remote synthetic backup -> separate LOCAL restore. No remote DB restore.
import {spawn} from 'node:child_process';
import {mkdir,readdir,readFile,writeFile} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import {openSnapshot} from '../migration/snapshot.ts';
import {requireTrialBranch} from './lib/trial-cloudflare.mjs';
requireTrialBranch();
const api='https://okgu-diary-trial.rlasksk030.workers.dev',front='https://okgu-diary-pages-trial.rlasksk030.workers.dev';
const env={...process.env,OKGU_TRIAL_API_ORIGIN:api,OKGU_TRIAL_FRONTEND_ORIGIN:front,OKGU_TRIAL_PAGES_CORS:'yes',OKGU_TRIAL_LOGIN_DIAGNOSTICS:''};
const run=(args,extra={})=>new Promise((resolve,reject)=>{let errors='',stage='';const p=spawn('node',args,{stdio:['ignore','pipe','pipe'],env:{...env,...extra}});p.stdout.on('data',b=>{stage=(b.toString().match(/backup_stage [a-z_]+/g)||[]).at(-1)||stage;});p.stderr.on('data',b=>{errors=(errors+b.toString()).slice(-8000);});p.once('error',()=>reject(Error('E_REHEARSAL_COMMAND')));p.once('close',code=>code===0?resolve():reject(Error('E_REHEARSAL_COMMAND: '+args.filter(a=>!a.startsWith('.local/')).join(' ')+'; exit='+code+' stage='+stage+'; '+(errors.match(/\bE_[A-Z_]+\b|\bBACKUP_[A-Z_]+\b|backup_failure [A-Z_]+ [A-Za-z]+(?: [A-Z_]+)?/g)||[]).join(','))));});
let paused=false;
try{
 paused=true;await run(['--use-env-proxy','scripts/trial-write-barrier.mjs','paused']);
 await run(['--use-env-proxy','scripts/deploy-trial.mjs'],{OKGU_TRIAL_WRITE_MODE:'paused'});
 const deadline=Date.now()+45000;while(true){const h=await fetch(api+'/api/health?recovery='+Date.now()).then(r=>r.json());if(h.writes==='paused')break;if(Date.now()>deadline)throw Error('E_REHEARSAL_NOT_FROZEN');await new Promise(r=>setTimeout(r,500));}
 const key=randomBytes(32);await mkdir('.local/remote-trial-backups',{recursive:true,mode:0o700});
 await writeFile('.local/remote-trial-backups/key-'+Date.now()+'.private',key.toString('hex'),{mode:0o600,flag:'wx'});
 const backupEnv={OKGU_BACKUP_KEY:key.toString('hex')};
 console.log('Reading frozen remote synthetic D1/R2 into encrypted private backup');
 await run(['--use-env-proxy','--import','tsx','scripts/backup-trial-remote.mjs'],backupEnv);
 const folder=(await readdir('.local/remote-trial-backups',{withFileTypes:true})).filter(d=>d.isDirectory()).map(d=>d.name).sort().at(-1);
 const file='.local/remote-trial-backups/'+folder+'/current.enc',backup=openSnapshot(JSON.parse(await readFile(file,'utf8')),key);
 // Earlier diagnostic attempts may also share the synthetic marker. Verify the
 // successful private-with-photo cases without treating every diagnostic as one.
 const newest=backup.rows.diaries.filter(d=>d.body.startsWith('가상 동결 재시도 ')&&d.visibility==='private'&&backup.rows.attachments.some(f=>f.diary_id===d.id));
 if(newest.length<2)throw Error('E_POST_SWITCH_RECORD_NOT_CAPTURED');
 console.log('Restoring encrypted CURRENT state into isolated local D1/R2');
 await run(['--import','tsx','scripts/restore-rehearsal.mjs',file],backupEnv);
 const result={at:new Date().toISOString(),success:true,syntheticOnly:true,backupSource:'actual paused Cloudflare trial D1/private R2',restoreTarget:'new isolated local workerd D1/R2',tables:Object.keys(backup.rows).length,photos:backup.photos.length,newWritesCaptured:newest.length,exactRowsRelationsObjects:true,sharedBarrierCaptured:true,remoteDatabaseWrites:'operation_control freeze flag only',remoteBindingRestore:false,productionSourceAccess:false,completeGasRollback:false};
 await mkdir('artifacts',{recursive:true});await writeFile('artifacts/remote-recovery-rehearsal.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
}finally{
 if(paused){await run(['--use-env-proxy','scripts/deploy-trial.mjs'],{OKGU_TRIAL_WRITE_MODE:'active'});await run(['--use-env-proxy','scripts/trial-write-barrier.mjs','active']);}
}
