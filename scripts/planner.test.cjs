'use strict';
const assert=require('node:assert/strict'),core=require('../assets/planner-core.js');
const from='2026-11-26',now=core.day(from).getTime(),state=core.blank();
state.courses.push({id:'class-a',title:'固定三小時課程',weekday:core.day(from).getDay(),start:'09:00',end:'12:00',from,to:'2026-12-31',exceptions:[],skipHolidays:true,updatedAt:1});
core.validate(state);assert.equal(core.forDay(state,from)[0].type,'class');
state.events.push({id:'holiday-a',title:'已核對假日',date:from,type:'holiday',source:'user',importance:0,includeMatrix:false,updatedAt:1});
assert.equal(core.forDay(state,from).filter(e=>e.type==='class').length,0);assert.equal(core.matrix(state).length,0);state.events=[];
const deadline=new Date(core.day(core.addDays(from,2)).getTime()+20*3600000).toISOString();
const tasks=[{id:'intro',title:'基礎觀念',minutes:60,deadline,prerequisites:[]},{id:'practice',title:'應用練習',minutes:30,deadline,prerequisites:['intro']}];
const result=core.createPlan(state,tasks,from,7,now),work=result.events.filter(e=>e.type==='study');
assert.equal(result.pending.length,0);assert.equal(work.length,2);assert.equal(work[0].taskId,'intro');assert.equal(work[1].taskId,'practice');
for(const w of work){const length=core.minutes(w.end)-core.minutes(w.start);assert.ok([30,60].includes(length));assert.ok(new Date(w.date+'T'+w.end).getTime()<=Date.parse(deadline));const rest=result.events.find(e=>e.date===w.date&&e.type==='rest'&&core.minutes(e.start)<=core.minutes(w.end)&&core.minutes(e.end)>=core.minutes(w.end)+30);assert.ok(rest,'each work session has at least 30 minutes of rest');}
for(let i=0;i<7;i++){const date=core.addDays(from,i),flex=result.events.filter(e=>e.date===date&&e.type==='flex');assert.equal(flex.length,1);assert.ok(core.minutes(flex[0].end)-core.minutes(flex[0].start)>=30);}
for(const w of work)for(const fixed of core.forDay(state,w.date).filter(e=>e.start))assert.ok(core.minutes(w.end)<=core.minutes(fixed.start)||core.minutes(w.start)>=core.minutes(fixed.end),'work must not overlap classes');
const noTime=core.createPlan(state,[{id:'deadline',title:'已無可用時段',minutes:60,deadline:new Date(now+12*3600000).toISOString(),prerequisites:[]}],from,1,now);assert.equal(noTime.pending.length,1);
const packed=core.blank();packed.courses=[{...state.courses[0],end:'21:45'}];const blocked=core.createPlan(packed,tasks,from,1,now);assert.equal(blocked.events.filter(e=>e.type==='study').length,0);assert.ok(blocked.warnings.length>0);
const late=core.createPlan(core.blank(),tasks,from,1,now+15*3600000+17*60000);assert.ok(late.events.filter(e=>e.type==='study').every(e=>core.minutes(e.start)>=930));
const small=core.blank();small.prefs.maxStudyMinutes=30;assert.ok(core.createPlan(small,tasks,from,1,now).events.filter(e=>e.type==='study').every(e=>core.minutes(e.end)-core.minutes(e.start)===30));
const invalid=core.blank();invalid.events=[{id:'short-rest',title:'短休',date:from,type:'rest',source:'user',start:'10:00',end:'10:15',importance:0}];assert.throws(()=>core.validate(invalid),/至少 30/);
assert.throws(()=>core.day('2026-02-30'),/不存在/);
assert.ok(core.priority({deadline:new Date(now+3600000).toISOString(),importance:95},now).urgency>90);
const a=core.blank(),b=core.blank();a.events=[{id:'x',title:'A',date:from,type:'task',source:'user',importance:10,updatedAt:1}];b.events=[{...a.events[0],title:'B'}];assert.throws(()=>core.merge(a,b),/同版本衝突/);
const deleted=core.blank();deleted.tombstones=['x'];assert.equal(core.merge(deleted,a).events.length,0);
console.log('PASS: recurring classes, holiday exceptions, matrix filtering, dependencies, 30/60-minute units, 30-minute rests/flex, deadlines, no past scheduling and explicit unallocated tasks.');
