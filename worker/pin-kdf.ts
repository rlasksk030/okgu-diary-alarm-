import {derivePinBits} from './pbkdf2';
import {boundedBody} from './body';
import {type Env} from './types';
// Private Durable Object binding only; the public Worker exposes no KDF route.
// No storage, account permissions, sessions, timers or credential-result cache.
export class PinKdf {
 constructor(_state:DurableObjectState,private env:Env){}
 async fetch(request:Request):Promise<Response>{
  if(request.method!=='POST'||new URL(request.url).pathname!=='/derive')return new Response('Not found',{status:404});
  let data:any;try{data=JSON.parse(new TextDecoder().decode(await boundedBody(request,1024,'E_INPUT')));}catch{return new Response('Invalid input',{status:400});}
  if(!data||typeof data.pin!=='string'||data.pin.length>20||typeof data.salt!=='string'||!/^[a-f0-9]{32}$/.test(data.salt)||!Number.isInteger(data.iterations)||data.iterations<600000||data.iterations>1000000)return new Response('Invalid input',{status:400});
  const diagnostic=this.env.TEST_MODE==='synthetic-trial'&&this.env.LOGIN_DIAGNOSTICS==='stage-only';
  try{const bits=await derivePinBits(data.pin,data.salt,data.iterations,crypto.subtle,engine=>{if(diagnostic)console.log('kdf_engine',engine);},'sync');if(diagnostic)console.log('kdf_done');return new Response(bits,{headers:{'Content-Type':'application/octet-stream','Cache-Control':'no-store'}});}
  catch{if(diagnostic)console.error('kdf_failure');return new Response('KDF unavailable',{status:503});}
 }
}
export async function deriveForAccount(pin:string,salt:string,iterations:number,env?:Env,accountKey?:string):Promise<ArrayBuffer>{
 if(!env?.LOGIN_KDF)return derivePinBits(pin,salt,iterations);
 if(!accountKey)throw new Error('E_KDF_ACCOUNT_KEY');
 const object=env.LOGIN_KDF.get(env.LOGIN_KDF.idFromName('pin:'+accountKey));
 const response=await object.fetch('https://kdf.internal/derive',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pin,salt,iterations}),signal:AbortSignal.timeout(20000)});
 if(!response.ok)throw new Error('E_KDF_UNAVAILABLE');const bits=await boundedBody(response,32,'E_KDF_OUTPUT');if(bits.byteLength!==32)throw new Error('E_KDF_OUTPUT');return new Uint8Array(bits).buffer;
}
