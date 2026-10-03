// Cutover recovery rehearsal with synthetic records in isolated local D1/R2.
import {mkdir,readFile,readdir,writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import assert from 'node:assert/strict';
import {d1Import} from '../migration/d1.ts';
import {capture,fingerprint} from '../migration/backup.ts';
import {sealSnapshot,openSnapshot} from '../migration/snapshot.ts';
import {sha} from '../migration/core.ts';
import {hashPin,verifyPin} from '../worker/auth.ts';
const source=JSON.parse(await readFile('fixtures/snapshot.json','utf8'));assert.equal(source.synthetic,true);
const directory='.local/recovery-rehearsal/'+Date.now();await mkdir(directory,{recursive:true,mode:0o700});
const schema=(await Promise.all((await readdir('migrations')).filter(f=>f.endsWith('.sql')).sort().map(f=>readFile('migrations/'+f,'utf8')))).join('\n');
await writeFile(directory+'/seed.private.sql',schema+'\n'+d1Import(source).sql,{mode:0o600});
const env={...process.env,XDG_CONFIG_HOME:process.env.XDG_CONFIG_HOME||'/tmp/okgu-wrangler-config',WRANGLER_SEND_METRICS:'false'};
const run=args=>{const p=spawnSync('node',args,{env,stdio:'ignore'});assert.equal(p.status,0,'E_ISOLATED_RECOVERY_COMMAND');};
run(['node_modules/wrangler/bin/wrangler.js','d1','execute','DB','--local','--config','wrangler.jsonc','--persist-to',directory,'--file',directory+'/seed.private.sql']);
const {getPlatformProxy}=await import('wrangler');const proxy=await getPlatformProxy({configPath:'wrangler.jsonc',persist:{path:directory+'/v3'}});
try{
 const {DB,PHOTOS}=proxy.env,bytes=await readFile('fixtures/photo.png');
 for(const f of source.files)await PHOTOS.put('migration/'+f.sha256,bytes,{httpMetadata:{contentType:f.mime}});
 const baseline=await capture(DB,PHOTOS),old=baseline.rows.diaries[0],student=old.author_id;
 const teacher=baseline.rows.accounts.find(a=>a.role==='teacher'&&a.active===1).id;
 const newHash=await hashPin('0024');assert.equal(await verifyPin('0024',newHash),true);assert.equal(await verifyPin('0042',newHash),false);
 await DB.prepare("INSERT INTO sessions(token_hash,account_id,expires_at) VALUES('synthetic-old-student-session',?,?)").bind(student,Date.now()+86400000).run();
 await DB.prepare("INSERT INTO sessions(token_hash,account_id,expires_at) VALUES('synthetic-other-teacher-session',?,?)").bind(teacher,Date.now()+86400000).run();
 await DB.batch([
  DB.prepare("INSERT INTO diaries(id,author_id,class_id,diary_date,body,mood_emoji,mood_label,mood_color,visibility,created_at,updated_at) VALUES('post-cutover-new',?,?,'2026-10-03','전환 뒤 새 기록','🙂','좋아','#111','private',?,?)").bind(student,old.class_id,Date.now(),Date.now()),
  DB.prepare("UPDATE diaries SET body='전환 뒤 수정',version=version+1,updated_at=? WHERE id=?").bind(Date.now(),old.id),
  DB.prepare('UPDATE credentials SET pin_hash=? WHERE account_id=?').bind(newHash,student),
  DB.prepare('DELETE FROM sessions WHERE account_id=?').bind(student)
 ]);
 const deleted=baseline.rows.diaries.find(d=>d.id!==old.id);assert(deleted);
 await DB.prepare('UPDATE diaries SET deleted_at=?,version=version+1 WHERE id=?').bind(Date.now(),deleted.id).run();
 await DB.prepare("INSERT INTO diary_comments(id,diary_id,author_id,body,created_at) VALUES('post-cutover-comment','post-cutover-new',?,'전환 뒤 교사 댓글',?)").bind(teacher,Date.now()).run();
 await DB.prepare("INSERT INTO diary_comments(id,diary_id,author_id,body,created_at,parent_id) VALUES('post-cutover-reply','post-cutover-new',?,'전환 뒤 답글',?,'post-cutover-comment')").bind(student,Date.now()).run();
 await DB.prepare("INSERT INTO board_likes(post_id,account_id) SELECT id,? FROM board_posts WHERE NOT EXISTS(SELECT 1 FROM board_likes WHERE post_id=board_posts.id AND account_id=?) LIMIT 1").bind(student,student).run();
 for(const path of ['recovery/new-original','recovery/new-thumbnail'])await PHOTOS.put(path,bytes,{httpMetadata:{contentType:'image/png'}});
 await DB.prepare("INSERT INTO attachments(id,diary_id,object_path,ordinal,sha256,byte_size,mime_type,thumbnail_path) VALUES('post-cutover-photo','post-cutover-new','recovery/new-original',0,?,?,'image/png','recovery/new-thumbnail')").bind(sha(bytes),bytes.length).run();
 const current=await capture(DB,PHOTOS);
 assert(!baseline.rows.diaries.some(d=>d.id==='post-cutover-new'));
 assert.notEqual(fingerprint(current.rows.diaries),fingerprint(baseline.rows.diaries));
 assert(current.rows.credentials.find(c=>c.account_id===student).pin_hash===newHash,'E_CURRENT_CREDENTIAL_CHANGED');
 assert(!current.rows.sessions.some(s=>s.account_id===student));assert(current.rows.sessions.some(s=>s.account_id===teacher));
 assert.equal(current.rows.diary_comments.find(c=>c.id==='post-cutover-reply').parent_id,'post-cutover-comment');
 const key=randomBytes(32),sealed=sealSnapshot(current,key),file=directory+'/current.enc';
 await writeFile(file,JSON.stringify(sealed),{mode:0o600,flag:'wx'});assert(sha(JSON.stringify(openSnapshot(sealed,key)))===sha(JSON.stringify(current)),'E_ENCRYPTED_CURRENT_STATE_CHANGED');
 // Keep a recovery key separate from the encrypted payload; both remain ignored/private.
 await writeFile(directory+'/key.private',key.toString('hex'),{mode:0o600,flag:'wx'});
 const p=spawnSync('node',['--import','tsx','scripts/restore-rehearsal.mjs',file],{env:{...env,OKGU_BACKUP_KEY:key.toString('hex')},stdio:'pipe',encoding:'utf8'});assert.equal(p.status,0,'E_POST_CUTOVER_RESTORE');
 const result={at:new Date().toISOString(),syntheticOnly:true,environment:'isolated local workerd D1/R2',success:true,tables:Object.keys(current.rows).length,photos:current.photos.length,checks:['post-cutover new diary and original/thumbnail preserved','pre-existing diary edit/version and soft-deletion preserved','comment author and reply parent preserved','likes and all account IDs preserved','current PBKDF2-600000 hash preserved; reset student session stays revoked; other teacher session preserved','every table restored exactly; foreign keys and every object SHA256 matched','current runtime storage and original baseline never overwritten'],completeGasRollback:false,remoteBindingRestore:false};
 await mkdir('artifacts',{recursive:true});await writeFile('artifacts/recovery-rehearsal.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
}finally{await proxy.dispose();}
