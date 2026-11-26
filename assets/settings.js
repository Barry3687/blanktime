(() => {
  'use strict';
  const $=id=>document.getElementById(id),S=window.BlanktimeStore,D=window.BlanktimeData,C=window.BlanktimeCourseState,P=window.BlanktimePlannerCore,B=window.BlanktimeBackup;
  const prefKey='blanktime:preferences:v1',pk=id=>'blanktime:learning:progress:'+id,mk=id=>'blanktime:mastery:'+id;
  const node=(tag,text)=>{const e=document.createElement(tag);e.textContent=text;return e;};
  const action=(text,fn)=>{const b=node('button',text);b.type='button';b.onclick=fn;return b;};
  const status=text=>{$('settings-status').textContent=text;};let restoreDraft=null,restoreBase=null;
  function preferences(){let raw=S.getItem(prefKey);if(!window.BlanktimeCloudSession?.resolved)try{raw=localStorage.getItem('blanktime:appearance:v1')||raw;}catch{}return {font:'standard',reduced:false,importCollapsed:false,theme:'dusk',...JSON.parse(raw||'{}')};}
  function cacheAppearance(p){try{localStorage.setItem('blanktime:appearance:v1',JSON.stringify({theme:window.BlanktimeThemes.get(p.theme).id,font:p.font==='large'?'large':'standard',reduced:p.reduced===true}));}catch{}}
  function apply(){
    const p=preferences();window.BlanktimeThemes.apply(document,p.theme);document.documentElement.classList.toggle('reduce-motion',p.reduced);document.documentElement.classList.toggle('reading-large',p.font==='large');cacheAppearance(p);
    const layout=document.querySelector('.bt-learning-layout');layout.classList.toggle('import-collapsed',p.importCollapsed);$('import-panel').hidden=p.importCollapsed;$('import-toggle').setAttribute('aria-expanded',String(!p.importCollapsed));$('import-toggle').textContent=(p.importCollapsed?'展開':'收合')+'教材匯入與原始預覽';
    try{const doc=$('learning-frame').contentDocument;window.BlanktimeThemes.apply(doc,p.theme);doc.documentElement.classList.toggle('reading-large',p.font==='large');doc.documentElement.classList.toggle('reduce-motion',p.reduced);}catch{}
    $('import-storage-note').textContent=window.BlanktimeCloudSession?.signedIn?'整理後的教材與進度會同步至雲端帳號；原始教材不上傳。':'訪客資料僅存於此瀏覽器；原始教材不上傳。';
  }
  function renderTrash(){
    const rows=Object.values(D.library().trash);$('trash-count').textContent=rows.length;const host=$('trash-list');host.replaceChildren();
    if(!rows.length)host.append(node('p','垃圾桶是空的。'));
    for(const doc of rows){const box=document.createElement('article');box.className='trash-item';box.append(node('h3',doc.title),node('p','刪除於 '+new Date(doc.deletedAt).toLocaleDateString('zh-TW')+'・剩餘 '+Math.max(0,Math.ceil((doc.purgeAt-Date.now())/C.DAY))+' 天'));
      box.append(action('還原課程',()=>{try{D.lifecycle(doc.courseId,'restore');status('課程、進度與熟悉度已還原。');}catch(e){status(e.message);}}),action('立即永久刪除',async()=>{if(!await BlanktimeDialogs.ask('永久清除「'+doc.title+'」及其理解進度、熟悉度？此操作無法還原。'))return;try{D.lifecycle(doc.courseId,'purge');status('已永久清除；登入時會同步清除標記。');}catch(e){status(e.message);}}));host.append(box);
    }
  }
  function syncInfo(){const cloud=window.BlanktimeCloudSession;$('settings-account').textContent=cloud?.signedIn?'登入帳號：'+cloud.email:'訪客模式';$('settings-sync-time').textContent='最後同步：'+(cloud?.lastSync?new Date(cloud.lastSync).toLocaleString('zh-TW'):'尚未同步');$('settings-cache').textContent='此帳號有 '+S.keys().length+' 個本機快取項目。訪客資料與各帳號分開保存；原始教材只在頁面記憶體預覽。';}
  function open(tab='backup'){
    D.expire();renderTrash();syncInfo();apply();
    for(const b of document.querySelectorAll('[data-setting]'))b.setAttribute('aria-selected',String(b.dataset.setting===tab));
    for(const panel of document.querySelectorAll('[data-settings-panel]'))panel.hidden=panel.dataset.settingsPanel!==tab;
    const p=window.BlanktimePlanner.read().prefs;$('pref-day-start').value=P.time(p.dayStart);$('pref-day-end').value=P.time(p.dayEnd);$('pref-max').value=p.maxStudyMinutes;$('pref-theme').value=preferences().theme;$('pref-font').value=preferences().font;$('pref-reduced').checked=preferences().reduced;
    if(!$('settings-dialog').open)$('settings-dialog').showModal();
  }
  function snapshot(){
    const library=D.library(),progress={},mastery={},lastPositions={};
    for(const [id,doc] of Object.entries(C.documents(library)))if(C.status(doc)!=='purged'){progress[id]=D.progress(id);mastery[id]=JSON.parse(S.getItem(mk(id))||'{}');lastPositions[id]=S.getItem(pk(id)+':last');}
    const timer=JSON.parse(S.getItem('window-seat-pomodoro-v1')||'null');
    return {format:'blanktime.backup/v2',createdAt:Date.now(),library,progress,mastery,lastPositions,schedule:window.BlanktimePlanner.read(),timerRecords:B.records(timer?.records||[]),preferences:preferences()};
  }
  function snapshotKey(){const b=snapshot();delete b.createdAt;return window.BlanktimeValue.canonical(b);}
  for(const t of window.BlanktimeThemes.themes){const o=node('option',t.name+'（'+(t.scheme==='dark'?'深色':'淺色')+'）');o.value=t.id;$('pref-theme').append(o);}
  $('pref-theme').onchange=()=>{try{S.setItem(prefKey,JSON.stringify({...preferences(),theme:$('pref-theme').value}));apply();status('外觀已保存。');}catch(e){status(e.message);}};
  $('settings-open').onclick=()=>open();$('settings-close').onclick=()=>$('settings-dialog').close();
  document.querySelectorAll('[data-setting]').forEach(b=>b.onclick=()=>open(b.dataset.setting));
  $('import-toggle').onclick=()=>{S.setItem(prefKey,JSON.stringify({...preferences(),importCollapsed:!preferences().importCollapsed}));apply();};
  $('learning-frame').addEventListener('load',apply);
  $('preferences-form').onsubmit=e=>{e.preventDefault();try{const prefs={dayStart:P.minutes($('pref-day-start').value),dayEnd:P.minutes($('pref-day-end').value),maxStudyMinutes:Number($('pref-max').value)};const check=P.blank();check.prefs=prefs;P.validate(check);window.BlanktimePlanner.setPreferences(prefs);$('plan-day-start').value=P.time(prefs.dayStart);$('plan-day-end').value=P.time(prefs.dayEnd);$('plan-max').value=prefs.maxStudyMinutes;S.setItem(prefKey,JSON.stringify({...preferences(),font:$('pref-font').value,reduced:$('pref-reduced').checked}));apply();status('已儲存偏好。');}catch(error){status(error.message);}};
  $('settings-export').onclick=()=>{try{D.expire();const data=snapshot();B.validate(data,window.BlanktimeValidate);const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='blanktime-backup-v2.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);status('已匯出完整備份。請妥善保存私人教材。');}catch(e){status('備份失敗：'+e.message);}};
  $('settings-backup-file').onchange=()=>{restoreDraft=null;$('settings-restore-confirm').hidden=true;};
  $('settings-restore-check').onclick=async()=>{restoreDraft=null;$('settings-restore-confirm').hidden=true;try{const file=$('settings-backup-file').files[0];if(!file||file.size>25*1024*1024)throw Error('請選擇 25 MB 以下的備份 JSON');const backup=JSON.parse(await file.text());restoreBase=snapshotKey();restoreDraft=B.merge(snapshot(),backup,window.BlanktimeValidate);$('settings-backup-preview').textContent='可合併 '+Object.keys(backup.library.courses).length+' 門課程。既有進度保留，垃圾桶與永久清除狀態不會被舊備份取消；番茄鐘只合併紀錄。';$('settings-restore-confirm').hidden=false;}catch(e){status('未還原：'+e.message);}};
  $('settings-restore-confirm').onclick=async()=>{if(!restoreDraft)return;try{
    if(restoreBase!==snapshotKey())throw Error('資料已改變，請重新檢查備份');
    const b=restoreDraft,entries=[['blanktime:library:v1',JSON.stringify(b.library)],['blanktime:planner:v1',JSON.stringify(b.schedule)], [prefKey,JSON.stringify(b.preferences)]];
    for(const [id,progress] of Object.entries(b.progress)){if(b.library.removed?.[id])continue;entries.push([pk(id),JSON.stringify(progress)],[mk(id),JSON.stringify(b.mastery[id]||{})]);if(b.lastPositions[id])entries.push([pk(id)+':last',b.lastPositions[id]]);}
    for(const id of Object.keys(b.library.removed||{}))entries.push([pk(id),null],[pk(id)+':last',null],[mk(id),null]);
    S.batch(entries);D.expire();window.dispatchEvent(new Event('blanktime:library-refresh'));apply();
    const mergeTimer=remote=>{const local=JSON.parse(S.getItem('window-seat-pomodoro-v1')||'null');const out=remote||local;if(!out)throw Error('番茄鐘尚未載入，請重新檢查備份後再試');return {...out,records:B.records([...(out.records||[]),...b.timerRecords])};};
    const timer=window.BlanktimeCloudSession?.signedIn?await window.BlanktimeCloudSession.transactTimer(mergeTimer):mergeTimer(null);
    S.setItem('window-seat-pomodoro-v1',JSON.stringify(timer),'remote');restoreDraft=null;$('settings-restore-confirm').hidden=true;status('完整備份已合併還原，原倒數與既有進度保留。');
  }catch(e){status('還原尚未全部完成，本機資料保留：'+e.message);}};
  $('settings-sync-now').onclick=async()=>{await window.BlanktimeCloudSession?.retry();syncInfo();};
  $('settings-material-prompt').onclick=()=>{$('copy-prompt').click();status('教材整理指令已複製；若剪貼簿受限可到教材匯入區查看文字。');};
  $('settings-course-prompt').onclick=()=>{$('planner-prompt').click();status('課表整理指令已複製；若剪貼簿受限可到課表匯入視窗查看文字。');};
  window.addEventListener('blanktime:library-refresh',()=>{renderTrash();apply();});window.addEventListener('blanktime:sync-state',()=>{syncInfo();apply();});
  window.addEventListener('blanktime:store-change',e=>{if(e.detail.key===prefKey){try{cacheAppearance(JSON.parse(e.detail.newValue||'{}'));}catch{}apply();}});
  window.BlanktimeSettings={open,snapshot};D.expire();apply();renderTrash();
})();
