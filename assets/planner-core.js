(function(scope){
  'use strict';
  const values=scope.BlanktimeValue||(typeof module!=='undefined'?require('./value.js'):null);
  const TYPES=['task','assignment','exam','meeting','study','rest','flex','holiday'];
  function dateKey(date){return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;}
  function day(value){if(!/^\d{4}-\d{2}-\d{2}$/.test(value))throw Error('日期格式錯誤');const [y,m,d]=value.split('-').map(Number),date=new Date(y,m-1,d);if(dateKey(date)!==value)throw Error('日期不存在');return date;}
  function addDays(value,n){const d=day(value);d.setDate(d.getDate()+n);return dateKey(d);}
  function minutes(value){if(!/^\d{2}:\d{2}$/.test(value))throw Error('時間格式錯誤');const [h,m]=value.split(':').map(Number);if(h>23||m>59)throw Error('時間不存在');return h*60+m;}
  function time(value){return `${String(Math.floor(value/60)).padStart(2,'0')}:${String(value%60).padStart(2,'0')}`;}
  function stamp(date,minute){return day(date).getTime()+minute*60000;}
  function blank(){return {version:1,events:[],courses:[],tombstones:[],prefs:{dayStart:540,dayEnd:1320,maxStudyMinutes:240}};}
  function validate(state){
    if(state?.version!==1||!Array.isArray(state.events)||!Array.isArray(state.courses)||!Array.isArray(state.tombstones))throw Error('行程資料格式錯誤');
    const ids=new Set();
    for(const row of [...state.events,...state.courses]){if(typeof row.id!=='string'||!row.id||ids.has(row.id)||typeof row.title!=='string'||!row.title.trim()||row.title.length>200)throw Error('事項名稱或 ID 錯誤');ids.add(row.id);}
    for(const e of state.events){
      day(e.date);if(!TYPES.includes(e.type)||!['user','plan'].includes(e.source))throw Error('事項類別錯誤');
      if((e.start&&!e.end)||(!e.start&&e.end))throw Error('請同時填開始與結束時間');
      if(e.start){const a=minutes(e.start),b=minutes(e.end);if(a>=b||a%5||b%5)throw Error('起訖時間必須為同一天、5 分鐘的倍數，且結束晚於開始');}
      if(['rest','flex'].includes(e.type)&&e.start&&minutes(e.end)-minutes(e.start)<30)throw Error('休息與彈性時間至少 30 分鐘');
      if(!Number.isFinite(e.importance)||e.importance<0||e.importance>100)throw Error('重要程度須介於 0–100');
      if(e.deadline&&!Number.isFinite(Date.parse(e.deadline)))throw Error('截止時間錯誤');
      if(e.estimate!==undefined&&(!Number.isFinite(e.estimate)||e.estimate<=0||e.estimate>1440))throw Error('預估工時錯誤');
    }
    for(const c of state.courses){if(!Number.isInteger(c.weekday)||c.weekday<0||c.weekday>6)throw Error('課表星期錯誤');day(c.from);day(c.to);if(c.to<c.from)throw Error('課表結束日期早於開始');const a=minutes(c.start),b=minutes(c.end);if(a>=b||a%5||b%5)throw Error('課程時間錯誤');if(!Array.isArray(c.exceptions))throw Error('停課日期格式錯誤');c.exceptions.forEach(day);}
    const p=state.prefs;if(!p||!Number.isInteger(p.dayStart)||!Number.isInteger(p.dayEnd)||p.dayStart<0||p.dayEnd>1439||p.dayStart>=p.dayEnd||!Number.isInteger(p.maxStudyMinutes)||p.maxStudyMinutes<30||p.maxStudyMinutes>720||p.maxStudyMinutes%30)throw Error('讀書時段設定錯誤');
    return state;
  }
  function forDay(state,date){
    const holiday=state.events.some(e=>e.date===date&&e.type==='holiday');
    const events=state.events.filter(e=>e.date===date).map(e=>({...e}));
    for(const c of state.courses){if(date>=c.from&&date<=c.to&&day(date).getDay()===c.weekday&&!c.exceptions.includes(date)&&!(holiday&&c.skipHolidays))events.push({...c,id:c.id+'@'+date,date,type:'class',source:'course'});}
    return events.sort((a,b)=>(a.start?minutes(a.start):-1)-(b.start?minutes(b.start):-1));
  }
  function priority(event,now=Date.now()){
    const hours=event.deadline?(Date.parse(event.deadline)-now)/3600000:Infinity;
    const urgency=hours<=0?100:hours<=24?90+10*(1-hours/24):hours<=168?50+40*(1-(hours-24)/144):hours<=720?20+30*(1-(hours-168)/552):10;
    return {urgency,importance:event.importance};
  }
  function matrix(state){return state.events.filter(e=>e.source==='user'&&e.includeMatrix&&!e.completed&&!['holiday','rest','flex'].includes(e.type));}
  const overlaps=(a,b)=>a.start<b.end&&a.end>b.start;
  function createPlan(state,tasks,from,days=7,now=Date.now()){
    validate(state);day(from);if(days<1||days>14)throw Error('請規劃 1–14 天');
    const unique=new Set();for(const t of tasks){if(!t.id||unique.has(t.id)||!Number.isInteger(t.minutes)||t.minutes<=0||!Array.isArray(t.prerequisites))throw Error('讀書任務資料錯誤');unique.add(t.id);}
    const remaining=new Map(tasks.map(t=>[t.id,{...t,left:Math.ceil(t.minutes/30)*30}]));
    const scheduled=new Set(),events=[],warnings=[];
    for(let index=0;index<days;index++){
      const date=addDays(from,index),p=state.prefs;
      const existing=forDay(state,date).filter(e=>e.start&&(e.source!=='plan'||e.completed)).map(e=>({start:minutes(e.start),end:minutes(e.end),type:e.type}));
      const busy=[...existing];
      const put=(type,start,end,title)=>{const event={id:`plan-${date}-${start}-${type}`,title,date,start:time(start),end:time(end),type,source:'plan',importance:0,includeMatrix:false,completed:false};events.push(event);busy.push({start,end,type});return event;};
      // Meal breaks are never inserted over fixed events.
      for(const [start,end,title] of [[720,780,'午餐與休息'],[1080,1140,'晚餐與休息']])if(start>=p.dayStart&&end<=p.dayEnd&&stamp(date,end)>now&&!busy.some(b=>overlaps({start,end},b)))put('rest',start,end,title);
      let flex=null;
      for(let end=Math.floor(p.dayEnd/30)*30;end-30>=p.dayStart;end-=30){const slot={start:end-30,end};if(stamp(date,slot.start)>=now&&!busy.some(b=>overlaps(slot,b))){flex=put('flex',slot.start,slot.end,'彈性時間・自由運用');break;}}
      if(!flex){warnings.push(`${date} 沒有連續 30 分鐘彈性時間，當天不新增讀書任務。`);continue;}
      let used=0;
      for(let start=Math.ceil(p.dayStart/30)*30;start+30<=p.dayEnd&&used<p.maxStudyMinutes;start+=30){
        if(stamp(date,start)<now)continue;
        const candidates=[...remaining.values()].filter(t=>t.left>0&&(!t.from||date>=t.from)&&t.prerequisites.every(id=>!unique.has(id)||scheduled.has(id))).sort((a,b)=>(a.deadline?Date.parse(a.deadline):Infinity)-(b.deadline?Date.parse(b.deadline):Infinity)||(b.importance||0)-(a.importance||0));
        for(const task of candidates){
          const length=Math.min(60,task.left,p.maxStudyMinutes-used),end=start+length;
          if(end+30>p.dayEnd||task.deadline&&stamp(date,end)>Date.parse(task.deadline))continue;
          const work={start,end},rest={start:end,end:end+30};
          if(busy.some(b=>overlaps(work,b))||busy.some(b=>overlaps(rest,b)&&!(b.type==='rest'&&b.start<=rest.start&&b.end>=rest.end)))continue;
          const e=put('study',start,end,task.title);e.id=`plan-${date}-${start}-${task.id}`;e.taskId=task.id;e.courseId=task.courseId||null;e.conceptId=task.conceptId||null;
          if(!busy.some(b=>b.type==='rest'&&b.start<=rest.start&&b.end>=rest.end))put('rest',rest.start,rest.end,'讀書後休息');
          task.left-=length;used+=length;if(task.left===0)scheduled.add(task.id);start=end+30-30;break;
        }
      }
    }
    const pending=[...remaining.values()].filter(t=>t.left>0).map(t=>({id:t.id,title:t.title,minutes:t.left,reason:t.deadline?'期限前可用時段不足，或先備任務尚未完成':'可用時段不足，或先備任務尚未完成'}));
    events.sort((a,b)=>a.date.localeCompare(b.date)||minutes(a.start)-minutes(b.start));
    return {from,to:addDays(from,days-1),events,pending,warnings};
  }
  function merge(local,remote){
    if(!remote)return validate(local);
    const out=JSON.parse(JSON.stringify(remote));const tombstones=new Set([...(remote.tombstones||[]),...(local.tombstones||[])]);
    for(const kind of ['events','courses']){const rows=new Map(remote[kind].map(x=>[x.id,x]));for(const row of local[kind]){const old=rows.get(row.id);if(old&&!values.equal(old,row)&&old.updatedAt===row.updatedAt)throw Error('行程有同版本衝突');if(!old||(row.updatedAt||0)>=(old.updatedAt||0))rows.set(row.id,row);}out[kind]=[...rows.values()].filter(x=>!tombstones.has(x.id));}
    out.tombstones=[...tombstones];out.prefs=local.prefs;return validate(out);
  }
  const api={dateKey,day,addDays,minutes,time,blank,validate,forDay,priority,matrix,createPlan,merge};scope.BlanktimePlannerCore=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window==='undefined'?globalThis:window);
