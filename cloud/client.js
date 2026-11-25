/* Integration layer; not loaded by production until the cloud project is configured. */
(function (scope) {
  'use strict';
  const TYPES = new Set(['course','progress','mastery','timer']);
  const copy = value => JSON.parse(JSON.stringify(value));
  const key = (kind,id) => kind + ':' + id;
  function validate(kind,id,payload) {
    if (!TYPES.has(kind) || !/^[a-z0-9][a-z0-9:-]{0,159}$/.test(id)
      || !payload || typeof payload !== 'object' || Array.isArray(payload)) throw Error('同步資料格式錯誤');
    if (kind === 'timer' && id !== 'shared') throw Error('番茄鐘必須使用同一份共享狀態');
  }
  class Repository {
    constructor({rpc,uuid,clock=()=>Date.now(),sleep=ms=>new Promise(r=>setTimeout(r,ms))}) {
      this.rpc=rpc;this.uuid=uuid;this.clock=clock;this.sleep=sleep;
      this.documents=new Map();this.queue=Promise.resolve();this.offset=0;
    }
    now() {return this.clock()+this.offset;}
    accept(response,sent,received) {
      if (Number.isFinite(response.server_now)) this.offset=response.server_now-(sent+received)/2;
      const rows=response.documents || (response.document ? [response.document] : []);
      for (const row of rows) {
        validate(row.kind,row.document_id,row.payload);
        const old=this.documents.get(key(row.kind,row.document_id));
        if (!old || row.revision>=old.revision) this.documents.set(key(row.kind,row.document_id),copy(row));
      }
    }
    async pull() {
      const sent=this.clock(), response=await this.rpc('blanktime_read_documents',{});
      this.accept(response,sent,this.clock());return [...this.documents.values()].map(copy);
    }
    snapshot(kind,id) {const row=this.documents.get(key(kind,id));return row ? copy(row) : null;}
    change(kind,id,update) {
      const task=async()=>{
        // Pull first: a paused mobile tab must not overwrite a newer desktop timer.
        await this.pull();
        for (let attempt=0;attempt<4;attempt++) {
          const old=this.snapshot(kind,id), payload=await update(old ? copy(old.payload) : null,this.now());
          validate(kind,id,payload);
          const args={p_kind:kind,p_document_id:id,p_expected_revision:old?.revision || 0,p_payload:payload,p_operation_id:this.uuid()};
          let response;
          // Retry ambiguous network outcomes with exactly the same operation ID/body.
          for (let networkAttempt=0;networkAttempt<3;networkAttempt++) {
            const sent=this.clock();
            try { response=await this.rpc('blanktime_put_document',args);this.accept(response,sent,this.clock());break; }
            catch(e) {if(networkAttempt===2)throw e;await this.sleep(250*(networkAttempt+1));}
          }
          if(response.ok)return this.snapshot(kind,id);
          if(!response.conflict)throw Error('雲端尚未接受變更');
          await this.pull();
        }
        throw Error('另一台裝置正在修改，請稍後重試。原資料仍保留。');
      };
      const next=this.queue.then(task);this.queue=next.catch(()=>{});return next;
    }
  }
  function mergeProgress(local,remote) {
    const ids=[...new Set([...(remote?.completed || []),...(local?.completed || [])])];
    return {completed:ids,lastId:local?.lastId || remote?.lastId || null};
  }
  function mergeRecords(a=[],b=[]) {
    const rows=new Map();
    for(const row of [...a,...b]) {
      if(typeof row.id!=='string' || !Number.isFinite(row.at))throw Error('專注紀錄格式錯誤');
      if(!rows.has(row.id))rows.set(row.id,copy(row));
    }
    return [...rows.values()].sort((a,b)=>a.at-b.at);
  }
  // The timer uses the shared end timestamp, not a stream of one-second updates.
  function remaining(timer,serverNow) {
    return timer.status==='running' ? Math.max(0,timer.end-serverNow) : timer.remaining;
  }
  async function connect(config,{createClient}={}) {
    if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(config?.supabaseUrl || '')
      || !/^sb_publishable_[a-zA-Z0-9_-]+$/.test(config?.publishableKey || '')
      || config.publishableKey.includes('REPLACE_ME')) throw Error('尚未設定你的雲端專案');
    if(!createClient) {
      const sdk=await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.119.2/+esm');
      createClient=sdk.createClient;
    }
    const redirect=new URL(config.redirectUrl);
    if(redirect.origin!==location.origin || redirect.pathname!==location.pathname)throw Error('登入回傳網址必須是目前的網站入口');
    const client=createClient(config.supabaseUrl,config.publishableKey,{
      auth:{flowType:'pkce',detectSessionInUrl:true,persistSession:true,storageKey:'blanktime:auth:v1'}
    });
    const repository=new Repository({rpc:async(name,args)=>{const result=await client.rpc(name,args);if(result.error)throw result.error;return result.data;},uuid:()=>crypto.randomUUID()});
    return {client,repository,
      async signIn() {
        const {error}=await client.auth.signInWithOAuth({provider:'google',options:{redirectTo:redirect.href,scopes:'openid email profile'}});
        if(error)throw error;
      },
      async signOut() {const {error}=await client.auth.signOut({scope:'local'});if(error)throw error;repository.documents.clear();}
    };
  }
  const api={Repository,mergeProgress,mergeRecords,remaining,connect};
  scope.BlanktimeCloud=api;
  if(typeof module!=='undefined')module.exports=api;
})(typeof window==='undefined'?globalThis:window);
