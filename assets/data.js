(() => {
  'use strict';
  const store = window.BlanktimeStore || localStorage;
  const KEY = 'blanktime:library:v1';
  const ACTIVE = 'blanktime:active-course:v1';
  function library() {
    const raw = JSON.parse(store.getItem(KEY) || '{"courses":{}}');
    if (!raw || typeof raw.courses !== 'object' || Array.isArray(raw.courses)) throw Error('教材資料無法讀取，請保留備份後再試。');
    raw.trash ||= {};raw.removed ||= {};raw.states ||= {};return raw;
  }
  function activeId() { try { return store.getItem(ACTIVE) || ''; } catch { return ''; } }
  function active() { try { return library().courses[activeId()] || null; } catch { return null; } }
  function select(id) {
    if (!Object.hasOwn(library().courses, id)) throw Error('找不到課程');
    store.setItem(ACTIVE, id);
  }
  function importPackage(pkg) {
    window.BlanktimeValidate(pkg);
    const next = library(), previous = next.courses[pkg.courseId];
    if(next.removed[pkg.courseId])throw Error('這個課程 ID 已永久清除，請以新的 courseId 建立課程');
    if(next.trash[pkg.courseId])throw Error('課程在垃圾桶內，請先還原再更新教材');
    if (previous) {
      if (pkg.revision < previous.revision) throw Error('這是較舊版本，原教材已保留。');
      if (pkg.revision === previous.revision && !window.BlanktimeValue.equal(pkg,previous)) throw Error('相同版本含有不同內容，請提高 revision 後再匯入。');
    }
    // One library write commits the validated package; progress has a separate key.
    next.courses = { ...next.courses, [pkg.courseId]: pkg };
    if(next.states[pkg.courseId])next.states[pkg.courseId].package=pkg;
    store.setItem(KEY, JSON.stringify(next));
    try { store.setItem(ACTIVE, pkg.courseId); } catch {}
    return pkg;
  }
  function catalog() {
    const pkg = active();
    return {version:1, chapters: (pkg?.lessons || []).map(lesson => ({id:lesson.id, title:lesson.title, path:`chapters/lesson.html?chapter=${encodeURIComponent(lesson.id)}&v=fouc1`, concepts:lesson.concepts.map(c => ({id:c.id,title:c.title}))}))};
  }
  async function json(path) {
    const pkg = active();
    if (pkg && path.endsWith('catalog.json')) return catalog();
    const id = path.match(/content\/([^/]+)\/lesson\.json$/)?.[1];
    if (pkg && id) {
      const lesson = pkg.lessons.find(x => x.id === id);
      if (!lesson) throw Error('找不到章節');
      return lesson;
    }
    const response = await fetch(path);
    if (!response.ok) throw Error('無法讀取教材');
    return response.json();
  }
  function progress(id = activeId()) {
    return JSON.parse(store.getItem('blanktime:learning:progress:' + id) || '[]');
  }
  function putDocument(doc,source='local') {
    window.BlanktimeCourseState.validate(doc,window.BlanktimeValidate);
    store.setItem(KEY,JSON.stringify(window.BlanktimeCourseState.apply(library(),doc)),source);
    if(window.BlanktimeCourseState.status(doc)==='purged'){
      for(const key of ['blanktime:learning:progress:'+doc.courseId,'blanktime:learning:progress:'+doc.courseId+':last','blanktime:mastery:'+doc.courseId])store.removeItem(key,source);
    }
    window.dispatchEvent(new Event('blanktime:library-refresh'));
  }
  function expire(now=Date.now()) { for(const doc of Object.values(library().trash))if(now>=doc.purgeAt)putDocument(window.BlanktimeCourseState.purge(doc,now,crypto.randomUUID())); }
  function lifecycle(id,action) {
    const doc=window.BlanktimeCourseState.documents(library())[id];if(!doc)throw Error('找不到課程');
    putDocument(window.BlanktimeCourseState[action](doc,Date.now(),crypto.randomUUID()));
  }
  function openConcept(courseId,conceptId) {
    const p=library().courses[courseId];if(!p)throw Error('課程已刪除或尚未同步');
    const l=p.lessons.find(x=>x.concepts.some(c=>c.id===conceptId));if(!l)throw Error('找不到對應觀念');
    const done=progress(courseId),target=done.includes(conceptId)?l.concepts.find(c=>!done.includes(c.id))||l.concepts.find(c=>c.id===conceptId):l.concepts.find(c=>c.id===conceptId);
    select(courseId);window.dispatchEvent(new Event('blanktime:course-selected'));document.querySelector('[data-page="materials"]').click();
    document.getElementById('learning-frame').src='modules/learning/chapters/lesson.html?chapter='+encodeURIComponent(l.id)+'&v=fouc1#'+target.id;
  }
  window.BlanktimeData = {library, activeId, active, select, importPackage, catalog, json, progress,putDocument,expire,lifecycle,openConcept};
  const chapter = new URLSearchParams(location.search).get('chapter');
  if (chapter) document.body.dataset.chapter = chapter;
})();
