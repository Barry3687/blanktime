(function(scope){
  'use strict';
  const DAY=86400000,FORMAT='blanktime.course-state/v1';
  const V=scope.BlanktimeValue||(typeof module!=='undefined'?require('./value.js'):null);
  const copy=x=>JSON.parse(JSON.stringify(x));
  function validate(doc,validatePackage){
    if(doc?.format!==FORMAT){validatePackage?.(doc);if(!doc?.courseId||!Number.isInteger(doc.revision))throw Error('課程格式錯誤');return doc;}
    if(!/^[a-z0-9][a-z0-9-]*$/.test(doc.courseId)||!['active','trashed','purged'].includes(doc.status)||typeof doc.stateId!=='string'||!doc.stateId||!Number.isFinite(doc.changedAt))throw Error('課程狀態格式錯誤');
    if(doc.status!=='purged'){if(doc.package?.courseId!==doc.courseId)throw Error('課程識別碼不符');validatePackage?.(doc.package);}
    else if(doc.package!==null)throw Error('永久清除紀錄不可保留教材');
    if(doc.status==='trashed'&&(!Number.isFinite(doc.deletedAt)||doc.purgeAt!==doc.deletedAt+30*DAY))throw Error('垃圾桶保留期限錯誤');
    return doc;
  }
  const status=doc=>doc?.format===FORMAT?doc.status:'active';
  const pkg=doc=>doc?.format===FORMAT?doc.package:doc;
  function trash(doc,now,id){if(status(doc)!=='active')throw Error('課程已不在課程清單');const p=pkg(doc);return {format:FORMAT,courseId:p.courseId,title:p.title,status:'trashed',stateId:id,changedAt:now,deletedAt:now,purgeAt:now+30*DAY,package:copy(p)};}
  function restore(doc,now,id){if(status(doc)!=='trashed'||now>=doc.purgeAt)throw Error('課程已過保留期限，不能還原');return {...copy(doc),status:'active',stateId:id,changedAt:now};}
  function purge(doc,now,id){return {format:FORMAT,courseId:doc.courseId,title:'已永久清除的課程',status:'purged',stateId:id,changedAt:now,package:null};}
  function documents(lib){return {...lib.courses,...lib.trash,...lib.removed,...lib.states};}
  function apply(lib,doc){
    const out={courses:{...lib.courses},trash:{...lib.trash},removed:{...lib.removed},states:{...lib.states}};const id=doc.courseId;
    for(const k of ['courses','trash','removed','states'])delete out[k][id];
    if(status(doc)==='trashed')out.trash[id]=copy(doc);
    else if(status(doc)==='purged')out.removed[id]=copy(doc);
    else {out.courses[id]=copy(pkg(doc));if(doc.format===FORMAT)out.states[id]=copy(doc);}
    return out;
  }
  function resolve(remote,local,base){
    if(!remote||V.equal(remote,local))return local;
    if(status(remote)==='purged'){if(status(local)==='purged')return remote;throw Error('這門課程已在另一裝置永久清除，未重新建立');}
    if(status(local)==='active'&&status(remote)==='active'&&local.format!==FORMAT){
      const old=pkg(remote);if(old.revision>local.revision||old.revision===local.revision&&!V.equal(old,local))throw Error('課程版本衝突，原教材保留');
      return remote.format===FORMAT?{...remote,package:copy(local)}:local;
    }
    if(base&&V.equal(base,remote))return local;
    throw Error('課程狀態已被另一裝置更新，請重新同步後核對');
  }
  const api={DAY,FORMAT,validate,status,pkg,trash,restore,purge,documents,apply,resolve};scope.BlanktimeCourseState=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window==='undefined'?globalThis:window);
