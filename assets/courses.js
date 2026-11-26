(() => {
  'use strict';
  const $=id=>document.getElementById(id),P=window.BlanktimePlannerCore,app=window.BlanktimePlanner,D=window.BlanktimeData;
  const el=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;};
  const button=(label,fn)=>{const b=el('button',label);b.type='button';b.onclick=fn;return b;};
  let context=null;
  function initialDate(c){const today=P.dateKey(new Date()),from=today>c.from?today:c.from;let date=P.addDays(from,(c.weekday-P.day(from).getDay()+7)%7);if(date>c.to)date=P.addDays(c.from,(c.weekday-P.day(c.from).getDay()+7)%7);return date;}
  function linkedOptions(select,value){select.replaceChildren();const empty=el('option','不連結教材');empty.value='';select.append(empty);for(const p of Object.values(D.library().courses)){const o=el('option',p.title);o.value=p.courseId;select.append(o);}select.value=value||'';}
  function course(){return app.read().courses.find(c=>c.id===context?.id);}
  function renderDetail(){
    const state=app.read(),c=course();if(!c){$('course-detail-dialog').close();return;}
    const makeup=state.events.find(e=>e.id===context.makeupId),date=makeup?.date||context.date;
    $('course-detail-date').value=date;$('course-detail-date').disabled=context.locked;
    const info=$('course-detail-info');info.replaceChildren();
    for(const [label,value] of [['課名',c.title],['授課教授',c.professor||'尚未填寫'],['教室',c.room||'尚未填寫'],['固定上課','週'+['日','一','二','三','四','五','六'][c.weekday]+' '+c.start+'–'+c.end],['學期',c.from+' — '+c.to],...(makeup?[['本次補課',makeup.date+' '+makeup.start+'–'+makeup.end]]:[])])info.append(el('dt',label),el('dd',value));
    linkedOptions($('course-detail-link'),c.linkedCourseId);const pkg=D.library().courses[c.linkedCourseId],at=state.deadlines?.[c.linkedCourseId]?.at;
    $('course-detail-learn').hidden=!pkg;$('course-detail-deadline').textContent=pkg?(at?'考試／複習期限：'+new Date(at).toLocaleString('zh-TW')+'・'+app.deadlineLabel(at):'這門教材尚未設定考試／複習期限。'):'可以選擇綁定已匯入的教材。';
    const history=$('course-detail-history');history.replaceChildren();
    for(const original of [...c.exceptions].sort()){const replacements=state.events.filter(e=>e.rescheduledFrom?.courseId===c.id&&e.rescheduledFrom.date===original),row=el('article',undefined,'course-history-item');row.append(el('span',original+(replacements.length?' 調課 → '+replacements.map(e=>e.date+' '+e.start+'–'+e.end).join('、'):' 停課（不補課）')));
      row.append(button('撤銷恢復上課',async()=>{if(!await BlanktimeDialogs.ask('恢復 '+original+' 原時段上課？對應補課事項也會一併移除。',{accept:'恢復上課'}))return;try{app.replace(P.undoClassChange(app.read(),c.id,original,Date.now()));$('course-detail-status').textContent='已恢復原時段上課。';context.makeupId=null;renderDetail();}catch(e){$('course-detail-status').textContent=e.message;}}));history.append(row);
    }
    if(!c.exceptions.length)history.append(el('p','尚無停課或調課紀錄。','bt-muted'));
  }
  function open(id,date,makeupId){const c=app.read().courses.find(c=>c.id===id);if(!c)return;context={id,date:date||initialDate(c),locked:!!date,makeupId};$('course-detail-status').textContent='';$('course-detail-move-form').hidden=true;$('course-detail-move').setAttribute('aria-expanded','false');renderDetail();$('course-detail-dialog').showModal();}
  function openEvent(e){if(e.source==='course')open(e.id.slice(0,e.id.lastIndexOf('@')),e.date);else if(e.rescheduledFrom)open(e.rescheduledFrom.courseId,e.date,e.id);else app.editEvent(e);}
  $('course-detail-close').onclick=()=>$('course-detail-dialog').close();
  $('course-detail-date').onchange=e=>{context.date=e.target.value;};
  $('course-detail-link').onchange=e=>{const value=e.target.value;if(app.mutate(next=>{const c=next.courses.find(c=>c.id===context.id);if(!c)throw Error('課程已移除');c.linkedCourseId=value;c.updatedAt=Date.now();}))renderDetail();};
  $('course-detail-learn').onclick=()=>{const c=course(),pkg=D.library().courses[c?.linkedCourseId];if(!pkg)return;$('course-detail-dialog').close();const first=pkg.lessons.flatMap(l=>l.concepts).find(x=>!D.progress(pkg.courseId).includes(x.id))||pkg.lessons[0].concepts[0];D.openConcept(pkg.courseId,first.id);};
  $('course-detail-move').onclick=()=>{const f=$('course-detail-move-form'),c=course();f.hidden=!f.hidden;$('course-detail-move').setAttribute('aria-expanded',String(!f.hidden));const e=app.read().events.find(e=>e.id===context.makeupId);f.elements.date.value=e?.date||context.date;f.elements.start.value=e?.start||c.start;f.elements.end.value=e?.end||c.end;};
  $('course-detail-move-form').onsubmit=e=>{e.preventDefault();const f=e.currentTarget.elements;try{let next=app.read();if(context.makeupId){const row=next.events.find(e=>e.id===context.makeupId);if(!row)throw Error('這筆補課已變更');Object.assign(row,{date:f.date.value,start:f.start.value,end:f.end.value,updatedAt:Date.now()});P.validate(next);}else next=P.reschedule(next,context.id,context.date,f.date.value,f.start.value,f.end.value,Date.now(),crypto.randomUUID());app.replace(next);$('course-detail-move-form').hidden=true;$('course-detail-move').setAttribute('aria-expanded','false');$('course-detail-status').textContent='調課已儲存，排程會避開補課時間。';renderDetail();}catch(error){$('course-detail-status').textContent=error.message;}};
  $('course-detail-cancel').onclick=async()=>{if(!await BlanktimeDialogs.ask('將 '+context.date+' 設為停課且不安排補課？',{accept:'確認停課'}))return;try{if(context.makeupId){if(!app.mutate(next=>{next.events=next.events.filter(e=>e.id!==context.makeupId);next.tombstones.push(context.makeupId);}))throw Error('尚未儲存停課，請確認本機儲存空間');context.makeupId=null;}else app.replace(P.cancelClass(app.read(),context.id,context.date,Date.now()));$('course-detail-status').textContent='已停課，不建立補課事項。';renderDetail();}catch(e){$('course-detail-status').textContent=e.message;}};
  $('course-detail-edit').onclick=()=>{const c=course();$('course-detail-dialog').close();app.editCourse(c);};
  $('course-detail-remove').onclick=async()=>{await app.remove(context.id);if(!course())$('course-detail-dialog').close();};
  function render(){
    const courses=app.read().courses,host=$('course-list');host.replaceChildren();const grid=el('div',undefined,'timetable');grid.setAttribute('role','group');grid.setAttribute('aria-label','每週固定課表');
    const corner=el('div','時間','tt-corner');grid.append(corner);for(let i=0;i<7;i++){const h=el('div','週'+['一','二','三','四','五','六','日'][i],'tt-heading'+(i>=5?' weekend':''));h.style.gridColumn=i+2;grid.append(h);}
    const scale=el('div',undefined,'tt-scale');for(let hour=8;hour<=22;hour++){const t=el('span',String(hour).padStart(2,'0')+':00');t.style.top=(hour-8)*60+'px';scale.append(t);}grid.append(scale);
    for(let i=0;i<7;i++){const col=el('div',undefined,'tt-day'+(i>=5?' weekend':''));col.style.gridColumn=i+2;col.dataset.weekday=(i+1)%7;grid.append(col);}
    for(const p of P.timetable(courses)){const c=courses.find(x=>x.id===p.id),b=button('',()=>open(c.id));b.className='tt-course';b.append(el('strong',c.title),el('span',c.start+'–'+c.end));b.title=c.title+' '+c.start+'–'+c.end;Object.assign(b.style,{top:p.top+'px',height:Math.max(p.height,22)+'px',left:(p.lane/p.lanes*100)+'%',width:(100/p.lanes)+'%'});grid.querySelector('[data-weekday="'+c.weekday+'"]').append(b);}
    host.append(grid);const outside=courses.filter(c=>P.minutes(c.end)<=480||P.minutes(c.start)>=1320);for(const c of outside)host.append(button('08–22 時段外：'+c.title+' '+c.start+'–'+c.end,()=>open(c.id)));if(!courses.length)host.append(el('p','尚未加入固定課表。可手動新增，或先用 ChatGPT／Gemini 整理截圖再匯入。','bt-muted'));
  }
  $('timetable-add').onclick=()=>$('new-course').click();$('timetable-import').onclick=()=>$('planner-import').click();
  window.BlanktimeCourses={open,openEvent,render};render();
})();
