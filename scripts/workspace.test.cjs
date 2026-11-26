'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const P=require('../assets/planner-core.js'),T=require('../assets/themes.js'),B=require('../assets/backup-core.js');
const state=P.blank(),now=Date.parse('2026-11-26T08:00:00+08:00');
state.courses=[{id:'fixed',title:'經濟學',weekday:4,start:'09:00',end:'12:00',from:'2026-11-01',to:'2026-12-31',exceptions:[],skipHolidays:true,professor:'王教授',room:'R101',linkedCourseId:'demo-ratio',updatedAt:1}];
const cancel=P.cancelClass(state,'fixed','2026-11-26',now);assert.equal(cancel.events.length,0);assert.equal(P.forDay(cancel,'2026-11-26').length,0);assert.equal(P.forDay(state,'2026-11-26').length,1);
assert.equal(P.forDay(P.undoClassChange(cancel,'fixed','2026-11-26',now+1),'2026-11-26').length,1);
const moved=P.reschedule(state,'fixed','2026-11-26','2026-11-27','10:05','12:05',now,'makeup');assert.equal(moved.events[0].professor,'王教授');assert.equal(moved.events[0].linkedCourseId,'demo-ratio');
const undone=P.undoClassChange(moved,'fixed','2026-11-26',now+1);assert.equal(undone.events.length,0);assert.ok(undone.tombstones.includes('makeup'));assert.equal(P.forDay(undone,'2026-11-26').length,1);
assert.throws(()=>P.cancelClass(state,'fixed','2026-11-27',now),/這一天/);
state.events=[{id:'study',title:'經濟學・供需彈性',date:'2026-11-27',start:'10:00',end:'11:00',type:'study',source:'plan',importance:0,completed:false}];
let marked=P.markStudy(state,'study',false,now);assert.equal(P.status(marked.events[0],now),'未完成');assert.equal(P.unfinished(marked,now)[0].title,'經濟學・供需彈性');assert.ok(P.retainPlan(marked.events[0],now));
marked=P.markStudy(marked,'study',true,now);assert.equal(P.unfinished(marked,now).length,0);assert.equal(marked.events[0].manualIncomplete,false);assert.equal(P.unfinished(state,now+3*86400000).length,1);
const courses={'demo-ratio':{title:'比例換算'}};state.deadlines={'demo-ratio':{at:'2026-11-26T18:00:00+08:00',updatedAt:now}};
assert.ok(P.calendarForDay(state,'2026-11-26',courses).some(e=>e.source==='deadline'));
assert.ok(P.fullForDay(state,'2026-11-26',courses).some(e=>e.source==='course'));assert.ok(P.fullForDay(state,'2026-11-26',courses).some(e=>e.source==='deadline'));
assert.equal(P.weekStart('2026-11-29'),'2026-11-29');assert.equal(P.weekStart('2026-11-30'),'2026-11-29');
const layout=P.timetable([...state.courses,{...state.courses[0],id:'second',start:'10:00',end:'11:00'}]);assert.equal(layout[0].top,60);assert.equal(layout[0].height,180);assert.equal(layout[0].lanes,2);assert.notEqual(layout[0].lane,layout[1].lane);
// Apply all palettes to independent parent/iframe DOM adapters, with text contrast checks.
const luminance=hex=>{const rgb=hex.match(/\w\w/g).map(x=>parseInt(x,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;};
const ratio=(a,b)=>{a=luminance(a.slice(1));b=luminance(b.slice(1));return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);};
const fakeDoc=()=>({documentElement:{dataset:{},style:{setProperty(k,v){this[k]=v;}}}});
assert.equal(T.themes.length,7);for(const t of T.themes){const parent=fakeDoc(),frame=fakeDoc();T.apply(parent,t.id);T.apply(frame,t.id);assert.equal(JSON.stringify(parent),JSON.stringify(frame));assert.equal(frame.documentElement.style.colorScheme,t.scheme);assert.ok(ratio(t.tokens.ink,t.tokens.bg)>4.5);assert.ok(ratio(t.tokens.muted,t.tokens.surface)>4.5,t.name+' muted contrast');}
// openConcept must notify the live toolbar before opening a different course.
const pkg=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/math-package.json'),'utf8')),map=new Map([['blanktime:library:v1',JSON.stringify({courses:{[pkg.courseId]:pkg}})]]),events=[];let toolbar='old';const frame={src:''};
const scope={BlanktimeStore:{getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v)},dispatchEvent:e=>{events.push(e.type);if(e.type==='blanktime:course-selected')toolbar=map.get('blanktime:active-course:v1');}};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../assets/data.js'),'utf8'),{window:scope,localStorage:scope.BlanktimeStore,Event:class{constructor(type){this.type=type;}},document:{body:{dataset:{}},querySelector:()=>({click(){}}),getElementById:()=>frame},location:{search:''},URLSearchParams});
scope.BlanktimeData.openConcept(pkg.courseId,'ch01-c01');assert.equal(toolbar,pkg.courseId);assert.match(frame.src,/#ch01-c01$/);assert.ok(events.includes('blanktime:course-selected'));
const lesson=fs.readFileSync(path.join(__dirname,'../modules/learning/assets/js/lesson.js'),'utf8');assert.ok(!/cdn\.|createElement\("script"\)|window\.MathJax\s*=/.test(lesson),'legacy CDN loader returned');assert.match(lesson,/MathJax\.startup\.promise/);
for(const file of ['assets/planner.js','assets/library.js','assets/settings.js','modules/learning/assets/js/site.js','modules/learning/assets/js/lesson.js'])assert.ok(!/\bconfirm\s*\(/.test(fs.readFileSync(path.join(__dirname,'..',file),'utf8')),file+' uses a native confirmation');
const backup={format:'blanktime.backup/v2',library:{courses:{}},schedule:state,timerRecords:[],preferences:{font:'standard',reduced:false,theme:'paper'}};B.validate(backup);assert.equal(B.merge(backup,backup).preferences.theme,'paper');assert.throws(()=>B.validate({...backup,preferences:{...backup.preferences,theme:'invalid'}}),/佈景/);
console.log('PASS: cancellation/reschedule/undo, manual study states and calm notice data, deadlines in month/full week, timetable lanes, seven theme/iframe palettes and contrast, openConcept toolbar notification, no native confirmation/CDN fallback, v2 theme backup compatibility.');


assert.equal(P.weekStart('2026-11-28'),'2026-11-22');
assert.equal(P.weekStart('2027-01-01'),'2026-12-27');
const weekdays=P.timetable(Array.from({length:7},(_,weekday)=>({...state.courses[0],id:'day-'+weekday,weekday})));assert.deepEqual(weekdays.map(x=>x.day),[0,1,2,3,4,5,6]);
console.log('PASS: Sunday-first week boundaries across months/years and all seven timetable day mappings.');
