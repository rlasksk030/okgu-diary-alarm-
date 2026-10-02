import {pbkdf2,pbkdf2Async} from '@noble/hashes/pbkdf2.js';
import {sha256} from '@noble/hashes/sha2.js';
const encoder=new TextEncoder(),limited=new WeakSet<SubtleCrypto>();
export async function derivePinBits(pin:string,salt:string,iterations:number,subtle:SubtleCrypto=crypto.subtle,observe?:(engine:'native'|'fallback'|'fallback-sync')=>void,mode:'yielding'|'sync'='yielding'):Promise<ArrayBuffer>{
 if(!Number.isInteger(iterations)||iterations<600000||iterations>1000000)throw new RangeError('E_PIN_HASH_STRENGTH');
 if(!limited.has(subtle)){
  observe?.('native');const key=await subtle.importKey('raw',encoder.encode(pin),'PBKDF2',false,['deriveBits']);
  try{return await subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:encoder.encode(salt),iterations},key,256);}
  catch(error){
   // Workers' native iteration cap must never reduce the stored KDF strength.
   // Other crypto failures are not silently converted into a fallback.
   if(!(error instanceof Error)||!/Pbkdf2 failed: iteration counts above \d+ are not supported/i.test(error.message))throw error;
   limited.add(subtle);
  }
 }
 // Same PBKDF2-HMAC-SHA256, salt encoding, iteration count and 256-bit output.
 // Yielding keeps the event loop responsive; it does not bypass CPU accounting.
 observe?.(mode==='sync'?'fallback-sync':'fallback');
 // The private DO has its own compute budget. The library's sync loop avoids
 // one clock read/callback per round; every PBKDF2 round and state wipe remains.
 const bytes=mode==='sync'?pbkdf2(sha256,encoder.encode(pin),encoder.encode(salt),{c:iterations,dkLen:32}):await pbkdf2Async(sha256,encoder.encode(pin),encoder.encode(salt),{c:iterations,dkLen:32,asyncTick:8});
 return new Uint8Array(bytes).buffer;
}
