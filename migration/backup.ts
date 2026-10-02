import {sha} from './core';
import {Buffer} from 'node:buffer';
const quote=(name:string)=>'"'+name.replace(/"/g,'""')+'"';
const literal=(v:any)=>v===null?'NULL':typeof v==='number'?String(v):"'"+String(v).replace(/'/g,"''")+"'";
export async function capture(db:D1Database,r2:R2Bucket){
 const schema=(await db.prepare("SELECT type,name,sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY CASE type WHEN 'table' THEN 0 ELSE 1 END,name").all<any>()).results;
 const tables=schema.filter(s=>s.type==='table');
 if(tables.length>50)throw new Error('BACKUP_BATCH_TOO_LARGE');
 // D1 batch reads one consistent transaction; photos are immutable by their upload/content keys.
 const results=await db.batch(tables.map(t=>db.prepare('SELECT * FROM '+quote(t.name))));
 const rows=Object.fromEntries(tables.map((t,i)=>[t.name,results[i].results]));
 const sql=['PRAGMA defer_foreign_keys=ON;',...schema.map(s=>s.sql+';')];
 const order=['classes','accounts','credentials','diaries','photo_uploads','attachments','board_posts','board_comments','diary_comments','board_likes','praises','teacher_notes','sessions'];
 const ordered=tables.slice().sort((a,b)=>(order.indexOf(a.name)<0?100:order.indexOf(a.name))-(order.indexOf(b.name)<0?100:order.indexOf(b.name)));
 for(const table of ordered){
  const entries=rows[table.name] as any[],pending=entries.slice(),sorted:any[]=[],ids=new Set();
  while(pending.length){const index=pending.findIndex(r=>!r.parent_id||ids.has(r.parent_id));if(index<0)throw new Error('BACKUP_PARENT_CYCLE');const row=pending.splice(index,1)[0];sorted.push(row);ids.add(row.id);}
  for(const row of sorted)sql.push('INSERT INTO '+quote(table.name)+'('+Object.keys(row).map(quote).join(',')+') VALUES('+Object.values(row).map(literal).join(',')+');');}
 const paths=new Set<string>();
 for(const row of [...(rows.attachments||[]),...(rows.photo_uploads||[])] as any[]){
  if(row.ready===0)continue;
  paths.add(row.object_path);if(row.thumbnail_path)paths.add(row.thumbnail_path);
 }
 const photos=[];
 for(const path of paths){const object=await r2.get(path);if(!object)throw new Error('BACKUP_MISSING_OBJECT');const bytes=Buffer.from(await object.arrayBuffer());photos.push({path,bytes:bytes.toString('base64'),sha256:sha(bytes),size:bytes.length,mime:object.httpMetadata?.contentType||'application/octet-stream'});}
 sql.push('PRAGMA defer_foreign_keys=OFF;');
 return {format:'okgu-d1-r2-backup-v2',capturedAt:new Date().toISOString(),rows,schema,sql:sql.join('\n'),photos};
}
export function verifyObjects(backup:any){
 if(backup.format!=='okgu-d1-r2-backup-v2')throw new Error('BACKUP_FORMAT');
 for(const f of backup.photos){const bytes=Buffer.from(f.bytes,'base64');if(sha(bytes)!==f.sha256||bytes.length!==f.size)throw new Error('BACKUP_PHOTO_CHECKSUM');}
}
export const fingerprint=(rows:any[])=>sha(JSON.stringify(rows.map(r=>Object.fromEntries(Object.entries(r).sort(([a],[b])=>a.localeCompare(b)))).map(r=>JSON.stringify(r)).sort()));
