(function(scope){
  'use strict';
  const C=scope.BlanktimeCourseState||(typeof module!=='undefined'?require('./course-state.js'):null),P=scope.BlanktimePlannerCore||(typeof module!=='undefined'?require('./planner-core.js'):null);
  const copy=x=>JSON.parse(JSON.stringify(x));
  function records(rows){if(!Array.isArray(rows)||rows.some(r=>typeof r.id!=='string'||!Number.isFinite(r.at)||r.at<=0))throw Error('番茄鐘紀錄格式錯誤');return [...new Map(rows.map(r=>[r.id,{id:r.id,at:r.at}])).values()].sort((a,b)=>a.at-b.at);}
  function validate(b,validator){
    if(!['blanktime.backup/v1','blanktime.backup/v2'].includes(b?.format)||!b.library?.courses)throw Error('備份格式不符');
    const lib=b.library;
    for(const [id,doc] of Object.entries(C.documents(lib))){C.validate(doc,validator);if(id!==doc.courseId)throw Error('備份課程 ID 不符');const p=C.pkg(doc);if(!p)continue;
      const ids=new Set(p.lessons.flatMap(l=>l.concepts.map(c=>c.id))),progress=b.progress?.[id]||[],mastery=b.mastery?.[id]||{};
      if(!Array.isArray(progress)||progress.some(x=>!ids.has(x)))throw Error('理解進度資料錯誤');
      if(!mastery||Array.isArray(mastery)||typeof mastery!=='object'||Object.entries(mastery).some(([k,v])=>!p.lessons.some(l=>l.id===k)||!['','A','B','C','F',null].includes(v)))throw Error('章節熟悉度資料錯誤');
      if(b.lastPositions?.[id]&&!ids.has(b.lastPositions[id]))throw Error('接續位置不在教材內');
    }
    if(b.format==='blanktime.backup/v2'){P.validate(b.schedule);records(b.timerRecords);if(b.preferences&&(!['standard','large'].includes(b.preferences.font)||typeof b.preferences.reduced!=='boolean'))throw Error('閱讀偏好資料錯誤');}
    return b;
  }
  function merge(current,backup,validator){
    validate(backup,validator);const out=copy(current);out.format='blanktime.backup/v2';out.library ||= {courses:{}};out.progress ||= {};out.mastery ||= {};out.lastPositions ||= {};
    for(const [id,doc] of Object.entries(C.documents(backup.library))){
      const old=C.documents(out.library)[id];
      if(old&&C.status(old)!=='active')continue;
      if(old&&C.status(doc)!=='active')continue;
      const chosen=old?C.resolve(old,C.pkg(doc),old):doc;
      if(old&&C.pkg(doc).revision<C.pkg(old).revision)throw Error('備份教材版本較舊');
      out.library=C.apply(out.library,chosen);
      if(C.status(chosen)!=='purged'){
        out.progress[id]=[...new Set([...(out.progress[id]||[]),...(backup.progress?.[id]||[])])];
        out.mastery[id]={...(backup.mastery?.[id]||{}),...(out.mastery[id]||{})};
        out.lastPositions[id] ||= backup.lastPositions?.[id]||null;
      }
    }
    if(backup.format==='blanktime.backup/v2'){
      out.schedule=P.merge(backup.schedule,out.schedule||P.blank());out.timerRecords=records([...(out.timerRecords||[]),...backup.timerRecords]);
      out.preferences=copy(backup.preferences||out.preferences||{font:'standard',reduced:false});
    }
    return out;
  }
  const api={validate,merge,records};scope.BlanktimeBackup=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window==='undefined'?globalThis:window);
