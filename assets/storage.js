(function (scope) {
  'use strict';
  try { if (scope.parent !== scope && scope.parent.BlanktimeStore) { scope.BlanktimeStore=scope.parent.BlanktimeStore; return; } } catch {}
  let owner=null;
  const prefix=()=>owner ? `blanktime:user:${owner}:` : '';
  function emit(key,oldValue,newValue,source) {
    const detail={key,oldValue,newValue,source,owner};
    scope.dispatchEvent(new CustomEvent('blanktime:store-change',{detail}));
    for(const frame of scope.document?.querySelectorAll('iframe') || []) {
      try {frame.contentWindow.dispatchEvent(new frame.contentWindow.CustomEvent('blanktime:store-change',{detail}));} catch {}
    }
  }
  const api={
    get owner(){return owner;},
    setOwner(id){if(id!==null&&!/^[0-9a-f-]{36}$/i.test(id))throw Error('帳號識別碼錯誤');owner=id;},
    getItem(key){return scope.localStorage.getItem(prefix()+key);},
    setItem(key,value,source='local'){const old=api.getItem(key);scope.localStorage.setItem(prefix()+key,String(value));if(old!==String(value))emit(key,old,String(value),source);},
    removeItem(key,source='local'){const old=api.getItem(key);scope.localStorage.removeItem(prefix()+key);if(old!==null)emit(key,old,null,source);},
    guestItem(key){return scope.localStorage.getItem(key);},
    keys(){const p=prefix(),out=[];for(let i=0;i<scope.localStorage.length;i++){const k=scope.localStorage.key(i);if(p&&k.startsWith(p))out.push(k.slice(p.length));else if(!p&&!k.startsWith('blanktime:user:'))out.push(k);}return out;}
  };
  scope.addEventListener('storage',event=>{if(event.key?.startsWith(prefix())){if(!owner&&event.key.startsWith('blanktime:user:'))return;emit(event.key.slice(prefix().length),event.oldValue,event.newValue,'other-tab');}});
  scope.BlanktimeStore=api;
})(window);
