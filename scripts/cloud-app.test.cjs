'use strict';
// Runs the real storage, Repository and account coordinator together. Auth/RPC
// are simulated here; these tests never sign in to the production service.
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {randomUUID}=require('node:crypto');
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222';
const clone=value=>JSON.parse(JSON.stringify(value));
const settle=async()=>{for(let i=0;i<25;i++)await new Promise(resolve=>setImmediate(resolve));};
function harness(search='',sharedRows=new Map()){
  const memory=new Map(),listeners=new Map(),nodes=new Map(),rows=sharedRows,writes=[];
  let actor=A,authChange,holdNextPut=null,failReads=false;
  const node=id=>{if(!nodes.has(id))nodes.set(id,{dataset:{},textContent:'',hidden:false,disabled:false,replaceChildren(){},append(){},showModal(){},close(){}});return nodes.get(id);};
  const window={
    document:{getElementById:node,querySelectorAll:()=>[],addEventListener(){},createElement:()=>({})},
    localStorage:{getItem:key=>memory.get(key)??null,setItem:(key,value)=>memory.set(key,String(value)),removeItem:key=>memory.delete(key),key:index=>[...memory.keys()][index],get length(){return memory.size;}},
    addEventListener:(name,fn)=>{if(!listeners.has(name))listeners.set(name,[]);listeners.get(name).push(fn);},
    dispatchEvent:event=>{for(const fn of listeners.get(event.type)||[])fn(event);},
    BlanktimeValidate(){},LectureWorkspace:{resetMaterials(){}},
  };
  window.parent=window;
  const context=vm.createContext({window,document:window.document,navigator:{onLine:true},location:{origin:'https://example.test',pathname:'/',search},crypto:{randomUUID},URL,URLSearchParams,console,
    CustomEvent:class{constructor(type,{detail}){this.type=type;this.detail=detail;}},Event:class{constructor(type){this.type=type;}},setInterval(){},setTimeout,
    fetch:async url=>({ok:true,json:async()=>url==='cloud/config.json'?{supabaseUrl:'https://test.supabase.co',publishableKey:'sb_publishable_test',redirectUrl:'https://example.test/'}:{external:{google:true}}})});
  const run=file=>vm.runInContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),context,{filename:file});
  for(const file of ['assets/value.js','assets/storage.js','assets/planner-core.js','assets/course-state.js','assets/package-validator.js','assets/data.js','cloud/client.js'])run(file);
  const rowKey=(owner,kind,id)=>owner+':'+kind+':'+id;
  const seed=(owner,kind,id,payload,revision=1)=>rows.set(rowKey(owner,kind,id),{user_id:owner,kind,document_id:id,payload:clone(payload),revision});
  const rpc=async(name,args)=>{
    const owner=actor;
    if(name==='blanktime_read_documents'&&failReads)return {error:Error('simulated network failure')};
    if(name==='blanktime_read_documents')return {data:{documents:[...rows.values()].filter(row=>row.user_id===owner).map(clone),server_now:Date.now()}};
    if(holdNextPut){const wait=holdNextPut;holdNextPut=null;await wait;}
    const key=rowKey(owner,args.p_kind,args.p_document_id),old=rows.get(key);
    if((old?.revision||0)!==args.p_expected_revision)return {data:{ok:false,conflict:true,document:clone(old),server_now:Date.now()}};
    seed(owner,args.p_kind,args.p_document_id,args.p_payload,(old?.revision||0)+1);
    writes.push({owner,...clone(args)});
    return {data:{ok:true,document:clone(rows.get(key)),server_now:Date.now()}};
  };
  const client={rpc,auth:{getUser:async()=>({data:{user:{id:actor,email:actor+'@example.test'}}}),getSession:async()=>({data:{session:{user:{id:actor}}}}),onAuthStateChange:fn=>{authChange=fn;}}};
  window.BlanktimeCloud.connect=async()=>({client,repository:new window.BlanktimeCloud.Repository({rpc:async(name,args)=>(await rpc(name,args)).data,uuid:randomUUID}),signIn:async()=>{},signOut:async()=>{actor=null;authChange('SIGNED_OUT',null);}});
  return {window,context,rows,writes,node,seed,start:async()=>{run('assets/cloud-app.js');await settle();},get:(owner,kind,id)=>clone(rows.get(rowKey(owner,kind,id))),
    async switchTo(owner){actor=owner;authChange(owner?'SIGNED_IN':'SIGNED_OUT',owner?{user:{id:owner}}:null);await new Promise(resolve=>setTimeout(resolve,5));await settle();},
    holdPut(){let release;holdNextPut=new Promise(resolve=>{release=resolve;});return release;},
    failReads(value){failReads=value;},
    async retry(){await node('account-retry').onclick();await settle();}
  };
}
async function main(){
  const h=harness(),key='blanktime:learning:progress:course-a';
  h.seed(A,'progress','course-a',{completed:['old'],lastId:'old',generation:'g1'});
  await h.start();
  const store=h.window.BlanktimeStore;
  assert.equal(store.owner,A);assert.deepEqual(JSON.parse(store.getItem(key)),['old']);
  // Exact UI reset sequence: clearing two keys must not turn reset into union.
  store.removeItem(key);store.removeItem(key+':last');await settle();await h.retry();
  assert.deepEqual(h.get(A,'progress','course-a').payload.completed,[]);
  assert.equal(h.get(A,'progress','course-a').payload.lastId,null);
  assert.notEqual(h.get(A,'progress','course-a').payload.generation,'g1');
  assert.deepEqual(JSON.parse(store.getItem('blanktime:sync:pending:v1')),{});
  // Another lesson completed while a reset is waiting for its server response.
  store.setItem(key,'["before-reset"]');await settle();await h.retry();
  const release=h.holdPut();store.removeItem(key);store.removeItem(key+':last');await settle();
  store.setItem(key,'["after-reset"]');store.setItem(key+':last','after-reset');
  release();await settle();await h.retry();
  assert.deepEqual(h.get(A,'progress','course-a').payload.completed,['after-reset']);
  assert.equal(h.get(A,'progress','course-a').payload.lastId,'after-reset');
  // A reset on a different device must not be undone by an offline completion.
  h.context.navigator.onLine=false;store.setItem(key,'["after-reset","offline"]');
  const old=h.get(A,'progress','course-a');h.seed(A,'progress','course-a',{completed:[],lastId:null,generation:'remote-reset'},old.revision+1);
  h.context.navigator.onLine=true;await h.retry();
  assert.deepEqual(h.get(A,'progress','course-a').payload.completed,[]);
  assert.ok(JSON.parse(store.getItem('blanktime:sync:pending:v1'))['progress:course-a']);
  assert.match(h.node('account-status').textContent,/重設過進度/);
  // Account switching keeps pending work and private caches with their owner.
  h.seed(B,'progress','course-a',{completed:['b-only'],lastId:'b-only',generation:'b1'});
  await h.switchTo(B);assert.equal(store.owner,B);assert.deepEqual(JSON.parse(store.getItem(key)),['b-only']);
  assert.equal(store.getItem('blanktime:sync:pending:v1'),null);
  await h.switchTo(A);assert.deepEqual(JSON.parse(store.getItem(key)),['after-reset','offline']);
  assert.ok(JSON.parse(store.getItem('blanktime:sync:pending:v1'))['progress:course-a']);
  // A late reply for A cannot change B's DOM/cache/repository.
  const late=harness();await late.start();const unblock=late.holdPut();
  late.window.BlanktimeStore.setItem(key,'["late-a"]');await settle();await late.switchTo(B);
  unblock();await settle();
  assert.equal(late.window.BlanktimeStore.owner,B);assert.equal(late.window.BlanktimeStore.getItem(key),null);
  assert.equal(late.get(A,'progress','course-a').payload.completed[0],'late-a');
  const offline=harness();offline.failReads(true);await offline.start();
  offline.context.navigator.onLine=false;
  offline.window.BlanktimeStore.setItem(key,'["saved-during-outage"]');
  assert.ok(JSON.parse(offline.window.BlanktimeStore.getItem('blanktime:sync:pending:v1'))['progress:course-a'],'initial pull failure must not discard subsequent edits');
  offline.failReads(false);offline.context.navigator.onLine=true;await offline.retry();
  assert.deepEqual(offline.get(A,'progress','course-a').payload.completed,['saved-during-outage']);
  const expired=harness('?error=invalid_request&error_code=bad_oauth_state');await expired.start();
  assert.match(expired.node('account-status').textContent,/授權已逾時/);
  assert.equal(expired.node('account-login').disabled,false,'a failed callback must still allow a fresh sign-in');
  // Course lifecycle uses the existing course/progress/mastery document kinds.
  const pkg=JSON.parse(fs.readFileSync(path.join(__dirname,'../skills/blanktime-study-coach/examples/minimal-package.json'),'utf8'));
  const life=harness();life.seed(A,'course',pkg.courseId,pkg);life.seed(A,'progress',pkg.courseId,{completed:['ch01-c01'],lastId:'ch01-c01'});life.seed(A,'mastery',pkg.courseId,{'ch01-ratio':'C'});await life.start();
  life.window.BlanktimeData.lifecycle(pkg.courseId,'trash');await settle();await life.retry();
  assert.equal(life.get(A,'course',pkg.courseId).payload.status,'trashed');
  assert.deepEqual(life.get(A,'progress',pkg.courseId).payload.completed,['ch01-c01']);
  life.window.BlanktimeData.lifecycle(pkg.courseId,'restore');await settle();await life.retry();
  assert.equal(life.get(A,'course',pkg.courseId).payload.status,'active');
  assert.ok(life.window.BlanktimeData.library().courses[pkg.courseId]);
  const expiredDoc=life.window.BlanktimeCourseState.trash(pkg,Date.now()-31*86400000,randomUUID());
  const oldCourse=life.get(A,'course',pkg.courseId);life.seed(A,'course',pkg.courseId,expiredDoc,oldCourse.revision+1);
  await life.retry();await settle();await life.retry();await life.retry();
  assert.equal(life.get(A,'course',pkg.courseId).payload.status,'purged');
  assert.equal(life.get(A,'course',pkg.courseId).payload.package,null);
  assert.ok(life.get(A,'progress',pkg.courseId).payload._coursePurged);
  assert.ok(life.get(A,'mastery',pkg.courseId).payload._coursePurged);
  assert.equal(life.window.BlanktimeData.progress(pkg.courseId).length,0);
  assert.throws(()=>life.window.BlanktimeData.importPackage(pkg),/永久清除/);
  assert.ok(life.writes.every(w=>['course','progress','mastery','timer','schedule'].includes(w.p_kind)));
  // Two independent stores/Repositories share only the simulated remote database.
  const db=new Map(),deviceA=harness('',db),deviceB=harness('',db);
  deviceA.seed(A,'course',pkg.courseId,pkg);deviceA.seed(A,'progress',pkg.courseId,{completed:['ch01-c01'],lastId:'ch01-c01'});
  deviceA.seed(A,'mastery',pkg.courseId,{'ch01-ratio':'F'});
  await deviceA.start();await deviceB.start();
  deviceA.window.BlanktimeData.lifecycle(pkg.courseId,'trash');await settle();await deviceA.retry();await deviceB.retry();
  assert.ok(deviceB.window.BlanktimeData.library().trash[pkg.courseId]);
  assert.deepEqual(Array.from(deviceB.window.BlanktimeData.progress(pkg.courseId)),['ch01-c01']);
  deviceB.window.BlanktimeData.lifecycle(pkg.courseId,'restore');await settle();await deviceB.retry();await deviceA.retry();
  assert.ok(deviceA.window.BlanktimeData.library().courses[pkg.courseId]);
  assert.equal(JSON.parse(deviceA.window.BlanktimeStore.getItem('blanktime:mastery:'+pkg.courseId))['ch01-ratio'],'F');
  const scheduleKey='blanktime:planner:v1',pa=deviceA.window.BlanktimePlannerCore;
  let sa=pa.blank();sa.deadlines={[pkg.courseId]:{at:'2026-12-03T10:00:00+08:00',updatedAt:1}};
  deviceA.window.BlanktimeStore.setItem(scheduleKey,JSON.stringify(sa));await settle();await deviceA.retry();await deviceB.retry();
  assert.equal(JSON.parse(deviceB.window.BlanktimeStore.getItem(scheduleKey)).deadlines[pkg.courseId].at,sa.deadlines[pkg.courseId].at);
  sa=JSON.parse(deviceA.window.BlanktimeStore.getItem(scheduleKey));
  sa.courses=[{id:'fixed',title:'固定課程',weekday:4,start:'09:00',end:'12:00',from:'2026-11-01',to:'2026-12-31',exceptions:[],skipHolidays:true,updatedAt:1}];
  sa=pa.reschedule(sa,'fixed','2026-11-26','2026-11-27','10:05','12:05',Date.now(),'makeup');
  deviceA.window.BlanktimeStore.setItem(scheduleKey,JSON.stringify(sa));await settle();await deviceA.retry();await deviceB.retry();
  const sb=JSON.parse(deviceB.window.BlanktimeStore.getItem(scheduleKey));assert.ok(sb.courses[0].exceptions.includes('2026-11-26'));assert.equal(sb.events[0].start,'10:05');
  // Manual incomplete is distinct from an upcoming default state and is synced.
  let currentSchedule=JSON.parse(deviceA.window.BlanktimeStore.getItem(scheduleKey));
  currentSchedule.events.push({id:'study-slot',title:'同步讀書時段',type:'study',source:'plan',date:'2026-12-01',start:'13:00',end:'14:00',importance:0,completed:false,updatedAt:1});
  currentSchedule=pa.markStudy(currentSchedule,'study-slot',false,Date.now());deviceA.window.BlanktimeStore.setItem(scheduleKey,JSON.stringify(currentSchedule));await settle();await deviceA.retry();await deviceB.retry();
  assert.equal(JSON.parse(deviceB.window.BlanktimeStore.getItem(scheduleKey)).events.find(e=>e.id==='study-slot').manualIncomplete,true);
  currentSchedule=pa.undoClassChange(JSON.parse(deviceA.window.BlanktimeStore.getItem(scheduleKey)),'fixed','2026-11-26',Date.now());deviceA.window.BlanktimeStore.setItem(scheduleKey,JSON.stringify(currentSchedule));await settle();await deviceA.retry();await deviceB.retry();
  assert.ok(!JSON.parse(deviceB.window.BlanktimeStore.getItem(scheduleKey)).events.some(e=>e.id==='makeup'));
  currentSchedule=pa.cancelClass(JSON.parse(deviceA.window.BlanktimeStore.getItem(scheduleKey)),'fixed','2026-11-26',Date.now());deviceA.window.BlanktimeStore.setItem(scheduleKey,JSON.stringify(currentSchedule));await settle();await deviceA.retry();await deviceB.retry();
  assert.ok(JSON.parse(deviceB.window.BlanktimeStore.getItem(scheduleKey)).courses[0].exceptions.includes('2026-11-26'));
  deviceB.context.navigator.onLine=false;
  const stale=clone(pkg);stale.revision=2;deviceB.window.BlanktimeData.importPackage(stale);
  deviceA.window.BlanktimeData.lifecycle(pkg.courseId,'trash');await settle();await deviceA.retry();
  deviceA.window.BlanktimeData.lifecycle(pkg.courseId,'purge');await settle();await deviceA.retry();await deviceA.retry();
  deviceB.context.navigator.onLine=true;await deviceB.retry();await deviceB.retry();
  assert.ok(deviceB.window.BlanktimeData.library().removed[pkg.courseId]);
  assert.equal(deviceB.window.BlanktimeData.progress(pkg.courseId).length,0);
  assert.equal(db.get(A+':course:'+pkg.courseId).payload.status,'purged');
  assert.equal(JSON.parse(deviceB.window.BlanktimeStore.getItem('blanktime:sync:pending:v1'))['course:'+pkg.courseId],undefined);
  console.log('PASS: independent device trash/restore/progress/mastery, course deadline and reschedule sync; permanent purge blocks offline stale course updates.');
  console.log('PASS: real account coordinator/storage/repository integration: reset ordering, edits during reset, remote reset conflicts, offline preservation, account isolation and late responses.');
  console.log('Auth/RPC are simulated; actual Google sign-in and physical cross-device checks remain required.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
