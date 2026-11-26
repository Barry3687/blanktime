/* Browser test: open scripts/math-render.test.html over the normal local server. */
(async()=>{
  'use strict';
  const result=document.getElementById('result'),host=document.getElementById('fixture');
  const assert=(condition,message)=>{if(!condition)throw Error(message);};
  const add=(id,text)=>{const p=document.createElement('p');p.id=id;p.textContent=text;host.append(p);return p;};
  try{
    await window.MathJax.startup.promise;
    const formula=add('formula','\\[N=\\frac{nq}{1}\\]'),question=add('question','題幹：\\(N=3\\times4\\)'),option=add('option','B. \\(12\\)');
    await window.MathJax.typesetPromise([host]);
    for(const target of [formula,question,option])assert(target.querySelector('mjx-container svg path'),target.id+' 未產生 SVG 字形');
    const explanation=add('explanation','作答後解析：\\[N=3\\times4=12\\]');
    await window.MathJax.typesetPromise([explanation]);
    assert(explanation.querySelector('mjx-container svg path'),'即時解析未產生 SVG');
    assert(!host.querySelector('[data-mjx-error]'),'公式解析錯誤');
    const resources=performance.getEntriesByType('resource');
    assert(resources.every(r=>new URL(r.name).origin===location.origin),'測試載入了外部資源');
    assert(!resources.some(r=>/\.(woff2?|ttf|otf)(\?|$)/i.test(r.name)),'載入額外字型');
    result.textContent='PASS：公式、題幹、選項與動態解析共 4 個 SVG；零外部資源／額外字型。';document.title='PASS · 本機 MathJax';
  }catch(error){result.textContent='FAIL：'+error.message;document.title='FAIL · 本機 MathJax';console.error(error);}
})();
