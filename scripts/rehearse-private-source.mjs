// Actual private source data, isolated in-memory SQLite only. No Cloudflare,
// Google, HTTP server, public assets, production import or deployment mutation.
import {readFile,writeFile,realpath} from 'node:fs/promises';import path from 'node:path';
import assert from 'node:assert/strict';import {DatabaseSync} from 'node:sqlite';
import {database} from '../tests/helpers/d1.mjs';import {plan,sha,stableId,visibility} from '../migration/core.ts';
import {d1Import} from '../migration/d1.ts';import {capture,fingerprint} from '../migration/backup.ts';
import {sealSnapshot,openSnapshot} from '../migration/snapshot.ts';
try{
 const local=await realpath('.local'),input=await realpath(process.argv[2]);if(!input.startsWith(local+path.sep))throw Error('PRIVATE_LOCAL_INPUT_REQUIRED');
 const candidate=JSON.parse(await readFile(input));assert.equal(candidate.synthetic,false);
 // This is a rehearsal of the explicit mapping, not confirmation of the live GAS version.
 const s={...candidate,identityReviewed:true};const checked=plan(s);assert.equal(checked.issues.length,0);
 const db=await database(),restored=new DatabaseSync(':memory:');
 try{
  const sql=d1Import(s).sql;db.sqlite.exec(sql);const first=db.sqlite.prepare('SELECT count(*) n FROM migration_records').get().n;db.sqlite.exec(sql);assert.equal(db.sqlite.prepare('SELECT count(*) n FROM migration_records').get().n,first);
  for(const row of s.entities['학생계정']){const id=stableId(s.sourceId,'학생계정',row.id),a=db.sqlite.prepare('SELECT * FROM accounts WHERE id=?').get(id),cred=db.sqlite.prepare('SELECT * FROM credentials WHERE account_id=?').get(id);assert.equal(a.display_name,row.cells['이름']);assert.equal(cred.pin_hash,row.cells.PIN);}
  for(const row of s.entities['일기기록']){const d=db.sqlite.prepare('SELECT * FROM diaries WHERE legacy_id=?').get(row.id);assert.equal(d.body,row.cells['일기내용']);assert.equal(d.diary_date,row.cells['날짜']);assert.equal(d.visibility,visibility(row.cells));assert.equal(d.author_id,stableId(s.sourceId,'학생계정',row.accountRefs['학생이름']));}
  for(const record of checked.records){const archived=db.sqlite.prepare('SELECT payload FROM source_archive WHERE entity=? AND legacy_id=?').get(record.entity,record.row.id);assert.deepEqual(JSON.parse(archived.payload),record.row);}
  const objects=new Map();for(const f of s.files){const p=await realpath(f.path);if(!p.startsWith(local+path.sep))throw Error('PRIVATE_PHOTO_PATH_REQUIRED');const b=await readFile(p);assert.equal(sha(b),f.sha256);assert.equal(b.length,f.size);objects.set('migration/'+f.sha256,{bytes:b,mime:f.mime});}
  const backup=await capture(db.DB,{get:async p=>{const o=objects.get(p);return o?{arrayBuffer:async()=>o.bytes.buffer.slice(o.bytes.byteOffset,o.bytes.byteOffset+o.bytes.length),httpMetadata:{contentType:o.mime}}:null;}});
  const key=Buffer.from((await readFile('.local/private-source/backup/key.private','utf8')).trim(),'hex');
  const envelope=sealSnapshot(backup,key);await writeFile('.local/source-review/mapped-rehearsal.enc',JSON.stringify(envelope),{mode:0o600});const opened=openSnapshot(envelope,key);
  restored.exec('PRAGMA foreign_keys=ON;BEGIN;'+opened.sql+'COMMIT;');assert.equal(restored.prepare('PRAGMA foreign_key_check').all().length,0);
  for(const [name,rows] of Object.entries(opened.rows)){assert.match(name,/^[a-z_]+$/);assert.equal(fingerprint(restored.prepare('SELECT * FROM "'+name+'"').all()),fingerprint(rows));}
  const result={checkedAt:new Date().toISOString(),source:'actual private ZIP',environment:'isolated in-memory SQLite and private photo bytes; no remote import',success:true,currentDeploymentConfirmed:false,liveSourceDeltaConfirmed:false,accounts:opened.rows.accounts.length,credentials:opened.rows.credentials.length,diaries:opened.rows.diaries.length,boardPosts:opened.rows.board_posts.length,diaryComments:opened.rows.diary_comments.length,boardComments:opened.rows.board_comments.length,uniqueLikes:opened.rows.board_likes.length,praises:opened.rows.praises.length,subscriptions:opened.rows.push_subscriptions.length,sourceRowsArchived:first,missingParentRowsPreserved:checked.records.filter(r=>r.archiveOnly&&s.sourceDispositions.find(d=>d.entity===r.entity&&d.id===r.row.id)?.reason==='missing-source-parent').length,duplicateLikesPreserved:s.sourceDispositions.filter(d=>d.reason==='duplicate-source-like').length,flagsWithoutRecordPreserved:s.sourceDispositions.filter(d=>d.reason==='source-flags-without-record').length,attachments:opened.rows.attachments.length,uniquePhotoObjects:objects.size,restoredTables:Object.keys(opened.rows).length,allTableFingerprintsEqual:true,allOriginalPhotoHashesEqual:true,allPinHashesUnchanged:true,rerunDuplicates:0,sourceModified:false,actualPinLoginTested:false};
  await writeFile('docs/검증/private-source-rehearsal-20261003.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
 }finally{db.close();restored.close();}
}catch{console.error('PRIVATE_SOURCE_REHEARSAL_FAILED: no source rows, hashes or SQL logged');process.exitCode=1;}
