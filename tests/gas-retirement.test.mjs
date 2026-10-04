import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {retireGas,guardedFunctions} from '../scripts/lib/gas-retirement.mjs';
test('retirement rejects all HTTP RPC including helper bypasses before source writes',()=>{
 const source="const PUSH_SECRET='local-fixture-credential';\n"+
  guardedFunctions.map(n=>`function ${n}(){mutate();}`).join('\n')+
  '\nfunction doGet(e){return _handleJsonpRpc_(e);}\nfunction _handleJsonpRpc_(e){return globalThis[e.parameter.fn]();}\nfunction unguardedHelper(){mutate();}';
 const code=retireGas(source);assert(!code.includes('local-fixture-credential'));
 let mutations=0;const context={mutate(){mutations++;},ContentService:{MimeType:{JSON:'json',JAVASCRIPT:'js'},createTextOutput(text){return {text,setMimeType(type){this.type=type;return this;}};}}};
 vm.createContext(context);vm.runInContext(code,context);
 for(const fn of guardedFunctions)assert.throws(()=>context[fn](),/이전 앱의 저장은 종료/);
 for(const route of ['doGet','doPost','_handleJsonpRpc_'])for(const fn of ['saveEntry','unguardedHelper']){
  const r=context[route]({parameter:{fn,callback:'__jp1_20261004'}});
  assert.equal(r.type,'js');assert.match(r.text,/^__jp1_20261004\(/);assert.match(r.text,/E_CLOUD_REQUIRED/);
 }
 assert.equal(context.doGet({parameter:{callback:'alert(1)'}}).type,'json');
 assert.equal(mutations,0);
});
