(() => {
  'use strict';
  const store=window.BlanktimeStore, api=window.BlanktimeCloud, $=id=>document.getElementById(id);
  let connection=null,user=null,epoch=0,ready=false,pulling=false,flushing=false,timerBusy=0;
  let pending={},applying=false,providerReady=false;
  const copy=x=>JSON.parse(JSON.stringify(x));
  let lastSync=null;
  const note=message=>{
    const state=/離線/.test(message)?'offline':/訪客|本機預覽/.test(message)?'guest':/^已同步$/.test(message)?'synced':/保存中|同步中|正在/.test(message)?'saving':'attention';
    if(state==='synced')lastSync=Date.now();
    $('account-status').textContent=message;$('sync-label').textContent=({offline:'離線',guest:'訪客',synced:'已同步',saving:'保存中',attention:'待處理'})[state];$('sync-status').dataset.state=state;$('sync-status').title=message;$('sync-status').setAttribute?.('aria-label','同步狀態：'+message+'；點擊'+(user?'重新同步':'登入'));
    $('account-open').title=message;$('account-open').textContent='帳號';
    window.dispatchEvent(new CustomEvent('blanktime:sync-state',{detail:{state,message,lastSync,email:user?.email||null}}));
  };
  const pk=id=>'blanktime:learning:progress:'+id, mk=id=>'blanktime:mastery:'+id;
  const pendingKey='blanktime:sync:pending:v1', C=window.BlanktimeCourseState;
  const purged=id=>!!window.BlanktimeData?.library().removed?.[id];
  function sweep(){window.BlanktimeData?.expire?.();for(const [id,doc] of Object.entries(window.BlanktimeData?.library().removed||{}))for(const kind of ['progress','mastery'])if(!pending[kind+':'+id]&&!repository().snapshot(kind,id)?.payload?._coursePurged)queue(kind,id,{_coursePurged:doc.stateId,completed:[],lastId:null},{purge:true});}
  function applyRows(rows){rows.sort((a,b)=>Number(b.kind==='course')-Number(a.kind==='course')).forEach(apply);sweep();}
  function savePending(){try{store.setItem(pendingKey,JSON.stringify(pending),'internal');}catch{note('本機空間不足，變更尚未同步，請先備份。');}}
  function repository(){return connection.repository;}
  function notifyChanges(){window.dispatchEvent(new Event('blanktime:library-refresh'));}
  function framesReload(){
    $('learning-frame').src='modules/learning/index.html?v=workspace2';
    $('pomodoro-frame').src='modules/pomodoro/index.html?v=cloud1';
    window.LectureWorkspace?.resetMaterials?.();
    notifyChanges();
  }
  function apply(row){
    if(!row||!user)return;
    if(row.kind==='course'&&C.status(row.payload)==='purged'){
      for(const kind of ['course','progress','mastery'])delete pending[kind+':'+row.document_id];savePending();
    }
    if(pending[row.kind+':'+row.document_id])return;
    applying=true;
    try {
      if(row.kind==='course') {
        C.validate(row.payload,window.BlanktimeValidate);
        const old=C.documents(window.BlanktimeData.library())[row.document_id];
        if(!window.BlanktimeValue.equal(old,row.payload)) {
          window.BlanktimeData.putDocument(row.payload,'remote');
          $('learning-frame').src='modules/learning/index.html?v=workspace2';
        }
      }
      if(row.kind==='progress') {
        if(purged(row.document_id)){store.removeItem(pk(row.document_id),'remote');store.removeItem(pk(row.document_id)+':last','remote');return;}
        store.setItem(pk(row.document_id),JSON.stringify(row.payload.completed||[]),'remote');
        if(row.payload.lastId)store.setItem(pk(row.document_id)+':last',row.payload.lastId,'remote');
        else store.removeItem(pk(row.document_id)+':last','remote');
      }
      if(row.kind==='mastery'&&!purged(row.document_id))store.setItem(mk(row.document_id),JSON.stringify(row.payload),'remote');
      if(row.kind==='timer' && timerBusy===0)store.setItem('window-seat-pomodoro-v1',JSON.stringify(row.payload),'remote');
      if(row.kind==='schedule'){window.BlanktimePlannerCore.validate(row.payload);store.setItem('blanktime:planner:v1',JSON.stringify(row.payload),'remote');}
    } finally {applying=false;}
  }
  async function pull(){
    if(!ready||pulling||!navigator.onLine)return;
    const token=epoch;pulling=true;
    try {const rows=await repository().pull();if(token!==epoch)return;applyRows(rows);notifyChanges();if(!Object.keys(pending).length)note('已同步');}
    catch(e){if(token===epoch)note('暫時無法同步；本機資料保留：'+e.message);return false;}
    finally{if(token===epoch)pulling=false;}
  }
  function queue(kind,id,payload,extra={}){
    if(!ready||applying)return;
    const key=kind+':'+id,old=pending[key],remote=repository().snapshot(kind,id);
    pending[key]={kind,id,payload,version:crypto.randomUUID(),baseGeneration:old?.baseGeneration ?? remote?.payload?.generation ?? 'initial',baseRevision:old?.baseRevision ?? remote?.revision ?? 0,...extra};
    // Clearing completed IDs and the last lesson are separate storage events.
    // Keep the reset intent until its write is acknowledged.
    if(kind==='progress'&&old?.reset)pending[key].reset=true;
    savePending();note('保存中');void flush();
  }
  async function flush(){
    if(flushing||!ready||!navigator.onLine)return;
    flushing=true;const token=epoch;
    try {
      for(const [key,item] of Object.entries(pending)) {
        if(token!==epoch)return;
        const row=await repository().change(item.kind,item.id,remote=>{
          if(token!==epoch)throw Error('帳號已切換');
          if(item.kind==='course') {
return C.resolve(remote,item.payload,item.baseCourse);
          }
          if(item.kind==='progress') {
            if(item.purge||purged(item.id)||C?.status(repository().snapshot('course',item.id)?.payload)==='purged')return {_coursePurged:item.payload._coursePurged||'purged',completed:[],lastId:null,generation:'purged'};
            if(item.reset) {
              if((repository().snapshot('progress',item.id)?.revision||0)!==item.baseRevision)throw Error('另一台裝置已更新進度，請重新確認重設。');
              return {...item.payload,generation:item.version};
            }
            if((remote?.generation||'initial')!==item.baseGeneration)throw Error('另一台裝置重設過進度，請核對本機紀錄後重試。');
            return {...api.mergeProgress(item.payload,remote),generation:remote?.generation||'initial'};
          }
          if(item.kind==='mastery') {
            if(item.purge||purged(item.id)||C?.status(repository().snapshot('course',item.id)?.payload)==='purged')return {_coursePurged:item.payload._coursePurged||'purged'};
            const result={...(remote||{})};
            for(const [chapter,value] of Object.entries(item.patch||item.payload)) {
              if(remote && remote[chapter]!==undefined && remote[chapter]!==item.base?.[chapter] && remote[chapter]!==value)throw Error('章節熟悉度與另一台裝置有衝突，請先核對。');
              result[chapter]=value;
            }
            return result;
          }
          if(item.kind==='schedule') {
            const base=item.baseState||window.BlanktimePlannerCore.blank();
            if(remote){for(const kind of ['events','courses'])for(const row of item.payload[kind]){const before=base[kind].find(x=>x.id===row.id),cloud=remote[kind].find(x=>x.id===row.id);if(before&&cloud&&!window.BlanktimeValue.equal(before,row)&&!window.BlanktimeValue.equal(before,cloud)&&!window.BlanktimeValue.equal(row,cloud))throw Error('同一事項在兩台裝置都有修改，請先核對。');}}
            const merged=window.BlanktimePlannerCore.merge(item.payload,remote);
            if(remote&&!window.BlanktimeValue.equal(remote.prefs,base.prefs)){if(!window.BlanktimeValue.equal(item.payload.prefs,base.prefs)&&!window.BlanktimeValue.equal(item.payload.prefs,remote.prefs))throw Error('讀書時段設定有衝突，請先核對。');merged.prefs=remote.prefs;}
            merged.deadlines=window.BlanktimePlannerCore.mergeDeadlines(item.payload,remote,base);return merged;
          }
          return item.payload;
        });
        if(token!==epoch)return;
        if(pending[key]?.version===item.version){delete pending[key];savePending();apply(row);if(item.kind==='course')sweep();}
        else if(item.kind==='progress'&&pending[key]){
          // A local edit may arrive while our reset is in flight. Its base is
          // now our acknowledged write, rather than the pre-reset generation.
          pending[key].baseGeneration=row.payload.generation||'initial';
          pending[key].baseRevision=row.revision;
          savePending();
        }
      }
      notifyChanges();note(Object.keys(pending).length?'仍有變更待同步':'已同步');
    }catch(e){if(token===epoch)note('尚未同步：'+e.message);}
    finally{if(token===epoch)flushing=false;}
  }
  window.addEventListener('blanktime:store-change',event=>{
    const {key,newValue,oldValue,source,owner}=event.detail;
    if(!ready||applying||source==='remote'||source==='internal'||owner!==user?.id)return;
    try {
      if(key==='blanktime:library:v1') {
        const lib=JSON.parse(newValue||'{"courses":{}}'),old=JSON.parse(oldValue||'{"courses":{}}');
        for(const [id,doc] of Object.entries(C.documents(lib)))if(!window.BlanktimeValue.equal(C.documents(old)[id],doc))queue('course',id,doc,{baseCourse:pending['course:'+id]?.baseCourse||C.documents(old)[id]||null});
      }
      if(key==='blanktime:planner:v1'&&newValue){const previous=pending['schedule:shared'];queue('schedule','shared',JSON.parse(newValue),{baseState:previous?.baseState||JSON.parse(oldValue||'null')||window.BlanktimePlannerCore.blank()});}
      const progress=key.match(/^blanktime:learning:progress:([a-z0-9-]+)(:last)?$/);
      if(progress){const id=progress[1],completed=JSON.parse(store.getItem(pk(id))||'[]');queue('progress',id,{completed,lastId:store.getItem(pk(id)+':last')},{reset:!progress[2]&&completed.length===0});}
      const mastery=key.match(/^blanktime:mastery:([a-z0-9-]+)$/);
      if(mastery){const current=JSON.parse(newValue||'{}'),base=JSON.parse(oldValue||'{}'),patch={};for(const [id,v] of Object.entries(current))if(base[id]!==v)patch[id]=v;const prior=pending['mastery:'+mastery[1]];queue('mastery',mastery[1],current,{patch:{...(prior?.patch||{}),...patch},base:prior?.base||base});}
    }catch(e){note('本機內容已保留，尚未同步：'+e.message);}
  });
  async function activate(session){
    const token=++epoch;ready=false;user=null;pending={};flushing=false;pulling=false;timerBusy=0;
    store.setOwner(null);framesReload();
    repository().documents.clear();
    if(!session){store.setOwner(null);$('account-name').textContent='尚未登入';$('account-logout').hidden=true;$('account-migrate').hidden=true;note('訪客模式・僅存於此瀏覽器');framesReload();return;}
    note('正在確認帳號');
    const verified=await connection.client.auth.getUser();if(token!==epoch)return;
    if(verified.error||!verified.data.user){note('登入已失效，請重新登入');return;}
    user=verified.data.user;store.setOwner(user.id);
    connection.repository=new api.Repository({owner:user.id,uuid:()=>crypto.randomUUID(),rpc:async(name,args)=>{
      if(token!==epoch)throw Error('帳號已切換');
      const result=await connection.client.rpc(name,args);
      if(token!==epoch)throw Error('帳號已切換');
      if(result.error)throw result.error;return result.data;
    }});
    $('account-name').textContent=user.email||'已登入';$('account-logout').hidden=false;$('account-migrate').hidden=false;
    try {pending=JSON.parse(store.getItem(pendingKey)||'{}');const rows=await repository().pull();if(token!==epoch)return;ready=true;applyRows(rows);framesReload();await flush();note(Object.keys(pending).length?'有變更待同步':'已同步');}
    catch(e){
      if(token!==epoch)return;
      // Identity is verified, so keep account-scoped offline work queued even
      // when the initial document fetch fails. Later pulls can safely retry.
      ready=true;note('雲端連線未完成，本機變更會保留待同步：'+e.message);framesReload();
    }
  }
  window.BlanktimeCloudSession={
    get signedIn(){return !!user;},get ready(){return ready;},get email(){return user?.email||null;},get lastSync(){return lastSync;},async retry(){if(!navigator.onLine){note('離線・本機資料保留，請恢復連線後再試');return false;}note('同步中…');if(await pull()===false)return false;return await flush();},
    now(){return ready?repository().now():Date.now();},
    async transactTimer(update){
      if(!ready||!navigator.onLine)throw Error('共享計時需連線；請稍後再操作');
      const token=epoch;timerBusy++;note('計時同步中');
      try{
        const row=await repository().change('timer','shared',(remote,now)=>{if(token!==epoch)throw Error('帳號已切換');return update(remote,now);});
        if(token!==epoch)throw Error('帳號已切換');
        note('已同步');return copy(row.payload);
      }catch(e){note('計時未同步：'+e.message);throw e;}
      finally{if(token===epoch)timerBusy--;}
    }
  };
  $('sync-status').onclick=async()=>{if(!user){$('account-dialog').showModal();return;}const b=$('sync-status');b.disabled=true;try{await window.BlanktimeCloudSession.retry();}finally{b.disabled=false;}};
  $('account-open').onclick=()=>$('account-dialog').showModal();
  $('account-close').onclick=()=>$('account-dialog').close();
  $('account-login').onclick=async()=>{try{if(!providerReady)throw Error('Google 登入仍待完成服務設定');await connection.signIn();}catch(e){note(e.message);}};
  $('account-logout').onclick=async()=>{if(Object.keys(pending).length){note('仍有資料未同步，請先按重新同步，或備份後再登出。');return;}try{await connection.signOut();}catch(e){note(e.message);}};
  $('account-retry').onclick=async()=>{await pull();await flush();};
  $('account-migrate').onclick=()=>{
    const guest=JSON.parse(store.guestItem('blanktime:library:v1')||'{"courses":{}}'),host=$('migration-preview');host.replaceChildren();
    let conflicts=0;const current=window.BlanktimeData.library();
    for(const pkg of Object.values(guest.courses)){const old=current.courses[pkg.courseId];const conflict=old&&(old.revision>pkg.revision||(old.revision===pkg.revision&&!window.BlanktimeValue.equal(old,pkg)));const p=document.createElement('p');p.textContent=pkg.title+(conflict?'：版本衝突，會保留雲端教材':'：可合併');host.append(p);if(conflict)conflicts++;}
    const guestSchedule=JSON.parse(store.guestItem('blanktime:planner:v1')||'null');if(guestSchedule){window.BlanktimePlannerCore.validate(guestSchedule);const p=document.createElement('p');p.textContent=`可合併 ${guestSchedule.events.length} 個事項與 ${guestSchedule.courses.length} 門固定課表。`;host.append(p);}
    const p=document.createElement('p');p.textContent='僅合併整理後的課程與學習進度，不上傳原始教材。已有共享番茄鐘時保留雲端倒數，歷史紀錄依計時 ID 合併。';host.append(p);$('migration-confirm').hidden=false;
  };
  $('migration-confirm').onclick=async()=>{
    if(!ready)return;
    try{
      const guest=JSON.parse(store.guestItem('blanktime:library:v1')||'{"courses":{}}');
      for(const pkg of Object.values(guest.courses)){
        window.BlanktimeValidate(pkg);const old=window.BlanktimeData.library().courses[pkg.courseId];
        if(old&&(old.revision>pkg.revision||(old.revision===pkg.revision&&!window.BlanktimeValue.equal(old,pkg))))continue;
        window.BlanktimeData.importPackage(pkg);
        const progress=JSON.parse(store.guestItem(pk(pkg.courseId))||'[]');const combined=[...new Set([...window.BlanktimeData.progress(pkg.courseId),...progress])];store.setItem(pk(pkg.courseId),JSON.stringify(combined));
        const currentMastery=JSON.parse(store.getItem(mk(pkg.courseId))||'{}'),guestMastery=JSON.parse(store.guestItem(mk(pkg.courseId))||'{}');
        store.setItem(mk(pkg.courseId),JSON.stringify({...guestMastery,...currentMastery}));
        if(!store.getItem(pk(pkg.courseId)+':last')&&store.guestItem(pk(pkg.courseId)+':last'))store.setItem(pk(pkg.courseId)+':last',store.guestItem(pk(pkg.courseId)+':last'));
      }
      const oldTimer=JSON.parse(store.guestItem('window-seat-pomodoro-v1')||'null');
      if(oldTimer)await repository().change('timer','shared',(remote,now)=>{
        if(remote)return {...remote,records:api.mergeRecords(remote.records,oldTimer.records)};
        if(oldTimer.timer.status==='running'){oldTimer.timer.remaining=Math.max(0,oldTimer.timer.end-Date.now());oldTimer.timer.end=now+oldTimer.timer.remaining;}
        return oldTimer;
      });
      const guestSchedule=JSON.parse(store.guestItem('blanktime:planner:v1')||'null');
      if(guestSchedule){window.BlanktimePlannerCore.validate(guestSchedule);const row=await repository().change('schedule','shared',remote=>window.BlanktimePlannerCore.merge(guestSchedule,remote));apply(row);}
      $('migration-confirm').hidden=true;await flush();await pull();framesReload();
    }catch(e){note('合併尚未完成：'+e.message);}
  };
  async function start(){
    const callback=new URLSearchParams(location.search||'');
    const callbackError=callback.get('error_code')||callback.get('error');
    const callbackNote=/bad_oauth_state|flow_state_expired|flow_state_not_found/.test(callbackError||'')
      ?'登入授權已逾時，請重新按「使用 Google 登入」並完成帳號選擇。'
      :'Google 登入未完成，請重新按「使用 Google 登入」。';
    try{
      const response=await fetch('cloud/config.json');if(!response.ok)throw Error('雲端設定尚未完成');const config=await response.json();
      if(location.origin+location.pathname!==config.redirectUrl){note('本機預覽模式・未連接雲端');$('account-login').textContent='請在正式網站登入';return;}
      connection=await api.connect(config);
      const settings=await fetch(config.supabaseUrl+'/auth/v1/settings',{headers:{apikey:config.publishableKey}});
      const provider=await settings.json();providerReady=provider.external?.google===true;
      $('account-login').disabled=!providerReady;$('account-login').textContent=providerReady?'使用 Google 登入':'Google 登入設定中';
      const {data,error}=await connection.client.auth.getSession();if(error)throw error;
      await activate(data.session);
      connection.client.auth.onAuthStateChange((event,session)=>{if(event!=='INITIAL_SESSION'&&event!=='TOKEN_REFRESHED')setTimeout(()=>activate(session).catch(e=>note(e.message)),0);});
      if(!providerReady)$('account-setup-note').textContent='私人資料庫已連接，Google 授權設定尚未完成。現在仍可用訪客模式。';
      if(callbackError)note(callbackNote);
    }catch(e){note(callbackError?callbackNote:'同步未啟用：'+e.message);}
  }
  window.addEventListener('online',()=>{void pull().then(flush);});
  window.addEventListener('offline',()=>note('離線・課程可閱讀，共享計時暫時無法操作'));
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)void pull().then(flush);});
  setInterval(()=>{if(!document.hidden)void pull().then(flush);},5000);
  void start();
})();
