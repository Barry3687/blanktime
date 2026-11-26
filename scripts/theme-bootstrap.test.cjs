'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path'),{themes}=require('../assets/themes.js');
const root=path.resolve(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8');
const files=['index.html','modules/learning/index.html','modules/learning/chapters/lesson.html','modules/learning/getting-started.html'];
const blocks=files.map(f=>{const h=read(f),m=h.match(/<script data-theme-bootstrap>([\s\S]*?)<\/script>/);assert.ok(m,f+' lacks first-paint bootstrap');assert.ok(h.indexOf(m[0])<h.indexOf('<link'),f+' theme is applied after stylesheet');return m[1];});
assert.equal(new Set(blocks).size,1,'head bootstraps differ');
const makeRoot=()=>({dataset:{},style:{setProperty(k,v){this[k]=v;}},classList:{values:new Set(),toggle(k,v){if(v)this.values.add(k);else this.values.delete(k);},contains(k){return this.values.has(k);}}});
function boot({parentTheme,prefs,cached,denied=false}={}){
  const html=makeRoot(),win={},parentRoot=makeRoot();if(parentTheme){parentRoot.dataset.theme=parentTheme;parentRoot.classList.toggle('reading-large',true);parentRoot.classList.toggle('reduce-motion',true);}
  const context={window:win,parent:parentTheme?{document:{documentElement:parentRoot}}:win,document:{documentElement:html},localStorage:{getItem(k){if(denied)throw Error('blocked');assert.ok(!/auth|token|supabase/i.test(k),'bootstrap accessed auth storage');return JSON.stringify(k==='blanktime:appearance:v1'?cached:prefs)||null;}}};
  vm.runInNewContext(blocks[0],context);return html;
}
const css=read('assets/themes.css');
for(const t of themes){
  const html=boot({cached:{theme:t.id,font:'large',reduced:true}});assert.equal(html.dataset.theme,t.id);assert.equal(html.style.colorScheme,t.scheme);assert.equal(html.style['--bg'],t.tokens.bg);assert.ok(html.classList.contains('reading-large'));assert.ok(html.classList.contains('reduce-motion'));assert.ok(css.includes(':root[data-theme="'+t.id+'"]'));assert.ok(css.includes('--surface:'+t.tokens.surface));
  const child=boot({parentTheme:t.id,cached:{theme:'invalid'}});assert.equal(child.dataset.theme,t.id);assert.ok(child.classList.contains('reading-large'));
}
assert.equal(boot({prefs:{theme:'paper'}}).dataset.theme,'paper');assert.equal(boot({cached:{theme:'wrong'}}).dataset.theme,'dusk');assert.equal(boot({cached:{theme:'__proto__'}}).dataset.theme,'dusk');assert.equal(boot({cached:null}).dataset.theme,'dusk');assert.equal(boot({denied:true}).dataset.theme,'dusk');
for(const file of files.slice(1))for(const m of read(file).matchAll(/href="([^"#]+)"/g))if(/(?:^|\/)(?:index|getting-started)\.html/.test(m[1]))assert.match(m[1],/\?v=fouc1$/);
// Run the actual home handler, verifying navigation is cancelled, not just its text.
const site=read('modules/learning/assets/js/site.js'),handler=site.slice(site.indexOf('document.querySelector'),site.indexOf('const chapterList'));
let listener,prevented=0,scroll=null;const html=makeRoot();vm.runInNewContext(handler,{document:{querySelector:s=>{assert.equal(s,'a.nav-home[aria-current="page"]');return {addEventListener:(type,fn)=>{listener=fn;}};},documentElement:html},window:{scrollTo:o=>scroll=o}});
listener({preventDefault(){prevented++;}});assert.equal(prevented,1);assert.equal(scroll.behavior,'smooth');assert.equal(scroll.top,0);html.classList.toggle('reduce-motion',true);listener({preventDefault(){}});assert.equal(scroll.behavior,'auto');
assert.match(read('assets/site.css'),/#learning-frame\{background:var\(--bg\);\}/);
assert.ok(!read('assets/themes.js').includes("let id='dusk'"),'deferred theme must not reset the early theme');
console.log('PASS: seven themes before CSS/paint, inherited iframe theme and reading/motion preferences, blocked storage, no auth reads, versioned home links and home click without iframe reload.');

// A preference edit must update the visual cache before apply(), even before auth resolves.
const settings=read('assets/settings.js'),cacheFn=settings.slice(settings.indexOf('  function cacheAppearance'),settings.indexOf('  function apply'));
const storeListener=settings.split('\n').find(line=>line.includes("window.addEventListener('blanktime:store-change'"));
let savedAppearance=null,applySaw=null,onPreference;
vm.runInNewContext(cacheFn+'\n'+storeListener,{prefKey:'blanktime:preferences:v1',window:{BlanktimeThemes:{get:id=>themes.find(t=>t.id===id)||themes[0]},addEventListener:(name,fn)=>onPreference=fn},localStorage:{setItem:(key,value)=>{assert.equal(key,'blanktime:appearance:v1');savedAppearance=JSON.parse(value);}},apply:()=>{applySaw=savedAppearance;}});
onPreference({detail:{key:'blanktime:preferences:v1',newValue:JSON.stringify({theme:'wine',font:'large',reduced:true,unrelated:'must not be cached'})}});
assert.deepEqual(savedAppearance,{theme:'wine',font:'large',reduced:true});assert.equal(applySaw.theme,'wine');
console.log('PASS: preference edits update only the three visual fields before initial/auth-pending theme application.');
