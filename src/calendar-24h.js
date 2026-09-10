import { createClient } from '@supabase/supabase-js';

const SB_URL=import.meta.env.VITE_SUPABASE_URL;
const SB_ANON=import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase=(SB_URL&&SB_ANON)?createClient(SB_URL,SB_ANON):null;

const WINDOW_HOURS=24;
const DESKTOP_HOUR_PX=28;
const MOBILE_HOUR_PX=24;
let sourceEvents=[];
let sourceKey='';
let fetchVersion=0;
let boundPretty=null;
let boundDaycol=null;
let prettyObserver=null;
let daycolObserver=null;
let renderQueued=false;
let lastPretty='';

const style=document.createElement('style');
style.textContent=`
#daycol.calendar-24h{background:none!important}
#daycol.calendar-24h .timeline-gridline{position:absolute;left:0;right:0;height:1px;background:rgba(120,115,105,.11);z-index:1;pointer-events:none}
#daycol.calendar-24h .timeline-gridline.midnight{background:rgba(120,115,105,.25)}
#daycol.calendar-24h .event{padding:2px 8px;min-height:0}
#daycol.calendar-24h .event b{font-size:11px;line-height:1.1}
#daycol.calendar-24h .event small{font-size:8.5px}
#times .time-label.timeline-start{font-weight:700;color:var(--ink)}
#times .time-label.timeline-midnight{font-weight:650;color:var(--ink)}
#times .time-label{font-size:10px}
@media(max-width:760px){#daycol.calendar-24h .event{padding:2px 6px}#daycol.calendar-24h .event b{font-size:10.5px}#times .time-label{font-size:9px}}
`;
document.head.appendChild(style);

