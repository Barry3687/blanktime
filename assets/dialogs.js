(function(scope){
  'use strict';
  try{if(scope.parent!==scope&&scope.parent.BlanktimeDialogs){scope.BlanktimeDialogs=scope.parent.BlanktimeDialogs;return;}}catch{}
  const doc=scope.document;
  function decorate(dialog){
    dialog.addEventListener('click',e=>{if(e.target!==dialog)return;const b=dialog.getBoundingClientRect();if(e.clientX<b.left||e.clientX>b.right||e.clientY<b.top||e.clientY>b.bottom)dialog.close();});
    for(const b of dialog.querySelectorAll('button'))if(b.id?.endsWith('-close')){b.textContent='✕';b.setAttribute('aria-label','關閉');b.classList.add('dialog-close');}
  }
  for(const dialog of doc.querySelectorAll('dialog'))decorate(dialog);
  let active=null;
  function ask(message,{title='請確認',accept='確認',danger=false}={}){
    if(active)return Promise.resolve(false);
    return new Promise(resolve=>{
      const dialog=doc.createElement('dialog');dialog.className='bt-confirm';dialog.setAttribute('aria-labelledby','bt-confirm-title');
      const head=doc.createElement('div');head.className='account-dialog-head';const h=doc.createElement('h2');h.id='bt-confirm-title';h.textContent=title;
      const close=doc.createElement('button');close.textContent='✕';close.type='button';close.className='dialog-close';close.setAttribute('aria-label','關閉');close.onclick=()=>dialog.close();head.append(h,close);
      const text=doc.createElement('p');text.textContent=message;const actions=doc.createElement('div');actions.className='planner-inline';
      const cancel=doc.createElement('button');cancel.type='button';cancel.textContent='取消';cancel.autofocus=true;cancel.onclick=()=>dialog.close();
      const ok=doc.createElement('button');ok.type='button';ok.textContent=accept;ok.className=danger?'danger-button':'bt-primary';let accepted=false;ok.onclick=()=>{accepted=true;dialog.close();};
      actions.append(cancel,ok);dialog.append(head,text,actions);doc.body.append(dialog);decorate(dialog);active=dialog;
      dialog.addEventListener('close',()=>{active=null;dialog.remove();resolve(accepted);},{once:true});dialog.showModal();
    });
  }
  scope.BlanktimeDialogs={ask};
})(window);
