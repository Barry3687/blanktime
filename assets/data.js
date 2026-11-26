(() => {
  'use strict';
  const store = window.BlanktimeStore || localStorage;
  const KEY = 'blanktime:library:v1';
  const ACTIVE = 'blanktime:active-course:v1';
  function library() {
    const raw = JSON.parse(store.getItem(KEY) || '{"courses":{}}');
    if (!raw || typeof raw.courses !== 'object' || Array.isArray(raw.courses)) throw Error('教材資料無法讀取，請保留備份後再試。');
    return raw;
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
    if (previous) {
      if (pkg.revision < previous.revision) throw Error('這是較舊版本，原教材已保留。');
      if (pkg.revision === previous.revision && !window.BlanktimeValue.equal(pkg,previous)) throw Error('相同版本含有不同內容，請提高 revision 後再匯入。');
    }
    // One library write commits the validated package; progress has a separate key.
    next.courses = { ...next.courses, [pkg.courseId]: pkg };
    store.setItem(KEY, JSON.stringify(next));
    try { store.setItem(ACTIVE, pkg.courseId); } catch {}
    return pkg;
  }
  function catalog() {
    const pkg = active();
    return {version:1, chapters: (pkg?.lessons || []).map(lesson => ({id:lesson.id, title:lesson.title, path:`chapters/lesson.html?chapter=${encodeURIComponent(lesson.id)}&v=20261126`, concepts:lesson.concepts.map(c => ({id:c.id,title:c.title}))}))};
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
  window.BlanktimeData = {library, activeId, active, select, importPackage, catalog, json, progress};
  const chapter = new URLSearchParams(location.search).get('chapter');
  if (chapter) document.body.dataset.chapter = chapter;
})();
