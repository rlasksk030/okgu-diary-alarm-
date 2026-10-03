import type {Env,Account,Row} from './types';
import {today,all,diaryACL,boardACL} from './store';
const hour=(date:Date)=>Number(date.toLocaleTimeString('en-GB',{timeZone:'Asia/Seoul',hour:'2-digit',hour12:false}));
export async function nightly(env:Env,at=new Date()){
 if(hour(at)!==22)return 0;
 const date=today(at),now=at.getTime();
 const payload=JSON.stringify({title:'OKGU DIARY',body:'오늘 일기를 아직 쓰지 않았어요. 잠깐 기록해볼까요?',url:env.APP_URL,tag:'daily-diary-reminder-'+date});
 const result=await env.DB.prepare("INSERT INTO push_jobs(id,event_key,account_id,payload,status,created_at,updated_at) SELECT lower(hex(randomblob(16))),'nightly:'||?||':'||a.id,a.id,?,'pending',?,? FROM accounts a WHERE a.active=1 AND a.role='student' AND EXISTS(SELECT 1 FROM push_subscriptions s WHERE s.account_id=a.id AND s.enabled=1) AND NOT EXISTS(SELECT 1 FROM diaries d WHERE d.author_id=a.id AND d.diary_date=? AND d.deleted_at IS NULL) ON CONFLICT(event_key) DO NOTHING").bind(date,payload,now,now,date).run();
 return result.meta.changes;
}
function access(job:Row,at:Date){const a={...job,id:job.account_id} as Account,payload=JSON.parse(job.payload),g=payload.guard;
 if(job.created_at<at.getTime()-7*86400000)return {sql:'0',params:[]};
 if(job.event_key.startsWith('nightly:')){const day=job.event_key.split(':')[1];return day===today(at)&&hour(at)>=22?{sql:'NOT EXISTS(SELECT 1 FROM diaries d WHERE d.author_id=? AND d.diary_date=? AND d.deleted_at IS NULL)',params:[job.account_id,day]}:{sql:'0',params:[]};}
 if(!g)return {sql:'0',params:[]};
 if(g.type==='teacher-activity'){
  if(g.kind==='diary')return {sql:"?='teacher' AND EXISTS(SELECT 1 FROM diaries d WHERE d.id=? AND d.class_id=? AND d.visibility<>'private' AND "+(g.deleted?'d.deleted_at IS NOT NULL':'d.deleted_at IS NULL')+')',params:[job.role,g.link,job.class_id]};
  if(g.kind==='board'){const acl=boardACL(a);return {sql:"?='teacher' AND EXISTS(SELECT 1 FROM board_posts b WHERE b.id=? AND "+(g.deleted?"b.deleted_at IS NOT NULL AND EXISTS(SELECT 1 FROM accounts peer WHERE peer.id=b.author_id AND peer.class_id=?) AND (b.diary_id IS NULL OR EXISTS(SELECT 1 FROM diaries d WHERE d.id=b.diary_id AND d.visibility='class'))":acl.sql)+')'+(g.comment?' AND EXISTS(SELECT 1 FROM board_comments WHERE id=? AND post_id=? AND deleted_at IS NULL)':''),params:[job.role,g.link,...(g.deleted?[job.class_id]:acl.params),...(g.comment?[g.comment,g.link]:[])]};}
  return {sql:'0',params:[]};
 }
 if(['diary','comment','reply'].includes(g.type)){const acl=diaryACL(a);return {sql:'EXISTS(SELECT 1 FROM diaries d WHERE d.id=? AND '+acl.sql+')'+(g.comment?' AND EXISTS(SELECT 1 FROM diary_comments WHERE id=? AND diary_id=? AND deleted_at IS NULL)':''),params:[g.link,...acl.params,...(g.comment?[g.comment,g.link]:[])]};}
 if(g.type==='board'){const acl=boardACL(a);return {sql:'EXISTS(SELECT 1 FROM board_posts b WHERE b.id=? AND '+acl.sql+')'+(g.comment?' AND EXISTS(SELECT 1 FROM board_comments WHERE id=? AND post_id=? AND deleted_at IS NULL)':''),params:[g.link,...acl.params,...(g.comment?[g.comment,g.link]:[])]};}
 if(g.type==='praise')return {sql:"EXISTS(SELECT 1 FROM praises p JOIN accounts s ON s.id=p.sender_id WHERE p.id=? AND (recipient_id=? OR (?='teacher' AND recipient_id=?)) AND approval='approved' AND hidden=0 AND p.deleted_at IS NULL AND s.class_id=?)",params:[g.link,job.account_id,job.role,'homeroom:'+job.class_id,job.class_id]};
 if(g.type==='praise-review')return {sql:"?='teacher' AND EXISTS(SELECT 1 FROM praises p JOIN accounts s ON s.id=p.sender_id WHERE p.id=? AND approval='pending' AND p.deleted_at IS NULL AND s.class_id=?)",params:[job.role,g.link,job.class_id]};
 return {sql:g.type==='test'?'1':'0',params:[]};
}
export async function dispatch(env:Env,transport:typeof fetch=fetch,at=new Date(),limit=8){
 if(env.PUSH_MODE!=='live'||env.ALLOW_LIVE_PUSH!=='approved'||!env.PUSH_SERVER_SECRET||!env.PUSH_SERVER_URL)return {blocked:true,sent:0};
 const now=at.getTime(),control=await env.DB.prepare('SELECT writes_paused FROM operation_control WHERE id=1').first<Row>();
 if(env.WRITE_MODE==='paused'||!control||control.writes_paused)return {blocked:true,sent:0};
 // A terminated invocation may already have delivered. Never reclaim it for sending.
 await env.DB.prepare("UPDATE push_jobs SET status='unknown',failure_code='INTERRUPTED',updated_at=? WHERE status='dispatching' AND updated_at<?").bind(now,now-15*60000).run();
 // Eight jobs bound this invocation's D1 query count, including expired endpoint cleanup.
 const jobs=await all(env,"SELECT j.*,a.role,a.class_id FROM push_jobs j JOIN accounts a ON a.id=j.account_id WHERE j.status='pending' AND j.next_attempt_at<=? AND j.attempts<3 AND a.active=1 ORDER BY j.created_at,j.id LIMIT ?",[now,Math.min(8,Math.max(1,limit))]);
 let sent=0;
 for(const job of jobs){const allowed=access(job,at);const claim=await env.DB.prepare("UPDATE push_jobs SET status='dispatching',attempts=attempts+1,updated_at=? WHERE id=? AND status='pending' AND next_attempt_at<=? AND attempts<3 AND EXISTS(SELECT 1 FROM accounts WHERE id=? AND active=1 AND role=? AND class_id=?) AND "+allowed.sql).bind(now,job.id,now,job.account_id,job.role,job.class_id,...allowed.params).run();
 if(!claim.meta.changes){
 // Another dispatcher may have finished a preflight refusal and scheduled a
 // retry after this invocation read the job. Cancel only a lost permission,
 // never a competing claim or a newly deferred retry.
 await env.DB.prepare("UPDATE push_jobs SET status='cancelled',updated_at=? WHERE id=? AND status='pending' AND NOT (EXISTS(SELECT 1 FROM accounts WHERE id=? AND active=1 AND role=? AND class_id=?) AND ("+allowed.sql+'))').bind(now,job.id,job.account_id,job.role,job.class_id,...allowed.params).run();continue;}
 const subs=await all(env,'SELECT * FROM push_subscriptions WHERE account_id=? AND enabled=1',[job.account_id]);
 if(!subs.length){await env.DB.prepare("UPDATE push_jobs SET status='cancelled',updated_at=? WHERE id=?").bind(at.getTime(),job.id).run();continue;}
 // Existing push server has no idempotency key. Timeout remains unknown and is never auto-resubmitted.
 try{const payload=JSON.parse(job.payload);delete payload.guard;
 const response=await transport(env.PUSH_SERVER_URL,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+env.PUSH_SERVER_SECRET},body:JSON.stringify({...payload,subscriptions:subs.map(s=>JSON.parse(s.subscription))}),signal:AbortSignal.timeout(10000)});
 const result:any=await response.json();
 // These exact legacy-server responses occur BEFORE sendNotification is called.
 // Other HTTP errors, timeouts, partial deliveries and provider rejections are ambiguous.
 const preflight=!result.ok&&((response.status===500&&result.error==='push server env not configured')||(response.status===401&&result.error==='unauthorized')||(response.status===400&&result.error==='invalid json'));
 if(preflight){const attempts=job.attempts+1;await env.DB.prepare("UPDATE push_jobs SET status=?,failure_code='PRE_DISPATCH_REJECTED',next_attempt_at=?,updated_at=? WHERE id=? AND status='dispatching'").bind(attempts<3?'pending':'failed',now+(attempts===1?60000:300000),now,job.id).run();continue;}
 if(!response.ok||result.ok!==true||!Number.isInteger(result.sent)||!Number.isInteger(result.failed)||result.sent<0||result.failed<0||result.sent+result.failed!==subs.length||!Array.isArray(result.expired))throw new Error('transport');
 const owned=new Set(subs.map(s=>JSON.parse(s.subscription).endpoint));
 const expired=[...new Set(result.expired.filter((e:unknown)=>typeof e==='string'&&owned.has(e)))];
 if(expired.length>result.failed)throw new Error('transport');
 if(expired.length)await env.DB.prepare("UPDATE push_subscriptions SET enabled=0 WHERE account_id=? AND json_extract(subscription,'$.endpoint') IN(SELECT value FROM json_each(?))").bind(job.account_id,JSON.stringify(expired)).run();
 const status=result.failed===0?'sent':result.sent>0?'partial':expired.length===subs.length?'expired':'unknown';
 await env.DB.prepare('UPDATE push_jobs SET status=?,failure_code=?,accepted_count=?,failed_count=?,updated_at=? WHERE id=?').bind(status,result.failed?'PROVIDER_REJECTED':null,result.sent,result.failed,now,job.id).run();
 if(result.sent>0)sent++;
 }catch{await env.DB.prepare("UPDATE push_jobs SET status='unknown',failure_code='AMBIGUOUS_DELIVERY',updated_at=? WHERE id=?").bind(now,job.id).run();}
 }
 return {blocked:false,sent};
}
