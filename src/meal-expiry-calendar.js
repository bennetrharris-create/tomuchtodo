import { createClient } from '@supabase/supabase-js';

const SB_URL=import.meta.env.VITE_SUPABASE_URL;
const SB_ANON=import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase=(SB_URL&&SB_ANON)?createClient(SB_URL,SB_ANON):null;

const WINDOW_HOURS=24;
const DESKTOP_HOUR_PX=28;
const MOBILE_HOUR_PX=24;
let meals=[];
let loading=false;
let renderQueued=false;
let refreshTimer=null;
let lastMealCount='';

const style=document.createElement('style');
style.textContent=`
.meal-expiry-event{outline:1px dashed rgba(76,141,112,.32)}
.meal-expiry-event b:before{content:'⏳ ';font-weight:400}
`;
document.head.appendChild(style);

function localDateKey(d){
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}
function sameDate(a,b){return localDateKey(a)===localDateKey(b);}
function fmtTime(d){return d.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'});}
function activeHistoryCutoff(){return new Date(Date.now()-30*24*3600*1000).toISOString();}
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

async function loadMeals(){
  if(!supabase||loading)return;
  loading=true;
  try{
    let result=await supabase.from('meals')
      .select('id,eaten_at,meal_number')
      .gte('eaten_at',activeHistoryCutoff())
      .order('eaten_at',{ascending:true});

    if(result.error&&((result.error.message||'').toLowerCase().includes('meal_number')||result.error.code==='42703')){
      result=await supabase.from('meals')
        .select('id,eaten_at')
        .gte('eaten_at',activeHistoryCutoff())
        .order('eaten_at',{ascending:true});
    }
    if(result.error)throw result.error;
    meals=result.data||[];
    queueRender(true);
  }catch(e){
    console.warn('Could not load meal expiry reminders',e);
  }finally{
    loading=false;
  }
}

function expiryRowsForWindow(day){
  const {start,end}=timelineWindow(day);
  return meals.map(row=>{
    const expiry=new Date(new Date(row.eaten_at).getTime()+24*3600*1000);
    return {...row,expiry};
  }).filter(row=>row.expiry>=start&&row.expiry<end);
}

function makeExpiryEvent(row,start){
  const expiry=row.expiry;
  const hpx=hourPx();
  const total=WINDOW_HOURS*hpx;
  let top=((expiry-start)/3600000)*hpx;
  top=Math.max(0,Math.min(top,total-20));

  const d=document.createElement('div');
  d.className='event body meal-expiry-event';
  d.dataset.mealExpiryId=row.id;
  d.style.top=top+'px';
  d.style.height='20px';

  const mealNumber=Number(row.meal_number);
  const label=mealNumber>=1&&mealNumber<=5?`Meal ${mealNumber}`:'Meal';
  d.innerHTML=`<b>${label} expires</b><div class="event-meta"><span class="event-time">${fmtTime(expiry)}</span></div>`;
  return d;
}

function render(force=false){
  const col=document.querySelector('#daycol');
  if(!col||!col.querySelector('.timeline-gridline'))return;
  const day=selectedDay();
  const {start}=timelineWindow(day);
  const expected=expiryRowsForWindow(day);
  const expectedIds=expected.map(x=>String(x.id)).sort();
  const existing=[...col.querySelectorAll('[data-meal-expiry-id]')];
  const existingIds=existing.map(x=>x.dataset.mealExpiryId).sort();
  const layout=(innerWidth<=760?'mobile':'desktop')+':'+localDateKey(day)+':'+Math.floor(start.getTime()/60000);

  const same=!force&&col.dataset.mealExpiryLayout===layout&&expectedIds.length===existingIds.length&&expectedIds.every((id,i)=>id===existingIds[i]);
  if(same)return;

  existing.forEach(x=>x.remove());
  expected.forEach(row=>col.appendChild(makeExpiryEvent(row,start)));
  col.dataset.mealExpiryLayout=layout;
}

function queueRender(force=false){
  if(renderQueued&&!force)return;
  renderQueued=true;
  requestAnimationFrame(()=>{
    renderQueued=false;
    render(force);
  });
}

function scheduleRefresh(){
  clearTimeout(refreshTimer);
  refreshTimer=setTimeout(loadMeals,120);
}

const app=document.querySelector('#app');
if(app){
  new MutationObserver(()=>{
    queueRender();
    const count=document.querySelector('#mealCount')?.textContent||'';
    if(count!==lastMealCount){
      lastMealCount=count;
      scheduleRefresh();
    }
  }).observe(app,{childList:true,subtree:true,characterData:true});
}

window.addEventListener('calendar-24h-rendered',()=>queueRender(true));
window.addEventListener('meal-state-changed',scheduleRefresh);
window.addEventListener('resize',()=>queueRender(true));
document.addEventListener('visibilitychange',()=>{if(!document.hidden)loadMeals();});

setTimeout(loadMeals,250);
setInterval(loadMeals,5*60*1000);
