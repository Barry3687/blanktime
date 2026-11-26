(function(scope){
  'use strict';
  function reviewPrompt(lesson,concept,choice,draft){
    const sources=lesson.sources.filter(s=>concept.sources.includes(s.id)).map(s=>[s.title,s.section,s.pages&&'頁碼 '+s.pages,s.pdfPages&&'PDF 第 '+s.pdfPages+' 頁'].filter(Boolean).join('・'));
    return ['請以繁體中文依教材核對我的解題步驟，先指出正確處與第一個錯誤，再給修正理由，不要只給答案。','觀念：'+concept.title,'學習目標：'+(concept.goal||''),'題目：'+concept.quiz.prompt,...concept.quiz.options.map((x,i)=>String.fromCharCode(65+i)+'. '+x),'我的答案：'+(choice===null||choice===undefined?'尚未選擇':String.fromCharCode(65+choice)+'. '+concept.quiz.options[choice]),'我的步驟與算式：\n'+(draft||'尚未填寫'),'教材依據：',...concept.sections.filter(s=>s.blocks.some(b=>b.type==='formula')).flatMap(s=>s.blocks.filter(b=>b.text).map(b=>b.text)),'來源：',...sources,'若教材不足以判斷，請清楚說明缺少的資訊。'].join('\n\n');
  }
  const api={reviewPrompt};scope.BlanktimeStudyTools=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window==='undefined'?globalThis:window);
