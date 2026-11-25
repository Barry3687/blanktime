'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {PGlite}=require(process.argv[2] ? path.resolve(process.argv[2]) : '@electric-sql/pglite');
async function main(){
  const db=new PGlite();
  try {
    // Emulate only Supabase's auth identity function and roles; execute the real schema.
    await db.exec(`create role anon; create role authenticated; create schema auth;
      create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as
      $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      grant usage on schema auth to authenticated;
      grant execute on function auth.uid() to authenticated;
      insert into auth.users values ('11111111-1111-4111-8111-111111111111'),('22222222-2222-4222-8222-222222222222');`);
    await db.exec(fs.readFileSync(path.join(__dirname,'../cloud/schema.sql'),'utf8'));
    const login=async(id,role='authenticated')=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec('set role '+role);};
    const put=async(expected,payload,operation='33333333-3333-4333-8333-333333333333',kind='progress',id='course-a')=>{
      const r=await db.query('select public.blanktime_put_document($1,$2,$3,$4::jsonb,$5::uuid) as result',[kind,id,expected,JSON.stringify(payload),operation]);return r.rows[0].result;
    };
    await login('','anon');
    await assert.rejects(db.query('select public.blanktime_read_documents()'),/permission denied/);
    await assert.rejects(db.query('select * from public.blanktime_documents'),/permission denied/);
    await login('11111111-1111-4111-8111-111111111111');
    const first=await put(0,{completed:['a']});assert.equal(first.ok,true);assert.equal(first.document.revision,1);
    const replay=await put(0,{completed:['a']});assert.equal(replay.document.revision,1);
    await assert.rejects(put(0,{completed:['different']}),/reused/);
    const conflict=await put(0,{completed:['old']},'44444444-4444-4444-8444-444444444444');
    assert.equal(conflict.conflict,true);assert.deepEqual(conflict.document.payload.completed,['a']);
    const second=await put(1,{completed:['a','b']},'55555555-5555-4555-8555-555555555555');assert.equal(second.document.revision,2);
    await assert.rejects(db.query("update public.blanktime_documents set payload='{}'::jsonb"),/permission denied/);
    await assert.rejects(db.query('select * from public.blanktime_operations'),/permission denied/);
    await assert.rejects(put(0,{},'66666666-6666-4666-8666-666666666666','timer','other'),/shared timer/);
    await login('22222222-2222-4222-8222-222222222222');
    assert.equal((await db.query('select * from public.blanktime_documents')).rows.length,0,'B cannot read A');
    const read=await db.query('select public.blanktime_read_documents() as result');assert.deepEqual(read.rows[0].result.documents,[]);
    // Reusing A's operation UUID as B does not reveal A's saved response.
    const b=await put(0,{completed:['b-only']});assert.equal(b.document.user_id,'22222222-2222-4222-8222-222222222222');
    await login('11111111-1111-4111-8111-111111111111');
    const own=await db.query('select * from public.blanktime_documents');assert.equal(own.rows.length,1);assert.deepEqual(own.rows[0].payload.completed,['a','b']);
    console.log('PASS: actual schema execution, anonymous denial, A/B row isolation, RPC identity isolation, direct-write denial, replay deduplication and revision conflicts.');
    console.log('LIMIT: auth identity is emulated in local PGlite; Google OAuth and hosted Supabase still need live verification.');
  } finally {await db.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
