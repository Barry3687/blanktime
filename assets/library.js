(() => {
  'use strict';
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
    select.value = data.activeId(); select.disabled = !courses.length;
    renderStudy();
  }
  function reloadLearning() { $('learning-frame').src = 'modules/learning/index.html?v=20261124'; }
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
      if (current && pkg.revision === current.revision && JSON.stringify(pkg) !== JSON.stringify(current)) throw Error('相同版本有內容衝突，請提高 revision 後再匯入。');
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
      invalidate(); refreshCourses(); reloadLearning();
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
      const completed = data.progress(pkg.courseId), mastery = JSON.parse(localStorage.getItem(masteryKey(pkg.courseId)) || '{}');
      const section = document.createElement('section'); section.className = 'bt-course-plan';
      section.append(text('h3', pkg.title));
      const list = document.createElement('ul'); list.className = 'bt-chapters';
      for (const lesson of pkg.lessons) {
        const item = document.createElement('li'), select = document.createElement('select');
        select.setAttribute('aria-label', lesson.title + '熟悉度');
        for (const grade of ['', 'A', 'B', 'C', 'F']) { const o = text('option', grade || '未評估'); o.value = grade; select.append(o); }
        select.value = mastery[lesson.id] ?? pkg.study.find(s => s.chapterId === lesson.id)?.mastery ?? '';
        select.onchange = () => {
          const next = {...mastery, [lesson.id]:select.value};
          try { localStorage.setItem(masteryKey(pkg.courseId), JSON.stringify(next)); renderStudy(); }
          catch { select.value = mastery[lesson.id] || ''; status('瀏覽器無法儲存熟悉度，原記錄仍保留。'); }
        };
        const info = document.createElement('div'), count = lesson.concepts.filter(c => completed.includes(c.id)).length;
        info.append(text('strong', lesson.title), text('span', `已確認理解 ${count} / ${lesson.concepts.length} 個觀念`));
        const grade = select.value;
        info.append(text('span', ({A:'複習重點與進階應用',B:'整理筆記並練習表達',C:'例題練習與弱點補強',F:'從基礎觀念重新建立'})[grade] || '先學習，再評估熟悉程度'));
        const go = text('button', count ? '接續學習' : '開始學習'); go.type = 'button';
        go.onclick = () => {
          data.select(pkg.courseId); refreshCourses();
          $('learning-frame').src = 'modules/learning/chapters/lesson.html?chapter=' + encodeURIComponent(lesson.id) + '&v=20261124#' + (lesson.concepts.find(c => !completed.includes(c.id)) || lesson.concepts[0]).id;
          document.querySelector('[data-page="materials"]').click();
        };
        item.append(select, info, go); list.append(item);
      }
      section.append(list); host.append(section);
    }
    host.append(text('p', '讀書進度與章節熟悉度分開記錄，答對一題不會自動升級。依考試日期自動安排時段的功能仍在建置中。'));
  }
  function download(value, name) {
    const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], {type:'application/json'}));
    const link = document.createElement('a'); link.href = url; link.download = name; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  $('library-export').onclick = () => {
    try {
      const library = data.library(), progress = {}, mastery = {};
      for (const pkg of Object.values(library.courses)) {
        progress[pkg.courseId] = data.progress(pkg.courseId);
        mastery[pkg.courseId] = JSON.parse(localStorage.getItem(masteryKey(pkg.courseId)) || '{}');
      }
      download({format:'blanktime.backup/v1', library, progress, mastery}, 'blanktime-backup.json');
      status('已匯出教材、理解進度與熟悉度。');
    } catch (e) { status('備份未完成：' + e.message); }
  };
  $('backup-restore').onclick = async () => {
    const file = $('backup-file').files[0];
    if (!file) { $('backup-status').textContent = '請先選擇備份。'; return; }
    const before = new Map();
    try {
      if (file.size > 10 * 1024 * 1024) throw Error('備份超過 10 MB。');
      const backup = JSON.parse(await file.text());
      if (backup.format !== 'blanktime.backup/v1' || !backup.library?.courses) throw Error('備份格式不符。');
      const next = data.library(), writes = new Map();
      for (const [id,pkg] of Object.entries(backup.library.courses)) {
        window.BlanktimeValidate(pkg);
        if (id !== pkg.courseId) throw Error('課程識別碼不符。');
        const old = next.courses[id];
        if (old && (pkg.revision < old.revision || (pkg.revision === old.revision && JSON.stringify(pkg) !== JSON.stringify(old)))) throw Error('備份與既有教材版本衝突，原資料已保留。');
        next.courses = {...next.courses, [id]:pkg};
        const progress = backup.progress?.[id] || [], mastery = backup.mastery?.[id] || {};
        const ids = new Set(pkg.lessons.flatMap(l => l.concepts.map(c => c.id)));
        if (!Array.isArray(progress) || progress.some(x => !ids.has(x))) throw Error('進度資料有誤。');
        if (!mastery || Array.isArray(mastery) || typeof mastery !== 'object' || Object.entries(mastery).some(([k,v]) => !pkg.lessons.some(l => l.id === k) || !['','A','B','C','F'].includes(v))) throw Error('熟悉度資料有誤。');
        writes.set(progressKey(id), JSON.stringify([...new Set([...data.progress(id), ...progress])]));
        writes.set(masteryKey(id), JSON.stringify({...mastery, ...JSON.parse(localStorage.getItem(masteryKey(id)) || '{}')}));
      }
      writes.set('blanktime:library:v1', JSON.stringify(next));
      for (const key of writes.keys()) before.set(key, localStorage.getItem(key));
      for (const [key,value] of writes) localStorage.setItem(key,value);
      refreshCourses(); reloadLearning(); $('backup-status').textContent = '備份已合併，既有理解進度與熟悉度已保留。';
    } catch (e) {
      for (const [key,value] of before) { try { if(value === null)localStorage.removeItem(key); else localStorage.setItem(key,value); } catch {} }
      $('backup-status').textContent = '未還原：' + e.message;
    }
  };
  $('copy-prompt').onclick = async () => {
    const prompt = '請使用留白日程教材教練 Skill，依我提供的教材製作繁體中文逐觀念教學。每個觀念提供來源頁碼、白話解釋、公式與推導、考試精簡寫法及一道四選一驗證題，輸出 blanktime.study-package/v1 JSON。格式與 Skill：' + new URL('skills/blanktime-study-coach/SKILL.md',location.href).href + '；格式範例：' + new URL('skills/blanktime-study-coach/examples/minimal-package.json',location.href).href + '。先確認教材範圍與無法辨識的部分。';
    try { await navigator.clipboard.writeText(prompt); $('prompt-status').textContent = '已複製，貼到 ChatGPT／Gemini 並附上教材即可。'; }
    catch { $('prompt-status').textContent = prompt; }
  };
  window.addEventListener('storage', e => { if(e.key?.startsWith('blanktime:learning:progress:')) renderStudy(); });
  window.addEventListener('blanktime:study', () => { try {renderStudy();} catch(e){status(e.message);} });
  try {refreshCourses();} catch(e) {status('無法讀取本機資料：' + e.message);}
})();
