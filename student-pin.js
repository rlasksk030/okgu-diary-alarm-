/* Teacher-only addition. Reuse the existing PIN sheet and student card styles. */
(function(){
'use strict';
let active=null;
const overlay=document.createElement('div');overlay.id='student-pin-overlay';overlay.className='pin-sheet-overlay';
overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.setAttribute('aria-labelledby','student-pin-title');
overlay.innerHTML='<div class="pin-sheet"><div class="pin-sheet-handle"></div><div class="pin-sheet-title" id="student-pin-title"></div><label class="pin-label" style="display:block" for="student-pin-new">새 PIN (숫자 4자리)</label><input class="pin-input" type="password" inputmode="numeric" autocomplete="new-password" id="student-pin-new" maxlength="4" placeholder="••••"><label class="pin-label" style="display:block" for="student-pin-confirm">새 PIN 확인</label><input class="pin-input" type="password" inputmode="numeric" autocomplete="new-password" id="student-pin-confirm" maxlength="4" placeholder="••••"><div class="pin-msg" id="student-pin-msg" role="status" aria-live="polite"></div><button class="pin-btn" id="student-pin-save">저장</button><button class="pin-cancel" id="student-pin-cancel">취소</button></div>';
document.body.appendChild(overlay);
const input=document.getElementById('student-pin-new'),confirm=document.getElementById('student-pin-confirm'),msg=document.getElementById('student-pin-msg'),save=document.getElementById('student-pin-save'),cancel=document.getElementById('student-pin-cancel');
function busy(value){input.disabled=confirm.disabled=save.disabled=cancel.disabled=value;save.textContent=value?'저장 중...':'저장';}
function clear(){active=null;overlay.classList.remove('open');input.value=confirm.value=msg.textContent='';busy(false);}
function close(){if(active?.busy)return;const trigger=active?.trigger;clear();trigger?.focus();}
overlay.addEventListener('click',e=>{if(e.target===overlay)close();});cancel.onclick=close;
overlay.addEventListener('keydown',e=>{if(e.key==='Escape')close();});
function open(student,trigger){if(active?.busy||currentUser?.role!=='선생님')return;clear();active={student,trigger,busy:false};document.getElementById('student-pin-title').textContent=student.name+' · PIN 재설정';msg.style.color='';overlay.classList.add('open');input.focus();}
async function submit(){
 const state=active;if(!state||state.busy||currentUser?.role!=='선생님')return;
 msg.style.color='';
 if(!/^\d{4}$/.test(input.value)){msg.textContent='새 PIN은 숫자 4자리로 입력해 주세요.';return;}
 if(input.value!==confirm.value){msg.textContent='새 PIN이 일치하지 않아요.';return;}
 const payload=input.value;if(state.payload!==payload){state.payload=payload;state.requestId=crypto.randomUUID();}
 state.busy=true;busy(true);msg.textContent='';
 try{
  const response=await OKGUAPI.call('resetStudentPin',[state.student.id,payload,confirm.value],{requestId:state.requestId});
  if(active!==state)return;
  if(response.success!==true)throw new Error('저장 결과를 확인하지 못했어요. 다시 시도해 주세요.');
  input.value=confirm.value='';state.payload=null;
  msg.style.color='#16a34a';msg.textContent=state.student.name+'의 PIN을 재설정했어요. 다음 접속 시 새 PIN으로 로그인해 주세요.';
  save.hidden=true;input.disabled=confirm.disabled=true;cancel.textContent='닫기';
 }catch(e){if(active!==state)return;msg.textContent=e.code==='E_FORBIDDEN'?'이 학생의 PIN을 변경할 권한이 없어요. 담당 학생인지 확인해 주세요.':e.code==='E_CONFLICT'?'다른 변경과 충돌했어요. 닫고 학생 목록을 다시 연 뒤 재시도해 주세요.':e.message||'연결을 확인한 뒤 다시 시도해 주세요.';}
 finally{if(active===state){state.busy=false;busy(false);if(save.hidden)input.disabled=confirm.disabled=true;}}
}
save.onclick=submit;confirm.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();submit();}});
const original=renderStudentList;
window.renderStudentList=function(){original();if(currentUser?.role!=='선생님')return;let list=classOverview;if(studentFilter==='wrote')list=list.filter(s=>s.wroteToday);if(studentFilter==='no')list=list.filter(s=>!s.wroteToday);document.querySelectorAll('#ds-student-list .student-card').forEach((card,i)=>{
 const student=list[i];if(!student?.id)return;
 const button=document.createElement('button');button.type='button';button.dataset.okguPinReset=student.id;button.textContent='PIN 재설정';button.setAttribute('aria-label',student.name+' PIN 재설정');
 button.style.cssText='font-size:var(--fs-tiny);font-weight:600;padding:3px 8px;border-radius:99px;cursor:pointer;font-family:var(--font);background:#fff;color:var(--text3);border:1px solid var(--border2);';
 button.onclick=()=>{save.hidden=false;cancel.textContent='취소';open(student,button);};card.querySelector('.wrote-chip').parentElement.appendChild(button);
 });};
window.addEventListener('okgu-account-reset',()=>{clear();save.hidden=false;cancel.textContent='취소';});
})();
