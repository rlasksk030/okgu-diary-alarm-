import {AppError,type Account,type Env,type Row} from './types';
import {digest} from './auth';
import {diaryACL} from './store';
import {inspectImage} from './image';
import {boundedBody} from './body';

export async function upload(env:Env,a:Account,req:Request){
 if(a.role!=='student')throw new AppError('E_FORBIDDEN',403);
 const id=req.headers.get('X-Request-Id')||'';
 if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id))throw new AppError('E_INPUT');
 const body=await boundedBody(req,1048576+98304+8192);
 let bytes=body,thumb:ArrayBuffer|null=null;
 if(req.headers.get('Content-Type')?.startsWith('multipart/form-data')){
  let form:FormData;try{form=await new Request(req.url,{method:'POST',headers:req.headers,body}).formData();}catch{throw new AppError('E_FILE_TYPE',415);}
  const original=form.get('photo'),small=form.get('thumbnail');
  if(!(original instanceof File)||!(small instanceof File))throw new AppError('E_INPUT');
  bytes=await original.arrayBuffer();thumb=await small.arrayBuffer();
 }
 if(!bytes.byteLength||bytes.byteLength>1048576||(thumb&&thumb.byteLength>98304))throw new AppError('E_FILE_SIZE',413);
 const {mime}=inspectImage(bytes),sha=await digest(bytes),extension=mime==='image/jpeg'?'jpg':'png';
 const path='uploads/'+a.id+'/'+id+'.'+extension;
 let thumbnailPath:string|null=null,thumbnailMime='';
 if(thumb){const info=inspectImage(thumb);if(info.width>192||info.height>192)throw new AppError('E_FILE_SIZE',413);thumbnailMime=info.mime;thumbnailPath='uploads/'+a.id+'/'+id+'.thumb.'+(info.mime==='image/jpeg'?'jpg':'png');}
 const payloadHash=thumb?await digest(sha+':'+await digest(thumb)):sha;
 const pending=await env.DB.batch([env.DB.prepare('INSERT INTO photo_uploads(id,owner_id,object_path,thumbnail_path,source_sha256,sha256,byte_size,mime_type,created_at) SELECT ?,?,?,?,?,?,?,?,? WHERE NOT EXISTS(SELECT 1 FROM expired_uploads WHERE id=?) ON CONFLICT DO NOTHING').bind(id,a.id,path,thumbnailPath,payloadHash,sha,bytes.byteLength,mime,Date.now(),id),env.DB.prepare('SELECT * FROM photo_uploads WHERE id=?').bind(id)]);
 const row=pending[1].results[0] as Row|undefined;
 if(!row)throw new AppError('E_UPLOAD_EXPIRED',409);
 if(row.owner_id!==a.id)throw new AppError('E_FORBIDDEN',403);
 if(row.source_sha256!==payloadHash)throw new AppError('E_CONFLICT',409);
 if(!row.ready){
  const lease=await env.DB.prepare('UPDATE photo_uploads SET created_at=? WHERE id=? AND owner_id=? AND ready=0').bind(Date.now(),id,a.id).run();
  if(!lease.meta.changes)throw new AppError('E_CONFLICT',409);
  await Promise.all([env.PHOTOS.put(path,bytes,{httpMetadata:{contentType:mime},customMetadata:{sha256:sha}}),...(thumb&&thumbnailPath?[env.PHOTOS.put(thumbnailPath,thumb,{httpMetadata:{contentType:thumbnailMime}})]:[])]);const changed=await env.DB.prepare('UPDATE photo_uploads SET ready=1 WHERE id=? AND owner_id=? AND source_sha256=?').bind(id,a.id,payloadHash).run();if(!changed.meta.changes)throw new AppError('E_CONFLICT',409);}
 return {success:true,url:'okgu-photo:'+id,sha256:sha,bytes:bytes.byteLength,thumbnail:!!thumb};
}

export async function photo(env:Env,a:Account,id:string,thumbnail=false){
 const acl=diaryACL(a);
 const row=await env.DB.prepare('SELECT f.* FROM attachments f JOIN diaries d ON d.id=f.diary_id WHERE f.id=? AND '+acl.sql).bind(id,...acl.params).first<Row>();
 if(!row)throw new AppError('E_NOT_FOUND',404);
 const file=await env.PHOTOS.get(thumbnail&&row.thumbnail_path?row.thumbnail_path:row.object_path);
 if(!file)throw new AppError('E_NOT_FOUND',404);
 return new Response(file.body,{headers:{'Content-Type':file.httpMetadata?.contentType||row.mime_type,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'",'Content-Length':String(file.size)}});
}

// Atomic D1 claim prevents an upload being attached after GC begins.
// Persist object deletion jobs so an R2 failure remains retryable.
export async function cleanup(env:Env,now=Date.now()){
 const cutoff=now-7*86400000;
 const rows=(await env.DB.prepare('SELECT id,object_path,thumbnail_path FROM photo_uploads WHERE diary_id IS NULL AND coalesce(detached_at,created_at)<? LIMIT 8').bind(cutoff).all<Row>()).results;
 for(const row of rows){
  const jobs=[row.object_path,row.thumbnail_path].filter(Boolean).map(path=>env.DB.prepare('INSERT INTO object_gc(object_path,created_at) SELECT object_path,? FROM photo_uploads WHERE id=? AND diary_id IS NULL AND coalesce(detached_at,created_at)<? AND object_path=? ON CONFLICT DO NOTHING').bind(now,row.id,cutoff,path));
  if(row.thumbnail_path)jobs[1]=env.DB.prepare('INSERT INTO object_gc(object_path,created_at) SELECT thumbnail_path,? FROM photo_uploads WHERE id=? AND diary_id IS NULL AND coalesce(detached_at,created_at)<? AND thumbnail_path IS NOT NULL ON CONFLICT DO NOTHING').bind(now,row.id,cutoff);
  jobs.push(env.DB.prepare('INSERT INTO expired_uploads(id,expired_at) SELECT id,? FROM photo_uploads WHERE id=? AND diary_id IS NULL AND coalesce(detached_at,created_at)<? ON CONFLICT DO NOTHING').bind(now,row.id,cutoff));
  jobs.push(env.DB.prepare('DELETE FROM photo_uploads WHERE id=? AND diary_id IS NULL AND coalesce(detached_at,created_at)<?').bind(row.id,cutoff));await env.DB.batch(jobs);
 }
 const pending=(await env.DB.prepare('SELECT object_path FROM object_gc LIMIT 16').all<Row>()).results;
 for(const item of pending){try{await env.PHOTOS.delete(item.object_path);await env.DB.prepare('DELETE FROM object_gc WHERE object_path=?').bind(item.object_path).run();}catch{/* durable retry next scheduled cleanup */}}
 return rows.length;
}
