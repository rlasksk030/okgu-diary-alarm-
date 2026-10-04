// Offline patch for the CURRENT deployed Code.gs. No GAS/Sheets/trigger mutations.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,relative} from 'node:path';
import {createHash} from 'node:crypto';
export const guarded=['_callPushServer','scheduledDiaryReminderPush','changePin','uploadPhoto','uploadPhotoChunk','saveEntry','deleteEntry','deleteEntryAsTeacher','deleteBoard','toggleLike','addComment','editComment','deleteComment','sendPraise','setPraiseStatus','setPraiseHidden','deletePraiseAsTeacher','addTeacherComment','addStudentReplyToDiary','deleteTeacherComment','editTeacherComment','setStudentCounselFlag','savePushSubscription','disablePushSubscription'];
export function patchGas(source){
 if(source.includes('_okguCloudflareOnly_'))throw Error('E_ALREADY_PATCHED_REVIEW_CURRENT_DEPLOYMENT');
 let result=source;
 for(const name of guarded){const pattern=new RegExp('(function\\s+'+name+'\\s*\\([^)]*\\)\\s*\\{)','g');if([...source.matchAll(pattern)].length!==1)throw Error('E_CURRENT_SOURCE_REVIEW_REQUIRED');result=result.replace(pattern,'$1\n  _okguCloudflareOnly_();');}
 return result+"\nfunction _okguCloudflareOnly_(){if(PropertiesService.getScriptProperties().getProperty('OKGU_CLOUDFLARE_ONLY')==='yes')throw new Error('앱이 업데이트되었어요. 작성한 글과 사진은 이 창에 남아 있어요. 내용을 보관한 뒤 앱을 다시 열어 저장해 주세요.');}\n";
}
if(process.argv[1]&&resolve(process.argv[1])===new URL(import.meta.url).pathname){
 const file=resolve(process.argv[2]||'');if(!relative(resolve('.local'),file)||relative(resolve('.local'),file).startsWith('..'))throw Error('E_PRIVATE_SOURCE_REQUIRED');
 const source=await readFile(file,'utf8'),candidate=patchGas(source);await mkdir('.local/incident',{recursive:true,mode:0o700});
 await writeFile('.local/incident/Code.cutover.private.gs',candidate,{mode:0o600});
 console.log(JSON.stringify({offlineOnly:true,functions:guarded.length,sourceSha256:createHash('sha256').update(source).digest('hex'),candidate:'.local/incident/Code.cutover.private.gs',activation:'Deploy as NEW VERSION of the EXISTING web app deployment, then set OKGU_CLOUDFLARE_ONLY=yes. Read/export functions remain available. Verify in-flight executions have finished.'}));
}
