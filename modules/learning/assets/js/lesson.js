"use strict";
const core = window.LectureCore;
let savedProgress;
try { savedProgress = core.storage(window.BlanktimeStore || localStorage); }
catch { savedProgress = core.storage(null); }
const target = document.querySelector("#lesson-content");
let lesson;
let catalog;
let currentIndex = 0;
let renderToken = 0;
const drafts = new Map();
const answerImages = new Map();
const quizStates = new Map();

function element(tag, text, className) {
  const result = document.createElement(tag);
  if (text !== undefined) result.textContent = text;
  if (className) result.className = className;
  return result;
}
function button(text, callback, className = "action-button") {
  const result = element("button", text, className);
  result.type = "button";
  result.addEventListener("click", callback);
  return result;
}
async function getJSON(path) {
  return BlanktimeData.json(path);
}
function refreshProgress() {
  const ids = lesson.concepts.map(c => c.id);
  const count = ids.filter(id => savedProgress.completed.includes(id)).length;
  document.querySelector("#progress").max = Math.max(ids.length, 1);
  document.querySelector("#progress").value = count;
  document.querySelector("#progress-label").textContent = `${count} / ${ids.length} 個觀念已理解`;
  document.querySelector("#reset-progress").disabled = !savedProgress.completed.length;
  if (!savedProgress.available) document.querySelector("#storage-note").textContent = "瀏覽器無法保存進度，本次仍可閱讀。";
  const nav = document.querySelector("#concept-nav");
  nav.replaceChildren();
  lesson.concepts.forEach((concept, index) => {
    const item = element("a", `${savedProgress.completed.includes(concept.id) ? "✓ " : ""}${index + 1}. ${concept.title}`);
    item.href = `#${concept.id}`;
    if (index === currentIndex) item.setAttribute("aria-current", "step");
    nav.append(item);
  });
}
function renderBlock(block, host) {
  if (block.type === "text") host.append(element("p", block.text));
  if (block.type === "formula") host.append(element("div", `\\[${block.text}\\]`, "formula"));
  if (block.type === "image" || block.type === "diagram") {
    const figure = element("figure", undefined, "lesson-figure");
    if (block.type === "image") {
      const image = element("img");
      image.src = "../" + block.src; image.alt = block.alt;
      image.addEventListener("error", () => { image.replaceWith(element("p", "圖片無法載入，請查看圖說或回報此教材問題。")); });
      figure.append(image);
    } else {
      try { figure.append(LectureFigures.render(block)); }
      catch (error) { figure.append(element("p", `圖表待修正：${error.message}`)); }
    }
    figure.append(element("figcaption", block.caption || block.alt || "依本觀念資料繪製"));
    if (block.type === "diagram") figure.append(element("p", "小螢幕可在圖表內橫向捲動。", "fine-print"));
    host.append(figure);
  }
}
function addReview(concept,host) {
  const panel=element('details',undefined,'review-panel'),summary=element('summary','展開：複製去問 ChatGPT／Gemini');summary.setAttribute('aria-expanded','false');panel.append(summary);
  panel.addEventListener('toggle',()=>{summary.textContent=(panel.open?'收合':'展開')+'：複製去問 ChatGPT／Gemini';summary.setAttribute('aria-expanded',String(panel.open));});
  const key='blanktime:review-draft:'+BlanktimeData.activeId()+':'+concept.id,store=window.BlanktimeStore||localStorage;
  const input=element('textarea');input.id='derivation';input.rows=6;input.maxLength=12000;input.placeholder='寫下你的想法、解題步驟與 LaTeX 算式…';
  try{input.value=drafts.get(concept.id)??store.getItem(key)??'';}catch{input.value=drafts.get(concept.id)||'';}
  const label=element('label','我的解題步驟與算式草稿');label.htmlFor=input.id;
  const result=element('p');result.setAttribute('role','status');input.addEventListener('input',()=>{drafts.set(concept.id,input.value);try{store.setItem(key,input.value);}catch{result.textContent='本機空間不足，請先複製草稿保存。';}});
  const copy=button('一鍵複製題目、答案與步驟',async()=>{const text=BlanktimeStudyTools.reviewPrompt(lesson,concept,quizStates.get(concept.id)?.choice,input.value);try{await navigator.clipboard.writeText(text);result.textContent='已複製，請貼到 ChatGPT／Gemini 對話。網站不會替你傳送內容。';}catch{const fallback=element('textarea');fallback.readOnly=true;fallback.value=text;fallback.rows=10;panel.append(fallback);result.textContent='剪貼簿受限，請從下方文字框手動複製。';}});
  panel.append(element('p','草稿保存在這個帳號的本機快取。複製內容包含本題、選項、你的答案、步驟、相關公式及來源頁碼。'),label,input,copy,result);host.append(panel);
}
function renderConcept() {
  const token = ++renderToken;
  const concept = lesson.concepts[currentIndex];
  savedProgress.visit(concept.id);
  const quizState = quizStates.get(concept.id) || { choice: null, attempted: false, correct: false, revealed: false, feedback: "先選一個答案，再確認你的理解。", numericInput: "", numericFeedback: "" };
  quizStates.set(concept.id, quizState);
  if (window.MathJax?.typesetClear) window.MathJax.typesetClear([target]);
  target.replaceChildren();
  target.append(element("p", `觀念 ${currentIndex + 1} / ${lesson.concepts.length}`, "eyebrow"), element("h1", concept.title));
  document.title = `${concept.title} · 留白日程`;
  if (concept.goal) target.append(element("p", concept.goal, "lead"));
  target.append(element("p", `先備知識：${(concept.prerequisites || []).join("、") || "教材指定的基礎知識"}`, "source-note"));
  const understanding = element("section", undefined, "learning-stage");
  understanding.id = "understand";
  understanding.append(element("p", "先理解觀念", "stage-label"), element("h2", "用白話弄懂它"));
  const application = element("section", undefined, "learning-stage");
  application.id = "apply-formula";
  application.append(element("p", "再學會應用", "stage-label"), element("h2", "公式怎麼用"), element("p", "著重適用情境、符號意義與計算方法；教材來源列在下方。較完整的推導可按需要展開。", "source-note"));
  let formulaSections = 0;
  for (const section of concept.sections) {
    const formulaRelated = /公式|符號|推導|例題|精簡|計算|應用/.test(section.title) || section.blocks.some(b => b.type === "formula");
    const optionalDerivation = /推導/.test(section.title);
    if (formulaRelated) formulaSections += 1;
    const area = element(optionalDerivation ? "details" : "section", undefined, "teaching-section");
    area.append(element(optionalDerivation ? "summary" : "h3", section.title));
    area.append(element("span", section.origin || "教材整理", "origin-tag"));
    section.blocks.forEach(block => renderBlock(block, area));
    (formulaRelated ? application : understanding).append(area);
  }
  if (understanding.children.length > 2) target.append(understanding);
  if (formulaSections) target.append(application);
  LectureWorkspace.setSubject(concept.subject || lesson.subject);
  const vectorBlock = concept.sections.flatMap(s => s.blocks).find(b => b.type === "diagram" && b.kind === "vector");
  
  const sourcePanel = element("details", undefined, "sources");
  sourcePanel.append(element("summary", "觀念與公式的教材來源"));
  for (const source of lesson.sources.filter(source => concept.sources.includes(source.id))) {
    sourcePanel.append(element("p", [source.title, source.author, source.edition, source.section, source.pages && `頁碼 ${source.pages}`, source.pdfPages && `PDF 第 ${source.pdfPages} 頁`].filter(Boolean).join(" · ")));
    if (source.url && /^https?:\/\//.test(source.url)) {
      const link = element("a", "查看來源"); link.href = source.url; link.target = "_blank"; link.rel = "noopener noreferrer"; sourcePanel.append(link);
    }
  }
  target.append(sourcePanel);
  const quiz = element("section", undefined, "quiz-panel");
  quiz.append(element("p", "最後做題驗證 · 依匯入教材包出題", "eyebrow"), element("h2", "換你試試看"));
  const form = element("form");
  const fieldset = element("fieldset"); fieldset.append(element("legend", concept.quiz.prompt));
  concept.quiz.options.forEach((option, i) => {
    const label = element("label", undefined, "option");
    const radio = element("input"); radio.type = "radio"; radio.name = "answer"; radio.value = String(i); radio.required = true;
    radio.checked = quizState.choice === i;
    radio.addEventListener("change", () => {
      quizState.choice = i;
      quizState.correct = false;
      quizState.feedback = "已選擇答案，請確認你的理解。";
      feedback.textContent = quizState.feedback;
      feedback.classList.remove("correct");
      continueButton.disabled = !(quizState.revealed || savedProgress.completed.includes(concept.id));
    });
    label.append(radio, document.createTextNode(`${String.fromCharCode(65 + i)}. ${option}`)); fieldset.append(label);
  });
  const feedback = element("p", quizState.feedback, "feedback"); feedback.setAttribute("role", "status");
  feedback.classList.toggle("correct", quizState.correct);
  const submit = element("button", quizState.attempted ? "再確認一次" : "確認答案", "action-button"); submit.type = "submit";
  const solution = element("div", undefined, "solution"); solution.hidden = !quizState.revealed;
  solution.setAttribute("aria-live", "polite");
  solution.append(element("h3", `正確答案：${String.fromCharCode(65 + concept.quiz.answer)}`));
  concept.quiz.explanations.forEach((explanation, i) => solution.append(element("p", `${String.fromCharCode(65 + i)}. ${explanation}`)));
  form.append(fieldset, submit);
  form.addEventListener("submit", event => {
    event.preventDefault();
    const selected = new FormData(form).get("answer");
    if (selected === null) return;
    const correct = Number(selected) === concept.quiz.answer;
    quizState.choice = Number(selected);
    quizState.attempted = true;
    quizState.correct = correct;
    quizState.revealed = true;
    quizState.feedback = correct ? "答對了！下方已列出解析，確認理解後再繼續。" : `這次選擇不正確。提示：${concept.quiz.hint} 下方已列出完整解析。`;
    feedback.textContent = quizState.feedback;
    feedback.classList.toggle("correct", correct);
    solution.hidden = false;
    continueButton.disabled = false;
    renderMath(solution);
    submit.textContent = "再確認一次";
  });
  quiz.append(form, feedback, solution); target.append(quiz);
  if (concept.numeric) {
    const n = concept.numeric;
    const numeric = element("section", undefined, "quiz-panel"); numeric.append(element("h2", "數值練習"));
    const nform = element("form"); const number = element("input"); number.type = "text"; number.inputMode = "decimal"; number.id = "numeric-answer";
    number.value = quizState.numericInput;
    number.addEventListener("input", () => { quizState.numericInput = number.value; });
    const nlabel = element("label", `${n.prompt}（單位 ${n.unit || "無"}，容許誤差 ±${n.tolerance}）`); nlabel.htmlFor = number.id;
    const nresult = element("p", quizState.numericFeedback); nresult.setAttribute("role", "status");
    const nsubmit = element("button", "核對數值", "secondary-button"); nsubmit.type = "submit";
    nform.append(nlabel, number, nsubmit); numeric.append(nform, nresult);
    nform.addEventListener("submit", e => {
      e.preventDefault();
      const correct = core.checkNumeric(number.value, n.answer, n.tolerance);
      quizState.numericFeedback = correct === null ? "請輸入有限的數字，單位不需輸入。" : correct ? "數值正確。" : "數值還不一致，請檢查單位、代入與計算。";
      nresult.textContent = quizState.numericFeedback;
    });
    target.append(numeric);
  }
  addReview(concept, target);
  const controls = element("div", undefined, "lesson-controls");
  const previous = button("← 上一個觀念", () => navigate(currentIndex - 1), "secondary-button"); previous.disabled = currentIndex === 0;
  const continueButton = button(currentIndex === lesson.concepts.length - 1 ? "我已理解，完成本章 ✓" : "我已理解，下一個觀念 →", () => {
    savedProgress.complete(concept.id); refreshProgress();
    if (currentIndex + 1 < lesson.concepts.length) navigate(currentIndex + 1);
    else {
      continueButton.textContent = "本章已完成 ✓";
      const nextChapter = catalog.chapters[catalog.chapters.findIndex(c => c.id === lesson.id) + 1];
      if (nextChapter && !controls.querySelector("a")) {
        const link = element("a", "前往下一章 →", "action-button"); link.href = "../" + nextChapter.path; controls.append(link);
      }
    }
  });
  continueButton.disabled = !(quizState.correct || quizState.revealed || savedProgress.completed.includes(concept.id));
  controls.append(previous, continueButton); target.append(controls);
  refreshProgress();
  renderMath(target, token);
}
function renderMath(host, token = renderToken) {
  if (!window.MathJax?.startup?.promise) return;
  window.MathJax.startup.promise.then(() => {
    if (token === renderToken && host.isConnected) return window.MathJax.typesetPromise([host]);
  }).catch(() => {});
}
function navigate(index) { location.hash = lesson.concepts[index].id; }
function selectHash() {
  const index = lesson.concepts.findIndex(c => `#${c.id}` === location.hash);
  currentIndex = index >= 0 ? index : 0;
  renderConcept();
  document.querySelector("#sidebar").classList.remove("is-open");
  document.querySelector("#menu-toggle").setAttribute("aria-expanded", "false");
  window.scrollTo({ top: 0, behavior: "auto" });
}
document.querySelector("#menu-toggle").addEventListener("click", e => {
  const open = e.currentTarget.getAttribute("aria-expanded") !== "true";
  e.currentTarget.setAttribute("aria-expanded", String(open)); document.querySelector("#sidebar").classList.toggle("is-open", open);
});
document.querySelector("#reset-progress").addEventListener("click", async () => {
  if (await BlanktimeDialogs.ask("要重設這門課程的理解進度嗎？登入時會同步到其他裝置。")) { savedProgress.reset(); quizStates.clear(); renderConcept(); }
});
(async () => {
  try {
    catalog = core.validateCatalog(await getJSON("../content/catalog.json"));
    const chapter = catalog.chapters.find(c => c.id === document.body.dataset.chapter);
    if (!chapter) throw Error("這個章節尚未加入教材。請先回首頁查看已開放的章節。");
    lesson = core.validateLesson(await getJSON(`../content/${chapter.id}/lesson.json`), chapter);
    if (!lesson.concepts.length) throw Error("本章尚未加入觀念。");
    document.querySelector("#chapter-name").textContent = chapter.title;
    if (!location.hash) {
      const resume = core.resumeConcept([chapter], savedProgress.completed, savedProgress.lastId);
      history.replaceState(null, "", `#${resume.concept.id}`);
    }
    window.addEventListener("hashchange", selectHash); selectHash();
  } catch (error) {
    target.replaceChildren(element("h1", "教材準備中"), element("p", error.message));
    document.querySelector("#progress-label").textContent = "尚未開放";
    document.querySelector("#reset-progress").disabled = true;
  }
})();


window.addEventListener("blanktime:store-change", event=>{if(event.detail.source === "remote" && lesson)refreshProgress();});
