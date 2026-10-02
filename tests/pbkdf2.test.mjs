import test from 'node:test';import assert from 'node:assert/strict';import {pbkdf2Sync} from 'node:crypto';
import {derivePinBits} from '../worker/pbkdf2.ts';
const salt='0123456789abcdef0123456789abcdef';
test('600000-round fallback matches independent Node PBKDF2 output and preserves leading zero PIN',async()=>{
 let attempts=0;const limited={importKey:crypto.subtle.importKey.bind(crypto.subtle),deriveBits:async()=>{attempts++;throw new DOMException('Pbkdf2 failed: iteration counts above 100000 are not supported (requested 600000).','NotSupportedError');}};
 const actual=Buffer.from(await derivePinBits('0042',salt,600000,limited));assert.deepEqual(actual,pbkdf2Sync('0042',salt,600000,32,'sha256'));
 assert.notDeepEqual(actual,pbkdf2Sync('42',salt,600000,32,'sha256'));
 const second=Buffer.from(await derivePinBits('0042',salt,600000,limited));assert.deepEqual(second,actual);assert.equal(attempts,1);
});
test('native format stays compatible; weaker iterations and unrelated errors fail closed',async()=>{
 assert.deepEqual(Buffer.from(await derivePinBits('0042',salt,600000)),pbkdf2Sync('0042',salt,600000,32,'sha256'));
 await assert.rejects(derivePinBits('0042',salt,100000),/E_PIN_HASH_STRENGTH/);
 const broken={importKey:crypto.subtle.importKey.bind(crypto.subtle),deriveBits:async()=>{throw new Error('synthetic crypto failure');}};await assert.rejects(derivePinBits('0042',salt,600000,broken),/synthetic crypto failure/);
});
test('dedicated DO sync fallback preserves every round and UTF-8/PIN format',async()=>{const limited={importKey:crypto.subtle.importKey.bind(crypto.subtle),deriveBits:async()=>{throw new DOMException('Pbkdf2 failed: iteration counts above 100000 are not supported (requested 600000).','NotSupportedError');}};const engines=[];for(const pin of ['0042','가상🔑']){assert.deepEqual(Buffer.from(await derivePinBits(pin,salt,600000,limited,e=>engines.push(e),'sync')),pbkdf2Sync(pin,salt,600000,32,'sha256'));}assert(engines.includes('fallback-sync'));});
