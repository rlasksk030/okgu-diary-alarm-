import {AppError,type Env,type Account,type Row} from './types';
import {digest,hashPin,hex} from './auth';

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Recheck live authority inside the same D1 transaction as the mutation.
const authority=`EXISTS(SELECT 1 FROM sessions s JOIN accounts t ON t.id=s.account_id JOIN accounts u ON u.class_id=t.class_id WHERE s.token_hash=? AND s.expires_at>? AND t.id=? AND t.active=1 AND t.role='teacher' AND u.id=? AND u.active=1 AND u.role='student')`;
function equal(a:string,b:string){let diff=a.length^b.length;for(let i=0;i<Math.max(a.length,b.length);i++)diff|=(a.charCodeAt(i)||0)^(b.charCodeAt(i)||0);return diff===0;}
function result(row:Row,payload:string){if(!equal(row.payload_hash,payload))throw new AppError('E_CONFLICT',409);const value=JSON.parse(row.result);if(value.success!==true)throw new AppError('E_CONFLICT',409);return value;}

export async function resetStudentPin(env:Env,a:Account,token:string,body:any){
 if(a.role!=='teacher')throw new AppError('E_FORBIDDEN',403);
 const [id,pin,confirmation]=body.args;
 if(typeof id!=='string'||!id.length||id.length>128||typeof body.requestId!=='string'||!uuid.test(body.requestId))throw new AppError('E_INPUT');
 if(typeof pin!=='string'||!/^\d{4}$/.test(pin)||typeof confirmation!=='string'||pin!==confirmation)throw new AppError('E_PIN_FORMAT');
 const tokenHash=await digest(token),auth=()=>[tokenHash,Date.now(),a.id,id];
 const target=await env.DB.prepare(`SELECT u.id,u.display_name,c.pin_hash FROM accounts u JOIN credentials c ON c.account_id=u.id WHERE u.id=? AND ${authority}`).bind(id,...auth()).first<Row>();
 if(!target)throw new AppError('E_FORBIDDEN',403);
 // A plain SHA-256 receipt of a four-digit PIN would enable offline guessing.
 // Bind retry verification to the high-entropy raw teacher session, never stored in D1.
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(token),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const payload=hex(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(JSON.stringify({method:'resetStudentPin',id,pin}))));
 const previous=await env.DB.prepare('SELECT payload_hash,result FROM receipts WHERE account_id=? AND request_id=?').bind(a.id,body.requestId).first<Row>();
 if(previous)return result(previous,payload);
 const hash=await hashPin(pin,env,id),nonce=crypto.randomUUID(),now=Date.now();
 const owned='EXISTS(SELECT 1 FROM receipts WHERE account_id=? AND request_id=? AND nonce=?)',owner=[a.id,body.requestId,nonce];
 const success=JSON.stringify({success:true,studentId:id,studentName:target.display_name});
 // DB.batch is atomic. A fresh salted credential is the proof that this reset won
 // the CAS. Only that winner revokes sessions; receipt replay never revokes again.
 await env.DB.batch([
  env.DB.prepare('INSERT INTO receipts(account_id,request_id,payload_hash,nonce,result,created_at) VALUES(?,?,?,?,?,?) ON CONFLICT DO NOTHING').bind(a.id,body.requestId,payload,nonce,'{}',now),
  env.DB.prepare(`UPDATE credentials SET pin_hash=? WHERE account_id=? AND pin_hash=? AND ${owned} AND ${authority}`).bind(hash,id,target.pin_hash,...owner,...auth()),
  env.DB.prepare(`UPDATE receipts SET result=? WHERE account_id=? AND request_id=? AND nonce=? AND EXISTS(SELECT 1 FROM credentials WHERE account_id=? AND pin_hash=?) AND ${authority}`).bind(success,...owner,id,hash,...auth()),
  env.DB.prepare(`DELETE FROM sessions WHERE account_id=? AND EXISTS(SELECT 1 FROM receipts WHERE account_id=? AND request_id=? AND nonce=? AND result=?)`).bind(id,...owner,success)
 ]);
 const receipt=await env.DB.prepare('SELECT payload_hash,result FROM receipts WHERE account_id=? AND request_id=?').bind(a.id,body.requestId).first<Row>();
 if(!receipt)throw new AppError('E_CONFLICT',409);
 return result(receipt,payload);
}
