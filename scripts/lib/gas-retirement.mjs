import assert from 'node:assert/strict';
export const guardedFunctions=['login','changePin','uploadPhoto','uploadPhotoChunk','saveEntry','deleteEntry','deleteEntryAsTeacher','deleteBoard','toggleLike','addComment','editComment','deleteComment','sendPraise','setPraiseStatus','setPraiseHidden','deletePraiseAsTeacher','addTeacherComment','addStudentReplyToDiary','deleteTeacherComment','editTeacherComment','setStudentCounselFlag','savePushSubscription','disablePushSubscription','_callPushServer','scheduledDiaryReminderPush'];
export function retireGas(source){
 let code=source;
 for(const name of guardedFunctions){const pattern=new RegExp('(function\\s+'+name+'\\s*\\([^)]*\\)\\s*\\{)','g');assert.equal([...code.matchAll(pattern)].length,1);code=code.replace(pattern,'$1\n  _okguCloudOnly_();');}
 // Reject every JSONP method, including internal helpers reachable via globalThis[fn].
 for(const name of ['doGet','_handleJsonpRpc_']){const pattern=new RegExp('(function\\s+'+name+'\\s*\\(\\s*e\\s*\\)\\s*\\{)','g');assert.equal([...code.matchAll(pattern)].length,1);code=code.replace(pattern,'$1\n  return _okguCloudReply_(e);');}
 if(/function\s+doPost\s*\(/.test(code))throw new Error('Review existing doPost before retirement');
 // The retired server cannot send push; never duplicate its bearer secret in the candidate.
 const secret=/(\b(?:const|var|let)\s+PUSH_SECRET\s*=\s*)(['"])([^'"\r\n]*)\2/g;
 assert.equal([...code.matchAll(secret)].length,1);
 code=code.replace(secret,"$1'' /* retired; secret retained only in Cloudflare/Vercel */");
 return code+`
function _okguCloudMessage_(){return "이전 앱의 저장은 종료되었습니다. 작성 내용을 보관한 뒤 https://rlasksk030.github.io/okgu-diary-alarm-/ 에서 다시 로그인해 주세요.";}
function _okguCloudOnly_(){throw new Error(_okguCloudMessage_());}
function _okguCloudReply_(e){
 var payload=JSON.stringify({ok:false,success:false,code:'E_CLOUD_REQUIRED',error:_okguCloudMessage_()});
 var callback=String(e && e.parameter && e.parameter.callback || '');
 if(/^[A-Za-z_$][0-9A-Za-z_$]*(\\.[A-Za-z_$][0-9A-Za-z_$]*)*$/.test(callback))
  return ContentService.createTextOutput(callback+'('+payload+');').setMimeType(ContentService.MimeType.JAVASCRIPT);
 return ContentService.createTextOutput(payload).setMimeType(ContentService.MimeType.JSON);
}
function doPost(e){return _okguCloudReply_(e);}
`;
}
