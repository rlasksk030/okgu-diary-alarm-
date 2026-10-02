import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {d1Import} from './d1';
import {plan,sha,type Snapshot} from './core';
const tables=['classes','accounts','credentials','diaries','board_posts','board_comments','board_likes','praises','diary_comments','teacher_notes','attachments'];
const quote=(v:string)=>'"'+v.replace(/"/g,'""')+'"';
const literal=(v:any)=>v===null||v===undefined?'NULL':typeof v==='number'?String(v):"'"+String(v).replace(/'/g,"''")+"'";
const canonical=(s:Snapshot)=>{const db=new DatabaseSync(':memory:');for(const name of readdirSync('migrations').filter(n=>n.endsWith('.sql')).sort())db.exec(readFileSync('migrations/'+name,'utf8'));db.exec(d1Import(s).sql);return db;};
const equal=(a:any,b:any)=>JSON.stringify(a)===JSON.stringify(b);
export function delta(previous:Snapshot,current:Snapshot,baseline:any,target:any){
 if(previous.sourceId!==current.sourceId||previous.classId!==current.classId||plan(previous).issues.length||plan(current).issues.length)throw new Error('DELTA_UNREVIEWED_SOURCE');
 const before=canonical(previous),after=canonical(current),conflicts:{table:string,keyHash:string,reason:string}[]=[],conditions:string[]=[],statements:string[]=[];
 try{
 for(const table of tables){
  const info=before.prepare('PRAGMA table_info('+quote(table)+')').all() as any[];
  const keys=info.filter(c=>c.pk).sort((a,b)=>a.pk-b.pk).map(c=>c.name),key=(r:any)=>JSON.stringify(keys.map(k=>r[k]));
  const old=new Map((before.prepare('SELECT * FROM '+quote(table)).all() as any[]).map(r=>[key(r),r]));
  const next=new Map((after.prepare('SELECT * FROM '+quote(table)).all() as any[]).map(r=>[key(r),r]));
  const imported=new Map((baseline[table]||[]).map((r:any)=>[key(r),r])),live=new Map((target[table]||[]).map((r:any)=>[key(r),r]));
  const identity=(r:any)=>keys.map(k=>quote(k)+' IS '+literal(r[k])).join(' AND ');
  for(const [k,row] of next){const was=old.get(k) as any;
   const changed=Object.keys(row).filter(c=>c!=='source_batch'&&!equal(row[c],was?.[c]));
   if(was&&!changed.length)continue;
   const known=imported.get(k) as any,actual=live.get(k) as any;
   if(!was){
    if(actual){if(Object.keys(row).every(c=>c==='source_batch'||equal(row[c],actual[c])))continue;conflicts.push({table,keyHash:sha(k),reason:'NEW_TARGET_COLLISION'});continue;}
    conditions.push('NOT EXISTS(SELECT 1 FROM '+quote(table)+' WHERE '+identity(row)+')');
    statements.push('INSERT INTO '+quote(table)+'('+Object.keys(row).map(quote).join(',')+') VALUES('+Object.values(row).map(literal).join(',')+');');
   }else{
    if(!known||!actual||!Object.keys(was).every(c=>c==='source_batch'||equal(was[c],known[c]))||!equal(known,actual)){conflicts.push({table,keyHash:sha(k),reason:'TARGET_CHANGED_OR_BASELINE_MISSING'});continue;}
    conditions.push('EXISTS(SELECT 1 FROM '+quote(table)+' WHERE '+Object.keys(actual).map(c=>quote(c)+' IS '+literal(actual[c])).join(' AND ')+')');
    const patch=Object.fromEntries(changed.map(c=>[c,row[c]]));
    if(table==='diaries'){patch.version=Number(actual.version)+1;patch.updated_at=Math.max(Number(row.updated_at),Number(actual.updated_at));}
    statements.push('UPDATE '+quote(table)+' SET '+Object.entries(patch).map(([c,v])=>quote(c)+'='+literal(v)).join(',')+' WHERE '+identity(row)+';');
   }
  }
  for(const [k] of old)if(!next.has(k))conflicts.push({table,keyHash:sha(k),reason:'SOURCE_MISSING_REQUIRES_DELETE_REVIEW'});
 }
 // Deterministic apply ID makes reruns harmless. Valid=0 deliberately fails a CHECK
 // constraint so a stale-target conflict rolls back the entire D1 atomic batch.
 const id=sha(JSON.stringify([previous,current]));
 const existing=(target.migration_applies||[]).some((r:any)=>r.id===id);
 if(existing)return {id,conflicts:[],statements:[],alreadyApplied:true};
 if(conflicts.length)return {id,conflicts,statements:[],alreadyApplied:false};
 const guard="INSERT INTO migration_applies(id,valid,applied_at) VALUES("+literal(id)+",CASE WHEN "+(conditions.join(' AND ')||'1')+" THEN 1 ELSE 0 END,"+Date.now()+");";
 // Keep all archive/mapping writes in the same batch, using initial loader's harmless
 // ON CONFLICT DO NOTHING for rows already handled above.
 const priorHashes=new Map(plan(previous).records.map(r=>[JSON.stringify([r.entity,r.row.id]),r.hash]));
 const batch=sha(JSON.stringify(current)).slice(0,24),archive:string[]=[];
 for(const record of plan(current).records){if(priorHashes.get(JSON.stringify([record.entity,record.row.id]))===record.hash)continue;
  archive.push('INSERT INTO source_archive(batch_id,entity,legacy_id,payload) VALUES('+[batch,record.entity,record.row.id,JSON.stringify(record.row)].map(literal).join(',')+') ON CONFLICT DO NOTHING;');
  archive.push('INSERT INTO migration_records(source_id,entity,legacy_id,target_id,source_hash,batch_id,status) VALUES('+[current.sourceId,record.entity,record.row.id,record.targetId,record.hash,batch,'reviewed-delta'].map(literal).join(',')+') ON CONFLICT(source_id,entity,legacy_id) DO UPDATE SET source_hash=excluded.source_hash,batch_id=excluded.batch_id,status=excluded.status;');
 }
 return {id,conflicts,statements:[guard,...statements,...archive],alreadyApplied:false};
 }finally{before.close();after.close();}
}
export async function applyDelta(db:D1Database,prepared:ReturnType<typeof delta>){
 if(prepared.conflicts.length)throw new Error('DELTA_CONFLICTS_REQUIRE_REVIEW');
 if(prepared.statements.length>49)throw new Error('DELTA_TOO_LARGE_FREE_INVOCATION: split by dependency group in a reviewed freeze procedure; never partially apply');
 if(prepared.alreadyApplied||await db.prepare('SELECT id FROM migration_applies WHERE id=?').bind(prepared.id).first())return {alreadyApplied:true};
 return db.batch(prepared.statements.map(sql=>db.prepare(sql)));
}
