import test from 'node:test';import assert from 'node:assert/strict';
import {cloudflareClient,provisionTrial,verifyTrialData,requireTrialBranch} from '../scripts/lib/trial-cloudflare.mjs';
const uuid='11111111-1111-4111-a111-111111111111';
function setup({publicBucket=false,foreignName=false,nonSynthetic=false,tokenStatus='active'}={}){
 const calls=[];let exists=false,bucketExists=false;
 const transport=async(url,options)=>{const path=new URL(url).pathname.replace('/client/v4',''),method=options.method;calls.push({method,path});
  const reply=result=>Response.json({success:true,result});
  if(path==='/user/tokens/verify')return reply({status:tokenStatus});
  if(path.endsWith('/d1/database')&&method==='GET')return reply(exists?[{name:'okgu-diary-trial',uuid}]:[]);
  if(path.endsWith('/d1/database')&&method==='POST'){exists=true;return reply({name:'okgu-diary-trial',uuid});}
  if(path.endsWith('/d1/database/'+uuid))return reply({name:foreignName?'operating-app':'okgu-diary-trial',uuid});
  if(path.endsWith('/query')){const sql=JSON.parse(options.body).sql;return reply([{success:true,results:sql.includes('sqlite_master')?(nonSynthetic?[{name:'accounts'}]:[]):[{n:1}]}]);}
  if(path.endsWith('/r2/buckets/okgu-diary-trial-private')){if(bucketExists)return reply({name:'okgu-diary-trial-private'});return Response.json({success:false,errors:[{code:10006,message:'synthetic secret must not be echoed'}]},{status:404});}
  if(path.endsWith('/r2/buckets')&&method==='POST'){bucketExists=true;return reply({name:'okgu-diary-trial-private'});}
  if(path.endsWith('/domains/managed'))return reply({enabled:publicBucket});
  if(path.endsWith('/domains/custom'))return reply({domains:[]});
  throw new Error('Unexpected endpoint '+path);
 };
 return {client:cloudflareClient({account:'1'.repeat(32),token:'synthetic-only',transport}),calls};
}
test('trial provision creates only dedicated D1/private R2 and repeats without duplication or billing actions',async()=>{const {client,calls}=setup();assert.equal((await provisionTrial(client)).databaseId,uuid);await provisionTrial(client);assert.equal(calls.filter(c=>c.method==='POST'&&c.path.endsWith('/d1/database')).length,1);assert.equal(calls.filter(c=>c.method==='POST'&&c.path.endsWith('/r2/buckets')).length,1);assert(calls.every(c=>!c.path.includes('billing')&&!c.path.includes('subscriptions')&&c.method!=='PUT'&&c.method!=='DELETE'));});
test('foreign database, real accounts and public bucket are rejected before deployment; token checks cannot create resources',async()=>{for(const [options,code] of [[{foreignName:true},'E_TRIAL_DATABASE_NAME'],[{nonSynthetic:true},'E_TRIAL_NON_SYNTHETIC_ACCOUNTS'],[{publicBucket:true},'E_TRIAL_BUCKET_PUBLIC'],[{tokenStatus:'expired'},'E_CLOUDFLARE_TOKEN_INACTIVE']]){const {client,calls}=setup(options);await assert.rejects(provisionTrial(client,{existingId:uuid}),e=>e.message.includes(code));assert(calls.every(c=>!c.path.includes('/workers/scripts')&&!c.path.includes('billing')));if(options.foreignName||options.nonSynthetic||options.tokenStatus)assert(!calls.some(c=>c.method==='POST'&&c.path.endsWith('/r2/buckets')));}});
test('missing credentials, malformed IDs and main are rejected; response messages never echo provider secrets',async()=>{assert.throws(()=>cloudflareClient({account:'',token:''}),/E_CLOUDFLARE_CONFIG/);assert.throws(()=>requireTrialBranch('main'),/E_TRIAL_BRANCH/);const {client}=setup();await assert.rejects(verifyTrialData(client,'malformed'),/E_TRIAL_DATABASE_UUID/);await assert.rejects(client.accountCall('GET','/r2/buckets/okgu-diary-trial-private'),e=>!e.message.includes('synthetic secret'));});
