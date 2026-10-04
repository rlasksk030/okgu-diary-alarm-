// Bounded recovery for the observed text-only, teacher/private source records.
// Existing D1 records (including deleted records) are authoritative and untouched.
import {stableId,visibility,sourceFields,sha} from './core';
export function incidentEntry(row:unknown[],account:any,sourceId:string,relatedVerifiedEmpty:boolean){
 if(row.length!==12||!relatedVerifiedEmpty||!sourceId.startsWith('sheet:')||account.active!==1||!String(account.legacy_identity).startsWith(sourceId+':')||account.display_name!==row[2]||account.role!=='student')throw Error('E_SOURCE_IDENTITY_REVIEW');
 const cells=Object.fromEntries(sourceFields['일기기록'].map((k,i)=>[k,row[i]])),scope=visibility(cells);
 if(scope==='class'||String(row[11])!=='[]')throw Error('E_RELATED_RECORDS_REQUIRE_TARGETED_PLAN');
 const stamp=Date.parse(String(row[10]));
 if(typeof row[0]!=='string'||!row[0]||typeof row[6]!=='string'||!row[6].trim()||[...row[6]].length>2000||!Number.isFinite(stamp)||typeof row[1]!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(row[1])||new Date(row[1]).toISOString().slice(0,10)!==row[1]||![3,4,5].every(i=>typeof row[i]==='string'))throw Error('E_SOURCE_FIELDS');
 const entry={id:stableId(sourceId,'일기기록',row[0]),legacy_id:row[0],author_id:account.id,class_id:account.class_id,diary_date:row[1],body:row[6],mood_emoji:row[3],mood_label:row[4],mood_color:row[5],visibility:scope,legacy_secret:row[7]===true||row[7]==='TRUE'?1:0,created_at:stamp,updated_at:stamp,version:1,source_batch:'incident:'+sha(JSON.stringify(row)).slice(0,24)};
 const keys=Object.keys(entry);
 // ONE atomic INSERT. No UPDATE, REPLACE, delete, push, account or PIN mutation.
 return {entry,sql:`INSERT INTO diaries(${keys.join(',')}) SELECT ${keys.map(()=>'?').join(',')} WHERE EXISTS(SELECT 1 FROM accounts WHERE id=? AND legacy_identity=? AND display_name=? AND class_id=? AND role='student' AND active=1) AND NOT EXISTS(SELECT 1 FROM diaries WHERE id=? OR legacy_id=?) ON CONFLICT DO NOTHING`,params:[...Object.values(entry),account.id,account.legacy_identity,account.display_name,account.class_id,entry.id,entry.legacy_id]};
}
