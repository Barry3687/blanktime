window.LectureWorkspace=(()=>{
  const urls=new Set(),el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
  function materials(host){
    const section=el('section'),title=el('h2','原始教材預覽'),note=el('p','檔案只在此頁預覽，不會上傳。請在 ChatGPT／Gemini 整理後，再匯入教材包。每份上限 10 MB，最多 5 份。'),label=el('label','選擇講義、投影片或圖片'),picker=el('input');picker.type='file';picker.multiple=true;picker.accept='.txt,.md,.pdf,.docx,.ppt,.pptx,.png,.jpg,.jpeg,.webp';label.append(picker);const zone=el('div','可將檔案拖放到這裡'),list=el('div'),notice=el('p');zone.className='drop-zone';notice.setAttribute('role','status');let count=0;
    async function load(files){for(const file of files){if(count>=5){notice.textContent='最多保留 5 份，請先移除。';break;}const ext=file.name.split('.').pop().toLowerCase();if(file.size>10*1024*1024||!['txt','md','pdf','docx','ppt','pptx','png','jpg','jpeg','webp'].includes(ext)){notice.textContent='格式不支援或超過 10 MB：'+file.name;continue;}
      count++;const card=el('article'),preview=el('div'),state=el('p');card.className='file-card';card.append(el('strong',file.name),preview,state);let url=null;
      if(['txt','md'].includes(ext)){const text=el('pre',(await file.text()).slice(0,100000));text.className='file-preview';preview.append(text);state.textContent='文字已在本機預覽。';}
      else if(['png','jpg','jpeg','webp','pdf'].includes(ext)){url=URL.createObjectURL(file);urls.add(url);const view=el(ext==='pdf'?'iframe':'img');view.src=url;if(ext==='pdf'){view.title=file.name;view.className='file-pdf';}else{view.alt=file.name;view.className='file-image';}preview.append(view);state.textContent='已載入本機預覽。整理教材時請自行附檔至 ChatGPT／Gemini。';}
      else state.textContent='檔案已選取。請將 Word／投影片附到 ChatGPT／Gemini，整理為教材包再匯入；此頁不解析檔案內容。';
      const remove=el('button','移除預覽');remove.type='button';remove.onclick=()=>{if(url){URL.revokeObjectURL(url);urls.delete(url);}card.remove();count--;};card.append(remove);list.append(card);
    }picker.value='';}
    picker.onchange=()=>load([...picker.files]);zone.ondragover=e=>e.preventDefault();zone.ondrop=e=>{e.preventDefault();load([...e.dataTransfer.files]);};section.append(title,note,label,zone,notice,list);host.append(section);
  }
  function resetMaterials(){for(const url of urls)URL.revokeObjectURL(url);urls.clear();const host=document.getElementById('materials-workspace');if(host){host.replaceChildren();materials(host);}}
  document.addEventListener('DOMContentLoaded',resetMaterials);
  return {setSubject(){},resetMaterials};
})();
