'use strict';
const assert=require('node:assert/strict');
const {Repository,mergeProgress,mergeRecords,remaining,connect}=require('../cloud/client.js');
const copy=x=>JSON.parse(JSON.stringify(x));
async function main(){
  let time=100000,uuid=0,loseResponse=false,forceConflict=false,writes=0;
  const rows=new Map(),operations=new Map();
  const rpc=async(name,args)=>{
    if(name==='blanktime_read_documents')return {documents:[...rows.values()].map(copy),server_now:time+5000};
    const k=args.p_kind+':'+args.p_document_id;
    if(operations.has(args.p_operation_id))return {...copy(operations.get(args.p_operation_id)),server_now:time+5000};
    let old=rows.get(k);
    if(forceConflict){forceConflict=false;old={kind:args.p_kind,document_id:args.p_document_id,revision:(old?.revision||0)+1,payload:{completed:['remote'],lastId:'remote'}};rows.set(k,old);}
    if((old?.revision||0)!==args.p_expected_revision)return {ok:false,conflict:true,document:copy(old),server_now:time+5000};
    const row={kind:args.p_kind,document_id:args.p_document_id,revision:args.p_expected_revision+1,payload:copy(args.p_payload)};
    rows.set(k,row);writes++;
    const response={ok:true,document:row,server_now:time+5000};operations.set(args.p_operation_id,copy(response));
    if(loseResponse){loseResponse=false;throw Error('Connection lost after server commit');}
    return response;
  };
  const repo=new Repository({rpc,uuid:()=>String(++uuid),clock:()=>time,sleep:async()=>{}});
  await repo.pull();assert.equal(repo.now(),105000);
  loseResponse=true;
  await repo.change('progress','course-a',current=>mergeProgress({completed:['local']},current));
  assert.equal(writes,1,'ambiguous network retry must not commit twice');
  forceConflict=true;
  await repo.change('progress','course-a',current=>mergeProgress({completed:['local-2']},current));
  assert.deepEqual(repo.snapshot('progress','course-a').payload.completed,['remote','local-2']);
  assert.equal(repo.snapshot('progress','course-a').revision,3);
  repo.accept({document:{kind:'progress',document_id:'course-a',revision:1,payload:{completed:[]}}},time,time);
  assert.equal(repo.snapshot('progress','course-a').revision,3,'old replies cannot roll back current state');
  const completed=mergeRecords([{id:'session-1',at:100}],[{id:'session-1',at:100},{id:'session-2',at:200}]);
  assert.equal(completed.length,2,'same focus session is counted once');
  assert.equal(remaining({status:'running',end:110000},repo.now()),5000);
  assert.equal(remaining({status:'paused',remaining:1234},999999),1234);
  assert.deepEqual(mergeProgress({completed:['one','two']},{completed:['one']}),{completed:['one','two'],lastId:null});
  await assert.rejects(repo.change('timer','another-timer',()=>({})),/共享狀態/);
  const guarded=new Repository({rpc,uuid:()=>String(++uuid),owner:'owner-a'});assert.throws(()=>guarded.accept({document:{user_id:'owner-b',kind:'course',document_id:'a',revision:1,payload:{}}},time,time),/帳號不符/);assert.equal(guarded.documents.size,0);
  const old=repo.snapshot('progress','course-a');
  repo.rpc=async()=>{throw Error('Offline');};
  await assert.rejects(repo.change('progress','course-a',()=>({completed:[]})),/Offline/);
  assert.deepEqual(repo.snapshot('progress','course-a'),old,'offline failures preserve cached data');
  await assert.rejects(connect({supabaseUrl:'https://example.com',publishableKey:'secret'}),/尚未設定/);
  global.location={origin:'https://barry3687.github.io',pathname:'/blanktime/'};
  let signInOptions;
  const auth=await connect({supabaseUrl:'https://test.supabase.co',publishableKey:'sb_publishable_test',redirectUrl:'https://barry3687.github.io/blanktime/'},{createClient:()=>({auth:{signInWithOAuth:async options=>{signInOptions=options;return {};},signOut:async()=>({})}})});
  await auth.signIn();assert.equal(signInOptions.provider,'google');assert.equal(signInOptions.options.scopes,'openid email profile');
  assert.ok(!signInOptions.options.scopes.includes('drive'),'no Google Drive permission requested');
  await auth.signOut();
  delete global.location;
  console.log('PASS: network replay, conflict rebase, stale replies, shared clock, duplicate records, offline preservation and Google-only auth parameters.');
  console.log('NOT TESTED: real Supabase SQL/RLS, real Google login, account cache isolation and actual cross-device integration.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
