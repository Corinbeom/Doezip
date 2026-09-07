'use strict';

let toastTimer, loadingTimer, previousFocus;
const routeNames={explore:'문제 탐색',detail:'문제 소개',workspace:'분석·보고서 작성',challenge:'검산 챌린지',feedback:'1차 리포트',defense:'되묻기',revise:'보고서 수정',final:'최종 리포트',learning:'내 학습'};
function currentRoute(){return location.hash.slice(1)||'explore';}
function safeRoute(route){
  if(!routeNames[route]) return 'explore';
  if(['workspace','challenge','feedback','defense','revise','final'].includes(route)&&!state.started) return 'detail';
  if(route==='challenge'&&!state.initialSubmitted) return 'workspace';
  if(['feedback','defense'].includes(route)&&!state.challengeSubmitted) return state.initialSubmitted?'challenge':'workspace';
  if(route==='revise'&&!state.answersSubmitted) return state.challengeSubmitted?'defense':state.initialSubmitted?'challenge':'workspace';
  if(route==='final'&&!state.completed) return continuation();
  return route;
}
function go(route){closeModal();const target=safeRoute(route);if(target==='workspace')state.mobilePanel='source';if(target==='challenge')state.mobilePanel='statements';persist();if(location.hash==='#'+target)render(true);else location.hash=target;}
function render(scroll=true){
  const requested=currentRoute(),route=safeRoute(requested);
  if(route!==requested){history.replaceState(null,'','#'+route);}
  const focusId=document.activeElement?.id,selection=document.activeElement?.selectionStart;
  const views={explore,detail,workspace,challenge,feedback,defense,revise,final:finalReport,learning};
  $('#main').innerHTML=views[route]();
  if(!scroll) $$('.fade-in').forEach(el=>el.classList.remove('fade-in'));
  document.title=`${routeNames[route]} · 되짚`;
  $$('[data-nav]').forEach(a=>{const active=a.dataset.nav===(route==='learning'?'learning':'explore');a.classList.toggle('active',active);if(active)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
  if(route==='workspace'&&state.initialSubmitted){$$('#chat-form textarea,#chat-form button,.chat-hints button').forEach(el=>el.disabled=true);const note=$('.composer-note');if(note)note.textContent='최초 분석 대화입니다. 제출한 기록은 그대로 보관돼요.';}
  if(scroll){window.scrollTo(0,0);$('#main').focus({preventScroll:true});}
  else if(focusId){const el=document.getElementById(focusId);if(el){el.focus({preventScroll:true});if(typeof selection==='number'&&el.setSelectionRange)el.setSelectionRange(selection,selection);}}
  const chat=$('#chat-messages');if(chat&&state.messages.length)chat.scrollTop=chat.scrollHeight;
}
function toast(message){clearTimeout(toastTimer);const el=$('#toast');el.textContent=message;el.classList.add('visible');toastTimer=setTimeout(()=>el.classList.remove('visible'),3200);}
function showError(id,message){const el=document.getElementById(id);if(el){el.textContent=message;el.scrollIntoView({block:'nearest',behavior:'smooth'});}else toast(message);}
function modal(title,body,actions='',wide=false){
  clearTimeout(loadingTimer);previousFocus=document.activeElement;
  $('#modal-root').innerHTML=`<div class="modal-backdrop"><section class="modal ${wide?'wide-modal':''}" role="dialog" aria-modal="true" aria-labelledby="modal-title"><header class="modal-header"><h2 id="modal-title">${title}</h2><button class="close-btn" aria-label="닫기" data-action="close-modal">${icon('x')}</button></header>${body}${actions?`<div class="modal-actions">${actions}</div>`:''}</section></div>`;
  document.body.style.overflow='hidden';$$('.site-header,#main,.site-footer,.preview-strip').forEach(el=>el.inert=true);
  $('.modal button')?.focus();
}
function closeModal(){if(!$('#modal-root').children.length)return;$('#modal-root').innerHTML='';document.body.style.overflow='';$$('.site-header,#main,.site-footer,.preview-strip').forEach(el=>el.inert=false);if(previousFocus?.isConnected)previousFocus.focus({preventScroll:true});}
function confirmModal(title,body,action,label){modal(title,body,`<button class="btn secondary" data-action="close-modal">돌아가기</button><button class="btn primary" data-action="${action}">${label} ${arrow()}</button>`);}
function openSource(id){const e=evidenceInfo(id);if(!e.material)return;modal(`${e.material.title}`,`<p>${e.material.id} · 연결한 근거 L${e.line}</p><div class="modal-divider"></div>${e.material.lines.map((text,i)=>`<div class="source-line ${i+1===e.line?'selected':''}"><span class="ln">L${i+1}</span><span>${text}</span></div>`).join('')}`,`<button class="btn primary" data-action="close-modal">근거 확인 완료 ${icon('check')}</button>`,true);requestAnimationFrame(()=>$('.modal .selected')?.scrollIntoView({block:'nearest'}));}
function markReviewDirty(){
  review().saved=false;persist();
  const status=$('#review-state');if(status){status.textContent='작성 중';status.className='pill neutral';}
  const badge=$('.statement.active .pill');if(badge){badge.textContent='작성 중';badge.className='pill neutral';}
  const count=savedReviews().length,summary=$('.progress-copy strong'),meter=$('.meter');
  if(summary)summary.textContent=`${count} / ${statements.length}`;
  if(meter){meter.setAttribute('aria-valuenow',String(count));meter.querySelector('span').style.width=`${count/statements.length*100}%`;}
  const error=$('#review-error');if(error)error.textContent='';
}
function storedText(){return storageAvailable?'저장됨':'브라우저 저장 불가 · 화면을 닫기 전 기록을 복사해 주세요';}
function saveEditor(kind,value){if(kind==='report'&&!state.initialSubmitted)state.report=value;if(kind==='final'&&!state.completed)state.finalReport=value;persist();const count=$(`#${kind}-length`);if(count)count.textContent=`${value.length}자`;const status=$(`#${kind}-save`);if(status)status.innerHTML=icon('check')+storedText();}
function addChat(prompt){
  if(state.initialSubmitted)return toast('최초 제출한 분석 기록은 그대로 보관돼요.');
  const text=prompt.trim();if(!text)return toast('질문을 입력해 주세요.');
  state.messages.push({role:'user',text});
  state.messages.push({role:'assistant',text:'이 시안에서는 미리 작성된 안내를 보여드려요.\n\n먼저 M02의 시간대별 요청 기록을 읽고, M03의 자원 지표와 관찰 구간을 맞춰보세요.\n\n그다음 “자료에서 확인한 사실”과 “그 사실로 추론한 원인”을 나누어 적어보면 좋아요. 확인하지 못한 내용은 보고서에 질문으로 남겨보세요.'});
  state.mobilePanel='chat';persist();render(false);$('#chat-input')?.focus({preventScroll:true});
}
function applySample(kind){
  if(kind==='report'){state.report=sampleReport;state.mobilePanel='editor';}
  if(kind==='answers')state.answers=['12:04 이후 평균 응답 시간이 증가했다는 것은 요청 로그에서 확인했습니다. 외부 결제 서비스 자체의 장애라는 판단은 아직 가설입니다.','같은 시점의 호출 설정 변경이나 요청 경로별 소요 시간이 확인되면 외부 서비스 자체가 원인이라는 가설을 다시 살펴보겠습니다.'];
  if(kind==='revision'){state.finalReport=state.initialReport+'\n\n새 자료를 반영한 판단\n12:02의 재시도 횟수 변경이 응답 지연을 키웠을 가능성도 함께 검토해야 한다. 외부 서비스 자체의 장애로 단정하지 않고, 변경 전후의 요청 횟수와 누적 대기 시간을 확인하겠다.';state.reviseReason='추가된 설정 변경 기록을 보고 원인 가설을 넓혔습니다. 시간상 선후관계만으로 원인을 확정하지 않고 검증할 자료를 덧붙였습니다.';}
  closeModal();persist();render(false);toast('시안 체험을 위한 작성 예시를 넣었어요. 자유롭게 수정해 보세요.');
}
function sample(kind){const existing=kind==='report'?state.report:kind==='answers'?state.answers.join(''):state.finalReport!==state.initialReport||state.reviseReason;if(existing){confirmModal('작성 예시로 바꿀까요?','<p>현재 이 단계의 입력을 시안용 예시로 바꿉니다. 직접 작성한 내용을 유지하려면 돌아가 주세요.</p>',`confirm-sample-${kind}`,'예시로 바꾸기');}else applySample(kind);}
function recordPreview(){
  const content=['# 되짚 디자인 시안 — 나의 작성 기록','실제 AI 평가가 아닌, 브라우저에서 작성한 시안 체험 기록입니다.','## 최초 보고서',state.initialReport,'## 검산 기록',...savedReviews().map(s=>`${s.id} · ${judgments[review(s.id).judgment]}\n${s.text}\n이유: ${review(s.id).reason}\n근거: ${review(s.id).evidence.join(', ')}${review(s.id).revision?'\n수정: '+review(s.id).revision:''}`),'## 되묻기 답변',...state.answers.map((a,i)=>`Q${i+1}: ${a}`),'## 최종 보고서',state.finalReport,'## 판단을 수정·유지한 이유',state.reviseReason].join('\n\n');
  modal('내 작성 기록',`<p>전체 선택 후 Ctrl+C 또는 ⌘C로 복사해 보관할 수 있어요.</p><label class="sr-only" for="record-output">전체 학습 기록</label><textarea id="record-output" class="input-area record-output" readonly>${esc(content)}</textarea>`,`<button class="btn secondary" data-action="close-modal">닫기</button><button class="btn primary" data-action="select-record">전체 선택</button>`,true);
}
document.addEventListener('click',event=>{
  if(event.target.closest('.skip-link')){event.preventDefault();$('#main').focus();return;}
  const route=event.target.closest('[data-route]');if(route){go(route.dataset.route);return;}
  const button=event.target.closest('[data-action]');if(!button)return;
  const action=button.dataset.action;
  if(action==='close-modal'){closeModal();return;}
  if(action==='filter'){state.filter=button.dataset.filter;persist();render(false);return;}
  if(action==='start'){state.started=true;persist();go(continuation());return;}
  if(action==='panel'){state.mobilePanel=button.dataset.panel;persist();render(false);if(matchMedia('(max-width: 880px)').matches)$('.mobile-tabs')?.scrollIntoView({block:'start',behavior:'smooth'});return;}
  if(action==='statement'){state.activeStatement=button.dataset.statement;state.mobilePanel='review';persist();render(false);if(matchMedia('(max-width: 880px)').matches)$('.mobile-tabs')?.scrollIntoView({block:'start',behavior:'smooth'});return;}
  if(action==='evidence'){if(state.challengeSubmitted)return;const r=review(),id=button.dataset.evidence;r.evidence=r.evidence.includes(id)?r.evidence.filter(e=>e!==id):[...r.evidence,id];markReviewDirty();render(false);toast(r.evidence.includes(id)?`${id.replace('-',' · ')}을 검토에 연결했어요.`:'근거 연결을 해제했어요.');return;}
  if(action==='open-material'){state.activeSource=button.dataset.source;state.mobilePanel='source';persist();render(false);return;}
  if(action==='chat-example'){addChat(button.dataset.prompt);return;}
  if(action==='sample-report'){sample('report');return;}
  if(action==='sample-answers'){sample('answers');return;}
  if(action==='sample-revision'){sample('revision');return;}
  if(action.startsWith('confirm-sample-')){applySample(action.replace('confirm-sample-',''));return;}
  if(action==='begin-challenge'){
    if(state.initialSubmitted){go(state.challengeSubmitted?'feedback':'challenge');return;}
    if(!state.report.trim()){state.mobilePanel='editor';render(false);showError('report-error','보고서에 확인한 사실이나 현재 판단을 적어주세요.');$('#report-editor')?.focus();return;}
    confirmModal('이제, AI의 답을 되짚어볼까요?',`<p>작성한 보고서는 최초 제출본으로 보관합니다. 다음에는 <strong>별도로 준비된 검산용 AI 초안</strong>을 검토하게 돼요.</p><div class="modal-callout">원본 자료를 확인하고, 각 문장을 유지할지 수정할지 또는 근거가 부족한지 판단해 주세요.</div><p>내 보고서의 내용은 검산 과정에서 바뀌지 않아요.</p>`,'confirm-challenge','안내를 확인하고 시작');return;
  }
  if(action==='confirm-challenge'){state.initialReport=state.report;state.initialSubmitted=true;persist();go('challenge');return;}
  if(action==='save-review'){
    if(state.challengeSubmitted)return;
    const r=review();if(!r.judgment)return showError('review-error','문장에 대한 판단을 먼저 선택해 주세요.');if(!r.reason.trim())return showError('review-error','그렇게 판단한 이유를 적어주세요.');if(r.judgment==='correct'&&!r.revision.trim())return showError('review-error','수정한 문장을 적어주세요.');r.saved=true;persist();render(false);toast(`${state.activeStatement} 검토를 저장했어요.`);return;
  }
  if(action==='submit-challenge'){
    const dirty=statements.find(s=>{const r=state.reviews[s.id];return r&&!r.saved&&(r.judgment||r.reason||r.revision||r.evidence.length);});
    if(dirty){state.activeStatement=dirty.id;state.mobilePanel='review';persist();render(false);showError('review-error',`${dirty.id}의 작성 중인 검토를 먼저 저장해 주세요. 입력한 내용은 보존되어 있어요.`);return;}
    const count=savedReviews().length;if(!count){state.mobilePanel='review';render(false);showError('review-error','문장을 하나 이상 검토하고 저장해 주세요.');return;}
    confirmModal('검산을 제출할까요?',`<p>저장한 검토 <strong>${count}개</strong>를 제출합니다.</p>${count<4?`<div class="modal-callout">아직 검토하지 않은 문장이 ${4-count}개 있어요. 미검토 상태로 제출되며, 완료한 검토만 리포트에 표시됩니다.</div>`:''}<p>제출한 판단과 근거는 이후 수정할 수 없어요.</p>`,'confirm-submit','제출하고 피드백 보기');return;
  }
  if(action==='confirm-submit'){
    state.challengeSubmitted=true;persist();closeModal();go('feedback');return;
  }
  if(action==='source-modal'){openSource(button.dataset.evidence);return;}
  if(action==='begin-defense'){state.defenseEntered=true;persist();go(state.answersSubmitted?'revise':'defense');return;}
  if(action==='report-modal'){modal('처음 작성한 보고서',`<div class="document-body">${esc(state.initialReport)}</div>`,`<button class="btn primary" data-action="close-modal">계속 답변하기 ${arrow()}</button>`,true);return;}
  if(action==='submit-final'){
    if(!state.finalReport.trim())return showError('revision-error','최종 보고서 내용을 작성해 주세요.');if(!state.reviseReason.trim())return showError('revision-error','판단을 수정하거나 유지한 이유를 적어주세요.');
    confirmModal('이번 학습을 마무리할까요?','<p>최종 보고서와 판단의 이유를 보관하고, 처음의 기록과 나란히 보여드릴게요. 제출 후에는 내용을 변경할 수 없어요.</p>','confirm-final','최종 제출');return;
  }
  if(action==='confirm-final'){state.completed=true;persist();go('final');return;}
  if(action==='export-notes'){recordPreview();return;}
  if(action==='select-record'){$('#record-output').focus();$('#record-output').select();toast('전체 기록을 선택했어요. Ctrl+C 또는 ⌘C로 복사해 주세요.');return;}
  if(action==='reset'){confirmModal('처음부터 다시 연습할까요?','<p>이 브라우저에 저장된 <strong>이 시안의 학습 기록만</strong> 초기화합니다. 이전 기록이 필요하다면 최종 리포트의 ‘내 작성 기록 보기’에서 먼저 복사해 주세요.</p>','confirm-reset','시안 기록 초기화');return;}
  if(action==='confirm-reset'){state=initialState();persist();go('explore');toast('새로운 연습을 시작할 준비가 됐어요.');return;}
  if(action==='guide'){modal('되짚, 이렇게 경험해 보세요',`<p>AI와 함께 풀고, 근거로 확인하고, 내 판단을 다시 설명하는 연습이에요.</p><ol class="guide-list"><li>문제를 선택하고 원본 자료를 읽어요.</li><li>AI 예시 대화를 살펴보고 나의 보고서를 써요.</li><li>별도 초안의 문장을 검토하고 원문을 연결해요.</li><li>피드백을 확인하고 두 가지 질문에 답해요.</li><li>새 조건으로 보고서를 수정한 뒤 전후를 비교해요.</li></ol><div class="modal-callout">빠르게 둘러보려면 보고서·답변의 ‘예시 넣기’를 활용해 보세요. 검산은 문장 하나만 저장해도 미검토 안내 후 제출할 수 있어요.</div><p>이 화면은 디자인 검토용입니다. 가상 자료와 미리 작성된 안내를 사용하며, 실제 로그인·AI 호출·평가는 진행하지 않아요.</p>`,`<button class="btn primary" data-action="close-modal">알겠어요 ${icon('check')}</button>`);}
});
document.addEventListener('input',event=>{
  const {id,value}=event.target;
  if(id==='report-editor'){saveEditor('report',value);const error=$('#report-error');if(error)error.textContent='';}
  if(id==='final-editor')saveEditor('final',value);
  if(id==='review-reason'&&!state.challengeSubmitted){review().reason=value;markReviewDirty();}
  if(id==='review-revision'&&!state.challengeSubmitted){review().revision=value;markReviewDirty();}
  if(id.startsWith('answer-')&&!state.answersSubmitted){state.answers[Number(id.slice(-1))]=value;persist();const error=$('#defense-error');if(error)error.textContent='';}
  if(id==='revision-reason'&&!state.completed){state.reviseReason=value;persist();const error=$('#revision-error');if(error)error.textContent='';}
});
document.addEventListener('change',event=>{
  if(event.target.id==='source-select'){state.activeSource=event.target.value;persist();render(false);}
  if(event.target.name==='judgment'&&!state.challengeSubmitted){review().judgment=event.target.value;markReviewDirty();render(false);$(`input[name="judgment"][value="${review().judgment}"]`)?.focus({preventScroll:true});}
});
document.addEventListener('submit',event=>{
  if(event.target.id==='chat-form'){event.preventDefault();addChat($('#chat-input').value);}
  if(event.target.id==='defense-form'){
    event.preventDefault();if(state.answersSubmitted){go('revise');return;}
    const missing=state.answers.findIndex(a=>!a.trim());if(missing>=0){showError('defense-error','두 질문에 모두 생각을 남긴 뒤 다음 단계로 넘어가 주세요.');$(`#answer-${missing}`)?.focus();return;}
    state.defenseEntered=true;state.answersSubmitted=true;state.finalReport=state.initialReport;persist();go('revise');
  }
});
document.addEventListener('keydown',event=>{
  const dialog=$('.modal');if(dialog){
    if(event.key==='Escape'){event.preventDefault();closeModal();return;}
    if(event.key==='Tab'){const focusable=$$('button:not(:disabled),a[href],input:not(:disabled),textarea:not(:disabled),select:not(:disabled)',dialog),first=focusable[0],last=focusable.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}}
  }
  if(event.target.id==='chat-input'&&event.key==='Enter'&&!event.shiftKey&&!event.isComposing){event.preventDefault();addChat(event.target.value);}
});
window.addEventListener('hashchange',()=>{closeModal();render(true);});
render(true);
