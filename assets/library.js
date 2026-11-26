(() => {
  'use strict';
  const store = window.BlanktimeStore || localStorage;
  const $ = id => document.getElementById(id), data = window.BlanktimeData;
  let pending = null;
  const text = (tag, value) => { const n = document.createElement(tag); n.textContent = value; return n; };
  function status(message) { $('library-status').textContent = message; }
  function refreshCourses() {
    const courses = Object.values(data.library().courses), select = $('course-select');
    select.replaceChildren();
    if (!courses.length) { const o = text('option', '尚未匯入教材'); o.value = ''; select.append(o); }
    for (const pkg of courses) { const o = text('option', pkg.title); o.value = pkg.courseId; select.append(o); }
    if (!courses.some(p => p.courseId === data.activeId()) && courses.length) data.select(courses[0].courseId);
    select.value = data.activeId(); select.disabled = !courses.length;$('course-delete').disabled=!courses.length;
    renderStudy();
  }
  function reloadLearning() { $('learning-frame').src = 'modules/learning/index.html?v=fouc1'; }
  $('course-select').onchange = () => {
    try { data.select($('course-select').value); reloadLearning(); renderStudy(); }
    catch (e) { status(e.message); }
  };
  function invalidate() { pending = null; $('package-confirm').hidden = true; $('package-preview').replaceChildren(); }
  $('package-text').addEventListener('input', invalidate);
  $('package-file').onchange = async () => {
    invalidate();
    const file = $('package-file').files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { $('package-preview').textContent = '教材包請小於 5 MB；較大的課程請分章整理。'; return; }
    try { $('package-text').value = await file.text(); $('package-check').click(); }
    catch (e) { $('package-preview').textContent = '檔案讀取失敗：' + e.message; }
  };
  $('package-check').onclick = () => {
    invalidate();
    try {
      const pkg = JSON.parse($('package-text').value.replace(/^\uFEFF/, ''));
      const result = window.BlanktimeValidate(pkg);
      const current = data.library().courses[pkg.courseId];
      if (current && pkg.revision < current.revision) throw Error('版本較舊，請使用最新教材包。');
      if (current && pkg.revision === current.revision && !window.BlanktimeValue.equal(pkg,current)) throw Error('相同版本有內容衝突，請提高 revision 後再匯入。');
      pending = pkg;
      $('package-preview').append(text('h3', pkg.title), text('p', `版本 ${pkg.revision} · ${result.chapters} 章 · ${result.concepts} 個觀念`));
      const list = document.createElement('ul');
      pkg.lessons.forEach(l => list.append(text('li', `${l.title} · ${l.concepts.length} 個觀念`)));
      $('package-preview').append(list);
      for (const warning of pkg.warnings) $('package-preview').append(text('p', '待核對：' + warning));
      $('package-confirm').hidden = false;
    } catch (e) { $('package-preview').textContent = '尚未匯入：' + e.message; }
  };
  $('package-confirm').onclick = () => {
    if (!pending) return;
    try {
      data.importPackage(pending); data.select(pending.courseId);
      $('package-text').value='';$('package-file').value='';invalidate(); refreshCourses(); reloadLearning();
      status('教材已匯入。可以開始學習，讀書計畫也會顯示章節。');
    } catch (e) { $('package-preview').textContent = '未完成匯入：' + e.message + '。原教材仍保留。'; }
  };
  const progressKey = id => 'blanktime:learning:progress:' + id;
  const masteryKey = id => 'blanktime:mastery:' + id;
  function renderStudy() {
    const host = $('study-live');
    host.replaceChildren();
    const courses = Object.values(data.library().courses);
    $('study-demo').hidden = courses.length > 0;
    if (!courses.length) return;
    for (const pkg of courses) {
      const completed = data.progress(pkg.courseId), mastery = JSON.parse(store.getItem(masteryKey(pkg.courseId)) || '{}');
      const section = document.createElement('section'); section.className = 'bt-course-plan';section.dataset.courseId=pkg.courseId;
      section.append(text('h3', pkg.title));
      const dl=document.createElement('label');dl.textContent='這門課的考試／複習期限';const input=document.createElement('input');input.type='datetime-local';input.dataset.deadlineCourse=pkg.courseId;input.setAttribute('aria-label',pkg.title+'考試期限');
      const at=JSON.parse(store.getItem('blanktime:planner:v1')||'{}').deadlines?.[pkg.courseId]?.at;
      if(at){const d=new Date(at);input.value=window.BlanktimePlannerCore.dateKey(d)+'T'+window.BlanktimePlannerCore.time(d.getHours()*60+d.getMinutes());}
      input.onchange=()=>{window.BlanktimePlanner.setDeadline(pkg.courseId,input.value?new Date(input.value).toISOString():null);renderStudy();};dl.append(input);section.append(dl);
      if(at)section.append(text('p',new Date(at).toLocaleString('zh-TW')+'・'+(window.BlanktimePlanner?.deadlineLabel(at)||'')));

      const list = document.createElement('ul'); list.className = 'bt-chapters';
      for (const lesson of pkg.lessons) {
        const item = document.createElement('li'), select = document.createElement('select');
        select.setAttribute('aria-label', lesson.title + '熟悉度');
        for (const grade of ['', 'A', 'B', 'C', 'F']) { const o = text('option', grade || '未評估'); o.value = grade; select.append(o); }
        select.value = mastery[lesson.id] ?? pkg.study.find(s => s.chapterId === lesson.id)?.mastery ?? '';
        select.onchange = () => {
          const next = {...mastery, [lesson.id]:select.value};
          try { store.setItem(masteryKey(pkg.courseId), JSON.stringify(next)); renderStudy(); }
          catch { select.value = mastery[lesson.id] || ''; status('瀏覽器無法儲存熟悉度，原記錄仍保留。'); }
        };
        const info = document.createElement('div'), count = lesson.concepts.filter(c => completed.includes(c.id)).length;
        info.append(text('strong', lesson.title), text('span', `已確認理解 ${count} / ${lesson.concepts.length} 個觀念`));
        const grade = select.value;
        info.append(text('span', ({A:'複習重點與進階應用',B:'整理筆記並練習表達',C:'例題練習與弱點補強',F:'從基礎觀念重新建立'})[grade] || '先學習，再評估熟悉程度'));
        const go = text('button', count ? '接續學習' : '開始學習'); go.type = 'button';
        go.onclick = () => {
          data.select(pkg.courseId); refreshCourses();
          $('learning-frame').src = 'modules/learning/chapters/lesson.html?chapter=' + encodeURIComponent(lesson.id) + '&v=fouc1#' + (lesson.concepts.find(c => !completed.includes(c.id)) || lesson.concepts[0]).id;
          document.querySelector('[data-page="materials"]').click();
        };
        item.append(select, info, go); list.append(item);
      }
      section.append(list); host.append(section);
    }
    host.append(text('p', '讀書進度與章節熟悉度分開記錄，答對一題不會自動升級。可在上方預覽一週規則排程，確認後加入每日安排。'));
  }
  $('library-export').onclick=()=>window.BlanktimeSettings.open('backup');
  $('course-delete').onclick=async()=>{
    const pkg=data.active();if(!pkg)return;
    if(await BlanktimeDialogs.ask('將「'+pkg.title+'」移至垃圾桶？保留 30 天，進度與熟悉度會保留。')){
      try{data.lifecycle(pkg.courseId,'trash');refreshCourses();reloadLearning();status('已移至垃圾桶，可在設定內還原。');}catch(e){status(e.message);}
    }
  };
  $('copy-prompt').onclick = async () => {
    const prompt = '請使用留白日程教材教練 Skill，依我提供的教材製作繁體中文逐觀念教學。每個觀念提供來源頁碼、白話解釋、公式與推導、考試精簡寫法及一道四選一驗證題，輸出 blanktime.study-package/v1 JSON。格式與 Skill：' + new URL('skills/blanktime-study-coach/SKILL.md',location.href).href + '；格式範例：' + new URL('skills/blanktime-study-coach/examples/minimal-package.json',location.href).href + '。先確認教材範圍與無法辨識的部分。';
    try { await navigator.clipboard.writeText(prompt); $('prompt-status').textContent = '已複製，貼到 ChatGPT／Gemini 並附上教材即可。'; }
    catch { $('prompt-status').textContent = prompt; }
  };
  window.addEventListener('storage', e => { if(e.key?.startsWith('blanktime:learning:progress:')) renderStudy(); });
  window.addEventListener('blanktime:course-selected',()=>{refreshCourses();status('目前課程：'+(data.active()?.title||''));});
  window.addEventListener('blanktime:study', () => { try {renderStudy();} catch(e){status(e.message);} });
  window.addEventListener('blanktime:library-refresh', () => { try { refreshCourses(); } catch(e) { status(e.message); } });
  try {refreshCourses();} catch(e) {status('無法讀取本機資料：' + e.message);}
})();
