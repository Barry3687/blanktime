function requireCondition(condition, message) {
  if (!condition) throw new Error(message);
}
function nonempty(value) {
  return typeof value === "string" && value.trim().length > 0;
}
function validatePackage(data) {
  requireCondition(data?.format === "blanktime.study-package/v1", "教材包版本錯誤");
  requireCondition(/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(data.courseId ?? ""), "courseId 格式錯誤");
  requireCondition(nonempty(data.title), "缺少課程標題");
  requireCondition(Number.isInteger(data.revision) && data.revision > 0, "revision 必須是正整數");
  requireCondition(Array.isArray(data.warnings) && data.warnings.every(nonempty), "warnings 格式錯誤");
  requireCondition(Array.isArray(data.lessons) && data.lessons.length > 0, "缺少章節");
  const chapters = new Set();
  const concepts = new Map();
  for (const lesson of data.lessons) {
    requireCondition(/^ch\d{2}-[a-z0-9-]+$/.test(lesson.id ?? "") && !chapters.has(lesson.id), "章節 ID 錯誤或重複");
    chapters.add(lesson.id);
    requireCondition(nonempty(lesson.title), "章節缺少標題");
    requireCondition(Array.isArray(lesson.sources) && lesson.sources.length > 0, "缺少來源");
    const sourceIds = new Set();
    for (const source of lesson.sources) {
      requireCondition(nonempty(source.id) && !sourceIds.has(source.id) && nonempty(source.title)
        && nonempty(source.pages) && nonempty(source.pdfPages), "來源欄位缺漏或重複");
      sourceIds.add(source.id);
    }
    requireCondition(Array.isArray(lesson.concepts) && lesson.concepts.length > 0, "缺少觀念");
    for (const concept of lesson.concepts) {
      requireCondition(new RegExp("^" + lesson.id.slice(0, 4) + "-c\\d{2}$").test(concept.id ?? "")
        && !concepts.has(concept.id), "觀念 ID 錯誤或重複");
      concepts.set(concept.id, { chapterId: lesson.id, order: concepts.size });
      requireCondition(nonempty(concept.title) && nonempty(concept.goal), "觀念缺少標題或目標");
      requireCondition(Array.isArray(concept.prerequisites) && concept.prerequisites.every(nonempty), "先備知識格式錯誤");
      requireCondition(Array.isArray(concept.sources) && concept.sources.length > 0
        && concept.sources.every(id => sourceIds.has(id)), "來源參照不存在");
      requireCondition(Array.isArray(concept.sections) && concept.sections.length > 0, "缺少教學段落");
      for (const section of concept.sections) {
        requireCondition(nonempty(section.title) && nonempty(section.origin)
          && Array.isArray(section.blocks) && section.blocks.length > 0, "教學段落缺漏");
        for (const block of section.blocks) {
          requireCondition(["text", "formula", "image", "diagram"].includes(block.type), "不支援的內容區塊");
          if (["text", "formula"].includes(block.type)) requireCondition(nonempty(block.text), "缺少文字或公式");
          if (block.type === "image") requireCondition(
            /^assets\/images\/[a-zA-Z0-9_./-]+\.(svg|png|jpg|jpeg|webp)$/.test(block.src ?? "")
            && !block.src.includes("..") && nonempty(block.alt), "圖片路徑或說明錯誤");
          if (block.type === "diagram") requireCondition(nonempty(block.kind), "缺少圖表類型，需再由目的地驗證");
        }
      }
      const quiz = concept.quiz;
      requireCondition(quiz && nonempty(quiz.prompt) && Array.isArray(quiz.options)
        && quiz.options.length === 4 && quiz.options.every(nonempty)
        && new Set(quiz.options.map(value => value.trim())).size === 4, "題目必須有四個不重複選項");
      requireCondition(Number.isInteger(quiz.answer) && quiz.answer >= 0 && quiz.answer <= 3, "答案索引必須為 0 至 3");
      requireCondition(nonempty(quiz.hint) && Array.isArray(quiz.explanations)
        && quiz.explanations.length === 4 && quiz.explanations.every(nonempty), "缺少提示或選項解析");
    }
  }
  requireCondition(Array.isArray(data.study) && data.study.length === chapters.size, "讀書規劃需涵蓋所有章節");
  const planned = new Set();
  const linked = new Set();
  for (const chapter of data.study) {
    requireCondition(chapters.has(chapter.chapterId) && !planned.has(chapter.chapterId), "讀書規劃章節錯誤或重複");
    planned.add(chapter.chapterId);
    requireCondition(chapter.mastery === null || ["A", "B", "C", "F"].includes(chapter.mastery), "熟悉度必須是 A/B/C/F 或 null");
    requireCondition(Array.isArray(chapter.tasks), "缺少讀書任務");
    for (const task of chapter.tasks) {
      const concept = concepts.get(task.conceptId);
      requireCondition(concept?.chapterId === chapter.chapterId && !linked.has(task.conceptId), "任務觀念錯誤或重複");
      linked.add(task.conceptId);
      requireCondition([30, 60].includes(task.minutes), "任務長度必須為 30 或 60 分鐘");
      requireCondition(Array.isArray(task.prerequisiteIds)
        && new Set(task.prerequisiteIds).size === task.prerequisiteIds.length
        && task.prerequisiteIds.every(id => concepts.has(id) && concepts.get(id).order < concept.order), "先備 ID 不存在、重複或順序錯誤");
    }
  }
  requireCondition(linked.size === concepts.size, "部分觀念未連結讀書任務");
  return { chapters: chapters.size, concepts: concepts.size };
}


window.BlanktimeValidate = validatePackage;
