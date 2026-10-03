// A review gate, not a remote controller. It never pauses/imports/deploys anything.
import {createHash} from 'node:crypto';
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
export function cutoverProof(first,second,evidence){
 const valid=raw=>raw.format==='okgu-sheet-raw-export-v2'&&raw.complete===true&&raw.synthetic===false&&raw.timeZone==='Asia/Seoul'&&raw.provenance?.originalSourceNotModified===true&&raw.provenance?.sourceChangedDuringCapture===false&&Object.keys(raw.sheets||{}).length>0&&Array.isArray(raw.photos)&&Array.isArray(raw.photoReferences)&&Array.isArray(raw.sourcePhotoInventory);
 if(!valid(first)||!valid(second))throw Error('COMPLETE_V2_CAPTURES_REQUIRED');
 if(!first.provenance.sourceSpreadsheetId||first.provenance.sourceSpreadsheetId!==second.provenance.sourceSpreadsheetId)throw Error('SOURCE_ID_MISMATCH');
 if(evidence.ownerConfirmedPausedDeployment!==true||evidence.pendingWrites!==0||evidence.pendingOldPushExecutions!==0||evidence.freezeGuardVerified!==true||typeof evidence.deploymentVersion!=='string'||!evidence.deploymentVersion.trim()||!Number.isFinite(Date.parse(evidence.pausedAt)))throw Error('LIVE_FREEZE_EVIDENCE_REQUIRED');
 const start=Date.parse(evidence.pausedAt),a=Date.parse(first.capturedAt),ae=Date.parse(first.completedAt),b=Date.parse(second.capturedAt),be=Date.parse(second.completedAt);
 if(![start,a,ae,b,be].every(Number.isFinite)||a<start||ae<a||b<ae||be<b)throw Error('CAPTURE_MUST_FOLLOW_PAUSE_AND_DRAIN');
 const sheets=raw=>Object.fromEntries(Object.entries(raw.sheets).sort(([a],[b])=>a.localeCompare(b)).map(([name,s])=>[name,{headers:s.headers,rows:s.rows}]));
 const photos=raw=>raw.photos.map(p=>({id:p.id,mime:p.mime,size:p.size,sha256:p.sha256})).sort((a,b)=>a.id.localeCompare(b.id));
 const inventory=raw=>(raw.sourcePhotoInventory||[]).map(p=>({id:p.id,folderId:p.folderId,mime:p.mime,size:p.size})).sort((a,b)=>a.id.localeCompare(b.id));
 if(hash(sheets(first))!==hash(sheets(second))||hash(photos(first))!==hash(photos(second))||hash(inventory(first))!==hash(inventory(second))||hash(first.photoReferences)!==hash(second.photoReferences))throw Error('SOURCE_CHANGED_BETWEEN_FINAL_CAPTURES');
 const ids=new Set();for(const p of second.photos){if(ids.has(p.id)||!p.id||!Number.isInteger(p.size)||p.size<0||!/^[a-f0-9]{64}$/.test(p.sha256))throw Error('FINAL_PHOTO_MANIFEST_INVALID');ids.add(p.id);}
 if(second.photoReferences.some(r=>!ids.has(r.id))||second.sourcePhotoInventory?.some(p=>!ids.has(p.id)))throw Error('FINAL_PHOTO_MISSING');
 return {format:1,eligibleForPrivateDataComparison:true,finalSourceCriterionAt:second.capturedAt,finalCaptureCompletedAt:second.completedAt,sheetCount:Object.keys(second.sheets).length,photoCount:second.photos.length,referenceCount:second.photoReferences.length,sourceWritesRequested:false,productionSwitched:false,limits:['Owner deployment/pending execution statements must be checked in the original project','No D1/R2 bytes/content/ACL comparison or Pages switch is certified by this gate']};
}
