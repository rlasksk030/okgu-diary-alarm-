import {AppError,type Account,type Env} from './types';
import {deriveForAccount} from './pin-kdf';
const encoder=new TextEncoder();
export const hex=(data:ArrayBuffer)=>Array.from(new Uint8Array(data),b=>b.toString(16).padStart(2,'0')).join('');
export async function digest(value:string|ArrayBuffer){return hex(await crypto.subtle.digest('SHA-256',typeof value==='string'?encoder.encode(value):value));}
function salt(){return crypto.randomUUID().replace(/-/g,'');}
export async function hashPin(pin:string,env?:Env,accountKey?:string){const s=salt(),iterations=600000;return `pbkdf2$${iterations}$${s}$${hex(await deriveForAccount(pin,s,iterations,env,accountKey))}`;}
export async function verifyPin(pin:string,stored:string,env?:Env,accountKey?:string){
 const parts=stored.split('$');let actual='';let expected='';
 if(parts[0]==='sha256'&&parts.length===3){const bytes=new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(parts[1]+'|'+pin)));actual=btoa(String.fromCharCode(...bytes));expected=parts[2];}
 else if(parts[0]==='pbkdf2'&&parts.length===4){const iterations=Number(parts[1]);if(!Number.isInteger(iterations)||iterations<600000||iterations>1000000||!/^[a-f0-9]{32}$/.test(parts[2])||!/^[a-f0-9]{64}$/.test(parts[3]))return false;actual=hex(await deriveForAccount(pin,parts[2],iterations,env,accountKey));expected=parts[3];}
 else return false;
 let diff=actual.length^expected.length;for(let i=0;i<Math.max(actual.length,expected.length);i++)diff|=(actual.charCodeAt(i)||0)^(expected.charCodeAt(i)||0);return diff===0;
}
export const pub=(a:Account)=>({success:true,id:a.id,name:a.display_name,role:a.role==='teacher'?'선생님':'학생',cls:a.label,token:''});
async function accountForTokenHash(env:Env,hash:string):Promise<Account>{const a=await env.DB.prepare('SELECT a.*,c.label FROM sessions s JOIN accounts a ON a.id=s.account_id JOIN classes c ON c.id=a.class_id WHERE s.token_hash=? AND s.expires_at>? AND a.active=1').bind(hash,Date.now()).first<Account>();if(!a)throw new AppError('E_AUTH',401);return a;}
export async function session(env:Env,token:string):Promise<Account>{return accountForTokenHash(env,await digest(token));}
export type LoginStage='credential_read_begin'|'credential_read_done'|'pin_verify_begin'|'pin_verify_done'|'pin_upgrade_begin'|'pin_upgrade_done'|'session_create_begin'|'session_create_done'|'conflict_verify_begin'|'conflict_verify_done'|'session_validate_done';
export async function login(env:Env,name:unknown,pin:unknown,remember:unknown,observe?:(stage:LoginStage)=>void){
 const trace=(stage:LoginStage)=>{observe?.(stage);if(env.TEST_MODE==='synthetic-trial'&&env.LOGIN_DIAGNOSTICS==='stage-only')console.log('login_stage',stage);};
 if(typeof name!=='string'||!name.trim()||name.length>80||typeof pin!=='string'||!pin.trim()||pin.length>20)throw new AppError('E_AUTH',401);
 const loginName=name.trim(),secret=pin.trim(),key=await digest(loginName),now=Date.now();
 trace('credential_read_begin');
 const [,attempt,credential]=await env.DB.batch([
  env.DB.prepare('INSERT INTO login_attempts(key,attempts,window_start) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN window_start<? THEN 1 ELSE attempts+1 END,window_start=CASE WHEN window_start<? THEN ? ELSE window_start END').bind(key,now,now-900000,now-900000,now),
  env.DB.prepare('SELECT attempts FROM login_attempts WHERE key=?').bind(key),
  env.DB.prepare('SELECT c.* FROM credentials c JOIN accounts a ON a.id=c.account_id WHERE c.login_name=? AND a.active=1').bind(loginName)]);
 trace('credential_read_done');if(Number((attempt.results[0] as any)?.attempts)>8)throw new AppError('E_RATE',429);
 const row=credential.results[0] as any,fake='pbkdf2$600000$'+'0'.repeat(32)+'$'+'0'.repeat(64);
 trace('pin_verify_begin');if(!await verifyPin(secret,row?.pin_hash||fake,env,row?.account_id||'unknown:'+key.slice(0,2))||!row)throw new AppError('E_AUTH',401);trace('pin_verify_done');
 const legacy=row.pin_hash.startsWith('sha256$');let newHash=row.pin_hash;
 if(legacy){trace('pin_upgrade_begin');newHash=await hashPin(secret,env,row.account_id);trace('pin_upgrade_done');}
 const bytes=crypto.getRandomValues(new Uint8Array(32)),token=btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');const tokenHash=await digest(token),expires=now+(remember===true?30:7)*86400000;
 const insert=(verifiedHash:string)=>env.DB.prepare('INSERT INTO sessions(token_hash,account_id,expires_at) SELECT ?,a.id,? FROM accounts a JOIN credentials c ON c.account_id=a.id WHERE a.id=? AND a.active=1 AND c.pin_hash=?').bind(tokenHash,expires,row.account_id,verifiedHash);
 // Reset attempts only after this exact verified credential created a live session.
 const reset=(verifiedHash:string)=>env.DB.prepare('DELETE FROM login_attempts WHERE key=? AND EXISTS(SELECT 1 FROM sessions s JOIN accounts a ON a.id=s.account_id JOIN credentials c ON c.account_id=a.id WHERE s.token_hash=? AND a.id=? AND a.active=1 AND c.pin_hash=?)').bind(key,tokenHash,row.account_id,verifiedHash);
 const live=()=>env.DB.prepare('SELECT a.*,c.label FROM sessions s JOIN accounts a ON a.id=s.account_id JOIN classes c ON c.id=a.class_id WHERE s.token_hash=? AND s.expires_at>? AND a.active=1').bind(tokenHash,Date.now());
 trace('session_create_begin');
 const changed=await env.DB.batch([
  ...(legacy?[env.DB.prepare('UPDATE credentials SET pin_hash=? WHERE account_id=? AND pin_hash=?').bind(newHash,row.account_id,row.pin_hash)]:[]),
  insert(newHash),reset(newHash),live()]);
 let account=changed[legacy?3:2].results[0] as Account|undefined;
 if(changed[legacy?1:0].meta.changes!==1){
  // A changed credential must be verified again; an identical already-verified
  // hash needs no duplicate KDF. The atomic insert always rechecks active/hash.
  const current=await env.DB.prepare('SELECT pin_hash FROM credentials WHERE account_id=?').bind(row.account_id).first<{pin_hash:string}>();
  if(!current)throw new AppError('E_AUTH',401);
  if(current.pin_hash!==row.pin_hash){trace('conflict_verify_begin');if(!await verifyPin(secret,current.pin_hash,env,row.account_id))throw new AppError('E_AUTH',401);trace('conflict_verify_done');}
  const inserted=await env.DB.batch([insert(current.pin_hash),reset(current.pin_hash),live()]);
  if(inserted[0].meta.changes!==1)throw new AppError('E_AUTH',401);account=inserted[2].results[0] as Account|undefined;
 }
 trace('session_create_done');if(!account)throw new AppError('E_AUTH',401);trace('session_validate_done');return {...pub(account),token};
}
