import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import vm from 'node:vm';import worker from '../worker/index.ts';
const script=await readFile('sw.js','utf8'),root='https://example.test/okgu-diary-alarm-/';
function harness(ack){const events={},opened=[],messages=[],notifications=[];let focused=0;
 class Channel{constructor(){this.port1={close(){}};this.port2={postMessage:data=>queueMicrotask(()=>this.port1.onmessage?.({data}))};}}
 const client={url:root,postMessage(data,ports){messages.push(data);if(ack!==undefined)ports[0].postMessage({handled:ack});},focus(){focused++;},navigate(){throw Error('DRAFT_WOULD_BE_LOST');}};
 vm.runInNewContext(script,{URL,MessageChannel:Channel,setTimeout:(fn,ms)=>setTimeout(fn,Math.min(ms,15)),clearTimeout,self:{location:{href:root+'sw.js'},addEventListener:(type,fn)=>events[type]=fn,registration:{showNotification:async(title,data)=>notifications.push({title,...data})},clients:{matchAll:async()=>[{url:'https://example.test/unrelated/'},client],openWindow:async url=>opened.push(url)}}});
 return {events,opened,messages,notifications,focused:()=>focused};
}
test('notification opens a fresh window when an old client ignores it or a draft is active; acknowledged client only focuses',async()=>{
 for(const ack of [undefined,false,true]){const h=harness(ack);let done;h.events.notificationclick({notification:{close(){},data:{url:root+'?open=diary&id=legacy'}},waitUntil:p=>done=p});await done;
 assert.equal(h.opened.length,ack===true?0:1);assert.equal(h.focused(),ack===true?1:0);assert.equal(h.messages[0].url,root+'?open=diary&id=legacy');}
});
test('malformed or foreign push URLs stay in this app',async()=>{for(const url of ['http://[','https://foreign.test/','/unrelated/']){const h=harness();let done;h.events.push({data:{json:()=>({url})},waitUntil:p=>done=p});await done;assert.equal(h.notifications[0].data.url,root);}});
test('configured server version barrier rejects stale writes/uploads before database mutations',async()=>{
 const env={WEB_ORIGINS:'https://example.test',MIN_CLIENT_VERSION:'current',DB:{prepare(){throw Error('UNEXPECTED_DB_WRITE');}}};
 for(const path of ['/api/rpc','/api/photos']){const r=await worker.fetch(new Request('https://api.test'+path,{method:'POST',headers:{Origin:'https://example.test','X-OKGU-Request':'1','Content-Type':'application/json'},body:JSON.stringify({method:'saveEntry',args:[]})}),env,{waitUntil(){}});assert.equal(r.status,409);assert.equal((await r.json()).code,'E_VERSION');}
});
