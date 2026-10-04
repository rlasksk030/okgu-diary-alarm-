// Produces a private deployment candidate. Requires Apps Script deployment access to apply.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
const source=await readFile(process.argv[2],'utf8');
const functions=['login','changePin','uploadPhoto','uploadPhotoChunk','saveEntry','deleteEntry','deleteEntryAsTeacher','deleteBoard','toggleLike','addComment','editComment','deleteComment','sendPraise','setPraiseStatus','setPraiseHidden','deletePraiseAsTeacher','addTeacherComment','addStudentReplyToDiary','deleteTeacherComment','editTeacherComment','setStudentCounselFlag','savePushSubscription','disablePushSubscription','_callPushServer','scheduledDiaryReminderPush'];
let code=source;
for(const name of functions){const pattern=new RegExp('(function\\s+'+name+'\\s*\\([^)]*\\)\\s*\\{)','g');assert.equal([...code.matchAll(pattern)].length,1);code=code.replace(pattern,'$1\n  _okguCloudOnly_();');}
code+='\nfunction _okguCloudOnly_(){throw new Error("이전 앱의 저장은 종료되었습니다. 작성 내용을 보관한 뒤 https://rlasksk030.github.io/okgu-diary-alarm-/ 에서 다시 로그인해 주세요.");}\n';
await mkdir('.local/gas-retirement',{recursive:true,mode:0o700});
await writeFile('.local/gas-retirement/Code.cloud-only.private.gs',code,{mode:0o600});
console.log(JSON.stringify({guardedFunctions:functions.length,sourceRowsModified:false,deployed:false}));