function localDateKey(d){
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}
function sameDate(a,b){return localDateKey(a)===localDateKey(b);}
function fmtTime(d){return d.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'});}
function fmtHour(d){return d.toLocaleTimeString([],{hour:'numeric'});}
function escapeHtml(s=''){return String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#039;'}[m]));}
function categoryFor(title='',calendar=''){
  const s=(title+' '+calendar).toLowerCase();
  if(/chem|bio |biochem|physiology|equation|math|class|lecture|exam|canvas/.test(s))return 'School';
  if(/du lab|research|hood|zoom meeting/.test(s))return 'Research';
  if(/meal|gym|quads|hamstring|biceps|triceps|chest|back|shoulder|workout/.test(s))return 'Body';
  if(/work|buc-ee|buc ee|leave for work|wake up, get ready for work/.test(s))return 'Work';
  if(/bus|transit/.test(s))return 'Transit';
  return 'Other';
}
function hourPx(){return innerWidth<=760?MOBILE_HOUR_PX:DESKTOP_HOUR_PX;}
function selectedDay(){
  const text=document.querySelector('#selectedPretty')?.textContent?.trim();
  if(text){
    const parsed=new Date(text);
    if(!Number.isNaN(parsed.getTime()))return parsed;
  }
  return new Date();
}
function timelineWindow(day=selectedDay()){
  const now=new Date();
  let start;
  if(sameDate(day,now)){
    start=new Date(now);
  }else{
    start=new Date(day);
    start.setHours(0,0,0,0);
  }
  return {start,end:new Date(start.getTime()+WINDOW_HOURS*3600000)};
}
function sourceRange(day){
  const now=new Date();
  const start=new Date(day);start.setHours(0,0,0,0);
  const end=new Date(start);
  end.setDate(end.getDate()+(sameDate(day,now)?2:1));
  return {start,end};
}
function sourceRangeKey(day){return localDateKey(day)+(sameDate(day,new Date())?':rolling':':day');}

async function fetchEvents(day){
  if(!supabase)return;
  const version=++fetchVersion;
  const key=sourceRangeKey(day);
  sourceKey=key;
  try{
    const {data,error}=await supabase.auth.getSession();
    if(error||!data.session?.access_token)return;
    const {start,end}=sourceRange(day);
    const q=`?start=${encodeURIComponent(start.toISOString())}&end=${encodeURIComponent(end.toISOString())}`;
    const res=await fetch('/.netlify/functions/calendar-events'+q,{headers:{Authorization:`Bearer ${data.session.access_token}`}});
    if(!res.ok)return;
    const body=await res.json();
    if(version!==fetchVersion||sourceKey!==key)return;
    sourceEvents=(body.events||[]).map(e=>({...e,category:categoryFor(e.title,e.calendarName)}));
    render();
  }catch(e){
    console.warn('Could not load rolling 24-hour calendar',e);
  }
}

function addTimeLabel(times,date,top,{start=false,midnight=false}={}){
  if(start&&sameDate(selectedDay(),new Date()))return;
  const label=document.createElement('div');
  label.className='time-label'+(start?' timeline-start':'')+(midnight?' timeline-midnight':'');
  label.style.top=top+'px';
  if(start){
    label.textContent=fmtHour(date);
  }else if(midnight){
    label.textContent=`12 AM · ${date.toLocaleDateString([],{weekday:'short'})}`;
  }else{
    label.textContent=fmtHour(date);
  }
  times.appendChild(label);
}

function addGridline(col,top,midnight=false){
  const line=document.createElement('div');
  line.className='timeline-gridline'+(midnight?' midnight':'');
  line.style.top=top+'px';
  col.appendChild(line);
}

function render(){
  const times=document.querySelector('#times');
  const col=document.querySelector('#daycol');
  if(!times||!col)return;

  const day=selectedDay();
  const {start,end}=timelineWindow(day);
  const hpx=hourPx();
  const total=WINDOW_HOURS*hpx;

  times.innerHTML='';
  col.innerHTML='';
  times.style.height=total+'px';
  col.style.height=total+'px';
  col.classList.add('calendar-24h');

  addTimeLabel(times,start,0,{start:true});
  addGridline(col,0,false);

  const cursor=new Date(start);
  cursor.setMinutes(0,0,0);
  if(cursor<=start)cursor.setHours(cursor.getHours()+1);
  while(cursor<end){
    const top=((cursor-start)/3600000)*hpx;
    const midnight=cursor.getHours()===0;
    addTimeLabel(times,cursor,top,{midnight});
    addGridline(col,top,midnight);
    cursor.setHours(cursor.getHours()+1);
  }

  const visible=sourceEvents.filter(e=>{
    const s=new Date(e.start),en=new Date(e.end);
    return en>start&&s<end;
  }).sort((a,b)=>new Date(a.start)-new Date(b.start));

  const count=document.querySelector('#eventCount');
  if(count)count.textContent=visible.length;

  visible.forEach(e=>{
    const s=new Date(e.start),en=new Date(e.end);
    const visibleStart=s<start?start:s;
    const visibleEnd=en>end?end:en;
    let top=((visibleStart-start)/3600000)*hpx;
    let height=((visibleEnd-visibleStart)/3600000)*hpx;
    top=Math.max(0,Math.min(top,total-18));
    height=Math.max(18,Math.min(height,total-top));

    const d=document.createElement('div');
    d.className='event '+String(e.category||'Other').toLowerCase();
    d.dataset.calendar24hEvent='1';
    d.style.top=top+'px';
    d.style.height=height+'px';
    d.innerHTML=`<b>${escapeHtml(e.title)}</b><small>${fmtTime(s)} – ${fmtTime(en)}${e.location?' · '+escapeHtml(e.location):''}</small>`;
    col.appendChild(d);
  });

  if(sameDate(day,new Date())){
    const line=document.createElement('div');
    line.className='nowline';
    line.style.top='0px';
    line.innerHTML='<span class="nowlabel">now</span>';
    col.appendChild(line);
  }

  col.dataset.calendar24h='1';
  window.dispatchEvent(new CustomEvent('calendar-24h-rendered',{detail:{start:start.toISOString(),end:end.toISOString(),hourPx:hpx}}));
}

function scheduleRender(){
  if(renderQueued)return;
  renderQueued=true;
  requestAnimationFrame(()=>{renderQueued=false;render();});
}

function refreshSelected(){
  const day=selectedDay();
  sourceEvents=[];
  sourceKey=sourceRangeKey(day);
  render();
  fetchEvents(day);
}

function bindCalendar(){
  const pretty=document.querySelector('#selectedPretty');
  const col=document.querySelector('#daycol');
  if(!pretty||!col)return false;

  if(pretty!==boundPretty){
    prettyObserver?.disconnect();
    boundPretty=pretty;
    lastPretty=pretty.textContent.trim();
    prettyObserver=new MutationObserver(()=>{
      const next=pretty.textContent.trim();
      if(next!==lastPretty){lastPretty=next;refreshSelected();}
    });
    prettyObserver.observe(pretty,{childList:true,subtree:true,characterData:true});
  }

  if(col!==boundDaycol){
    daycolObserver?.disconnect();
    boundDaycol=col;
    daycolObserver=new MutationObserver(()=>{
      if(!col.querySelector('.timeline-gridline'))scheduleRender();
    });
    daycolObserver.observe(col,{childList:true});
  }
  return true;
}

const app=document.querySelector('#app');
if(app){
  const appObserver=new MutationObserver(()=>{
    if(bindCalendar()&&!document.querySelector('#daycol .timeline-gridline'))refreshSelected();
  });
  appObserver.observe(app,{childList:true,subtree:true});
  if(bindCalendar())refreshSelected();
}

window.addEventListener('resize',scheduleRender);
window.addEventListener('meal-state-changed',scheduleRender);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshSelected();});
setInterval(()=>{
  const day=selectedDay();
  if(sameDate(day,new Date()))render();
},60000);
setInterval(()=>fetchEvents(selectedDay()),5*60*1000);
