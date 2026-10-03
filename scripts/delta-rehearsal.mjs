import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';import {spawnSync} from 'node:child_process';
import {sha} from '../migration/core.ts';
import {d1Import} from '../migration/d1.ts';import {delta,applyDelta} from '../migration/delta.ts';
const source=JSON.parse(await readFile('fixtures/snapshot.json','utf8'));if(!source.synthetic)throw new Error('Synthetic fixture required');
const directory='.local/delta-rehearsal/'+Date.now();await mkdir(directory,{recursive:true,mode:0o700});
const schema=(await Promise.all((await readdir('migrations')).filter(n=>n.endsWith('.sql')).sort().map(n=>readFile('migrations/'+n,'utf8')))).join('\n');
await writeFile(directory+'/seed.sql',schema+'\n'+d1Import(source).sql,{mode:0o600});
process.env.XDG_CONFIG_HOME ||= '/tmp/okgu-wrangler-config';process.env.WRANGLER_SEND_METRICS='false';
const p=spawnSync('node',['node_modules/wrangler/bin/wrangler.js','d1','execute','DB','--local','--persist-to',directory,'--file',directory+'/seed.sql'],{stdio:'ignore'});if(p.status)throw new Error('Isolated synthetic seed failed');
const {getPlatformProxy}=await import('wrangler');const proxy=await getPlatformProxy({configPath:'wrangler.jsonc',persist:{path:directory+'/v3'}});
try{const db=proxy.env.DB;const tables=(await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%'").all()).results;const rows=async()=>Object.fromEntries(await Promise.all(tables.map(async r=>[r.name,(await db.prepare('SELECT * FROM "'+r.name+'"').all()).results])));
 const baseline=await rows(),after=structuredClone(source);after.entities['일기기록'][0].cells['일기내용']='D1 변화분 가상 수정';
 const added=structuredClone(after.entities['일기기록'][0]);added.id='rehearsal-added';added.cells.ID=added.id;added.cells['사진URLs']='[]';after.entities['일기기록'].push(added);
 const prepared=delta(source,after,baseline,await rows());await applyDelta(db,prepared);await applyDelta(db,prepared);
 const entry=await db.prepare('SELECT body,version FROM diaries WHERE legacy_id=?').bind(source.entities['일기기록'][0].id).first();if(entry.body!=='D1 변화분 가상 수정'||entry.version!==2)throw new Error('Delta mismatch');
 const next=structuredClone(after);next.entities['일기기록'][0].cells['일기내용']='경쟁하는 원본 수정';const clean=await rows(),stale=delta(after,next,clean,clean);await db.prepare('UPDATE diaries SET body=? WHERE legacy_id=?').bind('새 서버 가상 수정',source.entities['일기기록'][0].id).run();
 let blocked=false;try{await applyDelta(db,stale);}catch{blocked=true;}if(!blocked)throw new Error('Stale target must rollback');
 // Reset only the rehearsal conflict, then review a source deletion explicitly.
 await db.prepare('UPDATE diaries SET body=? WHERE legacy_id=?').bind('D1 변화분 가상 수정',source.entities['일기기록'][0].id).run();
 const deletionBaseline=await rows(),removed=structuredClone(after),deleteId=removed.entities['일기기록'][0].id;
 removed.entities['일기기록']=removed.entities['일기기록'].filter(r=>r.id!==deleteId);removed.entities['선생님댓글']=removed.entities['선생님댓글'].filter(r=>r.cells['일기ID']!==deleteId);removed.files=removed.files.filter(f=>f.diaryId!==deleteId);
 const reviewPlan=delta(after,removed,deletionBaseline,await rows());if(!reviewPlan.conflicts.length)throw Error('Missing source must require review');
 const review={reviewed:true,currentHash:sha(JSON.stringify(removed)),missing:reviewPlan.conflicts.filter(c=>c.reason==='SOURCE_MISSING_REQUIRES_DELETE_REVIEW').map(({table,keyHash})=>({table,keyHash}))};
 const deletion=delta(after,removed,deletionBaseline,await rows(),review);await applyDelta(db,deletion);await applyDelta(db,deletion);
 const deleted=await db.prepare('SELECT body,deleted_at FROM diaries WHERE legacy_id=?').bind(deleteId).first();if(!deleted.deleted_at||deleted.body!=='D1 변화분 가상 수정')throw Error('Reviewed deletion mismatch');
 if((await db.prepare('SELECT COUNT(*) n FROM attachments').first()).n!==deletionBaseline.attachments.length)throw Error('Recovery photo metadata must remain');
 if((await db.prepare('PRAGMA foreign_key_check').all()).results.length)throw Error('Deletion relationship mismatch');
 console.log('PASS isolated local D1 atomic delta: source insert/edit, version, retry deduplication, stale-target full rollback and reviewed soft-deletion with photo metadata preserved. No remote resources modified.');
}finally{await proxy.dispose();}
