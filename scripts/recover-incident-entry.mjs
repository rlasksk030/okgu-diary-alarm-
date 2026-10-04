// Default: read-only inspection. Select exactly one candidate by hash for --apply.
import {readFile,writeFile} from 'node:fs/promises';
import {cloudflareClient} from './lib/trial-cloudflare.mjs';
import {incidentEntry} from '../migration/incident-entry.ts';
import {sha} from '../migration/core.ts';
const args=process.argv.slice(2),option=name=>args[args.indexOf(name)+1];
const source=JSON.parse(await readFile('.local/incident/candidates.private.json','utf8'));
if(source.format!=='okgu-incident-candidates-v1'||source.candidates.length>2)throw Error('E_INCIDENT_SCOPE');
const client=cloudflareClient(),resources=await client.accountCall('GET','/d1/database?name=okgu-diary-production&per_page=100');
const found=resources.filter(d=>d.name==='okgu-diary-production');if(found.length!==1)throw Error('E_PRODUCTION_TARGET');const id=found[0].uuid;
const query=async(sql,params=[])=>{const r=await client.accountCall('POST','/d1/database/'+id+'/query',{sql,params});if(r.length!==1||!r[0].success)throw Error('E_INCIDENT_QUERY');return r[0];};
const sourceId='sheet:'+sha(source.sourceSpreadsheetId),report=[];
for(const c of source.candidates){
 const key=sha(c.row[0]);if(args.includes('--apply')&&key!==option('--key'))continue;
 const existing=(await query('SELECT * FROM diaries WHERE legacy_id=? OR id=?',[c.row[0],c.row[0]])).results;
 if(existing.length){report.push({key,status:'already-in-D1-preserved',visibility:existing[0].visibility,deleted:existing[0].deleted_at!==null});continue;}
 if(!args.includes('--apply')){report.push({key,status:'missing-in-D1',savedAt:c.row[10]});continue;}
 if(!args.includes('--source-rechecked')||!args.includes('--author-id')||!args.includes('--key'))throw Error('E_TARGET_AND_LATEST_SOURCE_REQUIRED');
 const accounts=(await query('SELECT * FROM accounts WHERE id=?',[option('--author-id')])).results;if(accounts.length!==1)throw Error('E_ACCOUNT_MAPPING');
 // Require the imported, stable account mapping as well as the source name.
 const maps=(await query("SELECT target_id FROM migration_records WHERE source_id=? AND entity='학생계정' AND target_id=?",[sourceId,accounts[0].id])).results;
 if(maps.length!==1)throw Error('E_ACCOUNT_MAPPING');
 const p=incidentEntry(c.row,accounts[0],sourceId,c.relatedVerifiedEmpty);
 const before=(await query('SELECT * FROM diaries WHERE id=? OR legacy_id=?',[p.entry.id,p.entry.legacy_id])).results;
 await writeFile('.local/incident/target-before.private.json',JSON.stringify({databaseId:id,key,rows:before}),{mode:0o600});
 if(before.length){report.push({key,status:'already-in-D1-preserved'});continue;}
 const inserted=await query(p.sql,p.params),after=(await query('SELECT * FROM diaries WHERE id=?',[p.entry.id])).results[0];
 if(!after||Object.entries(p.entry).some(([k,v])=>after[k]!==v))throw Error('E_TARGET_CHANGED_PRESERVED_REVIEW_REQUIRED');
 report.push({key,status:inserted.meta.changes===1?'inserted-and-verified':'already-in-D1-preserved',newNotifications:0});
}
if(!report.length)throw Error('E_CANDIDATE_NOT_SELECTED');
console.log(JSON.stringify({mode:args.includes('--apply')?'single-entry':'read-only',report}));
