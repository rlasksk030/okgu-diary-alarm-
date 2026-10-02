import {AppError,type Account,type Env} from './types';
const encoder=new TextEncoder();
export const hex=(data:ArrayBuffer)=>Array.from(new Uint8Array(data),b=>b.toString(16).padStart(2,'0')).join('');
export async function digest(value:string|ArrayBuffer){return hex(await crypto.subtle.digest('SHA-256',typeof value==='string'?encoder.encode(value):value));}
function salt(){return crypto.randomUUID().replace(/-/g,'');}
export async function hashPin(pin:string){const s=salt(),iterations=600000;const key=await crypto.subtle.importKey('raw',encoder.encode(pin),'PBKDF2',false,['deriveBits']);const bits=await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:encoder.encode(s),iterations},key,256);return `pbkdf2$${iterations}$${s}$${hex(bits)}`;}
export async function verifyPin(pin:string,stored:string){
 const parts=stored.split('$');let actual='';let expected='';
 if(parts[0]==='sha256'&&parts.length===3){const bytes=new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(parts[1]+'|'+pin)));actual=btoa(String.fromCharCode(...bytes));expected=parts[2];}
 else if(parts[0]==='pbkdf2'&&parts.length===4){const iterations=Number(parts[1]);if(!Number.isInteger(iterations)||iterations<600000||iterations>1000000||!/^[a-f0-9]{32}$/.test(parts[2])||!/^[a-f0-9]{64}$/.test(parts[3]))return false;const key=await crypto.subtle.importKey('raw',encoder.encode(pin),'PBKDF2',false,['deriveBits']);actual=hex(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:encoder.encode(parts[2]),iterations},key,256));expected=parts[3];}
 else return false;
 let diff=actual.length^expected.length;for(let i=0;i<Math.max(actual.length,expected.length);i++)diff|=(actual.charCodeAt(i)||0)^(expected.charCodeAt(i)||0);return diff===0;
}
export const pub=(a:Account)=>({success:true,id:a.id,name:a.display_name,role:a.role==='teacher'?'선생님':'학생',cls:a.label,token:''});
export async function session(env:Env,token:string):Promise<Account>{const hash=await digest(token);const a=await env.DB.prepare('SELECT a.*,c.label FROM sessions s JOIN accounts a ON a.id=s.account_id JOIN classes c ON c.id=a.class_id WHERE s.token_hash=? AND s.expires_at>? AND a.active=1').bind(hash,Date.now()).first<Account>();if(!a)throw new AppError('E_AUTH',401);return a;}
export async function login(env:Env,name:unknown,pin:unknown,remember:unknown){if(typeof name!=='string'||!name.trim()||name.length>80||typeof pin!=='string'||!pin.trim()||pin.length>20)throw new AppError('E_AUTH',401);const key=await digest(name.trim()),now=Date.now();
 await env.DB.prepare('INSERT INTO login_attempts(key,attempts,window_start) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN window_start<? THEN 1 ELSE attempts+1 END,window_start=CASE WHEN window_start<? THEN ? ELSE window_start END').bind(key,now,now-900000,now-900000,now).run();
 const [attempt,credential]=await env.DB.batch([env.DB.prepare('SELECT attempts FROM login_attempts WHERE key=?').bind(key),env.DB.prepare('SELECT c.* FROM credentials c JOIN accounts a ON a.id=c.account_id WHERE c.login_name=? AND a.active=1').bind(name.trim())]);if(Number((attempt.results[0] as any)?.attempts)>8)throw new AppError('E_RATE',429);
 const row=credential.results[0] as any;const fake='pbkdf2$600000$'+'0'.repeat(32)+'$'+'0'.repeat(64);if(!await verifyPin(pin.trim(),row?.pin_hash||fake)||!row)throw new AppError('E_AUTH',401);
 const newHash=row.pin_hash.startsWith('sha256$')?await hashPin(pin.trim()):row.pin_hash;
 const bytes=crypto.getRandomValues(new Uint8Array(32)),token=btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');const tokenHash=await digest(token);
 const changed=await env.DB.batch([env.DB.prepare('UPDATE credentials SET pin_hash=? WHERE account_id=? AND pin_hash=?').bind(newHash,row.account_id,row.pin_hash),env.DB.prepare('INSERT INTO sessions(token_hash,account_id,expires_at) SELECT ?,a.id,? FROM accounts a JOIN credentials c ON c.account_id=a.id WHERE a.id=? AND a.active=1 AND c.pin_hash=?').bind(tokenHash,now+(remember===true?30:7)*86400000,row.account_id,newHash),env.DB.prepare('DELETE FROM login_attempts WHERE key=?').bind(key)]);
 if(changed[1].meta.changes!==1){
  // Another successful legacy login may have upgraded the same hash first.
  const current=await env.DB.prepare('SELECT pin_hash FROM credentials WHERE account_id=?').bind(row.account_id).first<{pin_hash:string}>();
  if(!current||!await verifyPin(pin.trim(),current.pin_hash))throw new AppError('E_AUTH',401);
  const inserted=await env.DB.prepare('INSERT INTO sessions(token_hash,account_id,expires_at) SELECT ?,a.id,? FROM accounts a JOIN credentials c ON c.account_id=a.id WHERE a.id=? AND a.active=1 AND c.pin_hash=?').bind(tokenHash,now+(remember===true?30:7)*86400000,row.account_id,current.pin_hash).run();
  if(inserted.meta.changes!==1)throw new AppError('E_AUTH',401);
 }return {...pub(await session(env,token)),token};
}
