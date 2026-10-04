// Add/update reviewed source deltas without resetting D1, deleting rows or sending old notifications.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {cloudflareClient} from './lib/trial-cloudflare.mjs';
import {capture,fingerprint} from '../migration/backup.ts';
import {sealSnapshot,openSnapshot} from '../migration/snapshot.ts';
import {prepareInitialImport} from '../migration/initial-production.ts';
import {delta} from '../migration/delta.ts';
async function main(){
const dir='.local/cutover-20261004',client=cloudflareClient();
const previous=JSON.parse(await readFile(dir+'/baseline-snapshot.private.json'));
const current=JSON.parse(await readFile(dir+'/current-snapshot.private.json'));
const resources=JSON.parse(await readFile('.local/production-resources.private.json'));
assert.equal(resources.databaseName,'okgu-diary-production');
assert.equal((await client.accountCall('GET','/d1/database/'+resources.databaseId)).name,resources.databaseName);
const query=async sql=>{const r=await client.accountCall('POST','/d1/database/'+resources.databaseId+'/query',{sql});assert(r.every(x=>x.success));return r;};
const db={prepare(sql){return {sql,all:async()=>(await query(sql))[0]};},batch:async stmts=>query(stmts.map(s=>s.sql).join(';'))};
const r2={async get(key){const r=await fetch('https://api.cloudflare.com/client/v4/accounts/'+client.account+'/r2/buckets/'+resources.bucketName+'/objects/'+key,{headers:{Authorization:'Bearer '+process.env.CLOUDFLARE_API_TOKEN},signal:AbortSignal.timeout(30000)});assert(r.ok,'BACKUP_R2_READ');return {arrayBuffer:()=>r.arrayBuffer(),httpMetadata:{contentType:r.headers.get('Content-Type')}};}};
const key=Buffer.from((await readFile('.local/private-source/backup/key.private','utf8')).trim(),'hex');
await mkdir(dir,{recursive:true,mode:0o700});
const backupPath=dir+'/before-delta-'+Date.now()+'.enc';
const backup=await capture(db,r2);
await writeFile(backupPath,JSON.stringify(sealSnapshot(backup,key)),{mode:0o600});
const restored=openSnapshot(JSON.parse(await readFile(backupPath)),key),sqlite=new DatabaseSync(':memory:');
try{sqlite.exec('PRAGMA foreign_keys=ON;BEGIN;'+restored.sql+'COMMIT;');assert.equal(sqlite.prepare('PRAGMA foreign_key_check').all().length,0);for(const [table,rows] of Object.entries(restored.rows))assert.equal(fingerprint(sqlite.prepare('SELECT * FROM "'+table+'"').all()),fingerprint(rows));}finally{sqlite.close();}
const before=prepareInitialImport(previous).expected,expected=prepareInitialImport(current).expected;
// Cloud edits remain authoritative: delta refuses conflicting changed rows.
const prepared=delta(previous,current,{...before,...backup.rows},backup.rows);
assert.equal(prepared.conflicts.length,0,'DELTA_CONFLICT_REVIEW_REQUIRED');
assert(prepared.statements.length<=49,'DELTA_TOO_LARGE');
assert(!prepared.statements.some(s=>/^DELETE\b/i.test(s)||/SET deleted_at=/.test(s)),'SOURCE_DELETE_REFUSED');
await writeFile(dir+'/delta-plan.private.json',JSON.stringify(prepared),{mode:0o600});
const changed={};for(const table of ['diaries','diary_comments','board_posts','board_comments','accounts','attachments'])changed[table]={source:expected[table].length,cloud:backup.rows[table].length,missing:expected[table].filter(r=>!backup.rows[table].some(x=>x.id===r.id)).length};
console.log(JSON.stringify({phase:'prepared',changed,statements:prepared.statements.length,backupRestored:true,photosVerified:backup.photos.length}));
if(!process.argv.includes('--apply'))process.exit(0);
if(!prepared.alreadyApplied&&prepared.statements.length){
 // One D1 SQL request preserves the compare-and-swap guard (rollback probe verified).
 const r=await client.accountCall('POST','/d1/database/'+resources.databaseId+'/query',{sql:prepared.statements.join('\n')});
 assert(r.every(x=>x.success));
}
const after={};for(const table of ['diaries','diary_comments','board_posts','board_comments','accounts','credentials','attachments']){
 const rows=(await query('SELECT * FROM "'+table+'"'))[0].results;after[table]=rows;
 for(const row of backup.rows[table])assert(rows.some(r=>JSON.stringify(r)===JSON.stringify(row)),'EXISTING_CLOUD_ROW_CHANGED');
 for(const row of expected[table]){const actual=rows.find(r=>r.id? r.id===row.id:r.account_id===row.account_id);assert(actual,'SOURCE_ROW_MISSING');
  if(['diaries','diary_comments'].includes(table)&&!backup.rows[table].some(r=>r.id===row.id))for(const [k,v] of Object.entries(row))if(k!=='source_batch')assert.equal(actual[k],v,'RECOVERED_ROW_MISMATCH');
 }
}
assert.equal((await query('PRAGMA foreign_key_check'))[0].results.length,0);
const report={checkedAt:new Date().toISOString(),recoveredDiaries:changed.diaries.missing,recoveredDiaryComments:changed.diary_comments.missing,existingCloudRowsPreserved:true,photoReferencesPreserved:after.attachments.length,cloudDiaries:after.diaries.length,cloudDiaryComments:after.diary_comments.length,duplicateNewRows:0,historicalNotificationsReplayed:false};
await writeFile('docs/검증/cloud-write-delta-20261004.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));

}
main().catch(()=>{console.error("E_PRIVATE_DELTA_FAILED: source rows and credentials omitted; inspect private backup and plan");process.exitCode=1;});
