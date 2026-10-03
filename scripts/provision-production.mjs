// Authorized production resources only; no source import, Pages publish or billing change.
import {requireTrialBranch,cloudflareClient} from './lib/trial-cloudflare.mjs';
import {mkdir,writeFile} from 'node:fs/promises';
try{
 requireTrialBranch();const client=cloudflareClient();
 const databases=await client.accountCall('GET','/d1/database?name=okgu-diary-production&per_page=100');
 const matches=databases.filter(d=>d.name==='okgu-diary-production');
 if(matches.length>1)throw Error('E_PRODUCTION_DATABASE_AMBIGUOUS');
 const db=matches[0]||await client.accountCall('POST','/d1/database',{name:'okgu-diary-production'});
 const tables=await client.accountCall('POST','/d1/database/'+db.uuid+'/query',{sql:"SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE '_cf_%' AND name NOT LIKE 'sqlite_%' AND name<>'d1_migrations'"});
 if(!tables[0]?.success)throw Error('E_PRODUCTION_INSPECTION');
 // Existing application data requires review; never migrate or reset it here.
 for(const t of tables[0].results){if(!/^[a-z_]+$/.test(t.name))throw Error('E_PRODUCTION_UNKNOWN_SCHEMA');if(t.name==='operation_control')continue;const rows=await client.accountCall('POST','/d1/database/'+db.uuid+'/query',{sql:'SELECT COUNT(*) n FROM "'+t.name+'"'});if(!rows[0]?.success||rows[0].results[0]?.n!==0)throw Error('E_PRODUCTION_ALREADY_HAS_DATA');}
 const bucketName='okgu-diary-production-private';
 try{await client.accountCall('GET','/r2/buckets/'+bucketName);}catch(e){if(e.status!==404)throw e;await client.accountCall('POST','/r2/buckets',{name:bucketName,storageClass:'Standard'});}
 const managed=await client.accountCall('GET','/r2/buckets/'+bucketName+'/domains/managed'),custom=await client.accountCall('GET','/r2/buckets/'+bucketName+'/domains/custom');
 if(managed.enabled!==false||!Array.isArray(custom.domains)||custom.domains.length)throw Error('E_PRODUCTION_BUCKET_PUBLIC');
 await mkdir('.local',{recursive:true,mode:0o700});
 await writeFile('.local/production-resources.private.json',JSON.stringify({format:1,databaseName:db.name,databaseId:db.uuid,bucketName,apiOrigin:'https://okgu-diary-api.rlasksk030.workers.dev',sourceImported:false}),{mode:0o600});
 console.log('Production-only D1 and private R2 prepared. No source import, Pages change, billing activation or live push.');
}catch(e){console.error(e?.message?.match(/\bE_[A-Z_]+\b/)?.[0]||'E_PRODUCTION_PREPARE');process.exitCode=1;}
