import {createHash} from 'node:crypto';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
export const trialNames={worker:'okgu-diary-trial',database:'okgu-diary-trial',bucket:'okgu-diary-trial-private'};
export function requireTrialBranch(branch=process.env.WORKERS_CI_BRANCH||spawnSync('git',['branch','--show-current'],{encoding:'utf8'}).stdout.trim()){
 if(branch!=='codex/2026-10-02-okgu-speed')throw new Error('E_TRIAL_BRANCH: only codex/2026-10-02-okgu-speed');
}
export function cloudflareClient({account=process.env.CLOUDFLARE_ACCOUNT_ID,token=process.env.CLOUDFLARE_API_TOKEN,transport=fetch}={}){
 if(!account||!/^[a-f0-9]{32}$/i.test(account)||!token)throw new Error('E_CLOUDFLARE_CONFIG: set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN securely in Codex environment settings');
 const call=async(method,path,body)=>{let response;try{response=await transport('https://api.cloudflare.com/client/v4'+path,{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(30000)});}catch{throw new Error('E_CLOUDFLARE_NETWORK: check saved api.cloudflare.com policy and TLS/proxy readiness');}
 let result;try{result=await response.json();}catch{throw new Error('E_CLOUDFLARE_RESPONSE: HTTP '+response.status);}
 if(!response.ok||!result.success){const codes=Array.isArray(result.errors)?result.errors.map(e=>e.code).filter(Number.isInteger).slice(0,10):[];const error=new Error('E_CLOUDFLARE_API: HTTP '+response.status+' codes '+codes.join(',')+'; no billing or permission changes attempted');error.status=response.status;throw error;}
 return result.result;
 };
 return {account,call,accountCall:(method,path,body)=>call(method,'/accounts/'+account+path,body)};
}
export async function verifyTrialData(client,id){
 if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id))throw new Error('E_TRIAL_DATABASE_UUID');
 const info=await client.accountCall('GET','/d1/database/'+id);
 if(info.name!==trialNames.database)throw new Error('E_TRIAL_DATABASE_NAME: refuses non-trial D1');
 const query=async sql=>{const r=await client.accountCall('POST','/d1/database/'+id+'/query',{sql});if(!r?.[0]?.success)throw new Error('E_TRIAL_DATA_INSPECTION');return r[0].results;};
 const schema=await query("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name<>'d1_migrations'");
 if(schema.length&&!schema.some(t=>t.name==='accounts'))throw new Error('E_TRIAL_UNKNOWN_SCHEMA: existing D1 requires review');
 if(schema.some(t=>t.name==='accounts')){
  const snapshot=JSON.parse(await readFile(new URL('../../fixtures/snapshot.json',import.meta.url),'utf8'));
  const stable=(source,entity,id)=>{const h=createHash('sha256').update(JSON.stringify([source,entity,id])).digest('hex');return h.slice(0,8)+'-'+h.slice(8,12)+'-5'+h.slice(13,16)+'-a'+h.slice(17,20)+'-'+h.slice(20,32);};
  const expected=new Map();
  for(const r of snapshot.entities['학생계정']){const id=stable(snapshot.sourceId,'학생계정',r.id);expected.set(id,{id,legacy_identity:snapshot.sourceId+':'+r.id,display_name:r.cells['이름'],class_id:snapshot.classId,role:r.cells['역할']==='선생님'?'teacher':'student'});}
  for(let i=1;i<=13;i++){const id=stable('synthetic-load','account',String(i));expected.set(id,{id,legacy_identity:'synthetic-load:'+i,display_name:'시험학생'+String(i).padStart(2,'0'),class_id:snapshot.classId,role:'student'});}
  const otherClass=stable('synthetic-foreign','class','1');
  for(const [name,role] of [['가상다른반교사','teacher'],['가상다른반학생','student']]){const id=stable('synthetic-foreign','account',role);expected.set(id,{id,legacy_identity:'synthetic-foreign:'+role,display_name:name,class_id:otherClass,role});}
  for(const classId of [snapshot.classId,otherClass]){const id='homeroom:'+classId;expected.set(id,{id,legacy_identity:'system:'+id,display_name:'담임',class_id:classId,role:'teacher',active:0});}
  const accounts=await query('SELECT id,legacy_identity,display_name,class_id,role,active FROM accounts');
  if(accounts.some(a=>{const e=expected.get(a.id);return !e||Object.entries(e).some(([k,v])=>a[k]!==v);}))throw new Error('E_TRIAL_NON_SYNTHETIC_ACCOUNTS: no writes permitted');

 }
 return info;
}
export async function provisionTrial(client,{existingId}={}){
 const verified=await client.call('GET','/user/tokens/verify');
 if(verified.status!=='active')throw new Error('E_CLOUDFLARE_TOKEN_INACTIVE');
 let database;
 if(existingId)database=await verifyTrialData(client,existingId);
 else{const listed=await client.accountCall('GET','/d1/database?name='+trialNames.database+'&per_page=100');const matches=listed.filter(x=>x.name===trialNames.database);if(matches.length>1)throw new Error('E_AMBIGUOUS_TRIAL_DATABASE');
 database=matches[0]||await client.accountCall('POST','/d1/database',{name:trialNames.database});
 await verifyTrialData(client,database.uuid);
 }
 let bucket;try{bucket=await client.accountCall('GET','/r2/buckets/'+trialNames.bucket);}catch(error){if(error.status!==404)throw error;bucket=await client.accountCall('POST','/r2/buckets',{name:trialNames.bucket,storageClass:'Standard'});}
 if(bucket.name!==trialNames.bucket)throw new Error('E_TRIAL_BUCKET_NAME');
 const managed=await client.accountCall('GET','/r2/buckets/'+trialNames.bucket+'/domains/managed');
 const custom=await client.accountCall('GET','/r2/buckets/'+trialNames.bucket+'/domains/custom');
 if(managed.enabled!==false||!Array.isArray(custom.domains)||custom.domains.length)throw new Error('E_TRIAL_BUCKET_PUBLIC: public URLs/custom domains must be disabled; no auto-modification attempted');
 return {format:1,worker:trialNames.worker,databaseName:trialNames.database,databaseId:database.uuid,bucketName:trialNames.bucket,push:'disabled',syntheticOnly:true};
}
export async function saveTrialResources(resources){
 await mkdir('.local',{recursive:true,mode:0o700});
 await writeFile('.local/trial-resources.json',JSON.stringify(resources,null,2)+'\n',{mode:0o600});
}
export async function trialDatabaseId(){
 if(process.env.OKGU_TRIAL_D1_DATABASE_ID)return process.env.OKGU_TRIAL_D1_DATABASE_ID;
 try{const r=JSON.parse(await readFile('.local/trial-resources.json','utf8'));if(r.syntheticOnly&&r.databaseName===trialNames.database&&r.bucketName===trialNames.bucket)return r.databaseId;}catch{}
 return '';
}
