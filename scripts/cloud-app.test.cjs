'use strict';
// Runs the real storage, Repository and account coordinator together. Auth/RPC
// are simulated here; these tests never sign in to the production service.
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {randomUUID}=require('node:crypto');
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222';
const clone=value=>JSON.parse(JSON.stringify(value));
const settle=async()=>{for(let i=0;i<25;i++)await new Promise(resolve=>setImmediate(resolve));};
function harness(search=''){
  const memory=new Map(),listeners=new Map(),nodes=new Map(),rows=new Map(),writes=[];
  let actor=A,authChange,holdNextPut=null,failReads=false;
  const node=id=>{if(!nodes.has(id))nodes.set(id,{textContent:'',hidden:false,disabled:false,replaceChildren(){},append(){},showModal(){},close(){}});return nodes.get(id);};
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
  for(const file of ['assets/value.js','assets/storage.js','assets/planner-core.js','cloud/client.js'])run(file);
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
  console.log('PASS: real account coordinator/storage/repository integration: reset ordering, edits during reset, remote reset conflicts, offline preservation, account isolation and late responses.');
  console.log('Auth/RPC are simulated; actual Google sign-in and physical cross-device checks remain required.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
