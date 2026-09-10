import { createClient } from '@supabase/supabase-js';

const SB_URL=import.meta.env.VITE_SUPABASE_URL;
const SB_ANON=import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase=(SB_URL&&SB_ANON)?createClient(SB_URL,SB_ANON):null;

const HOUR_START=6;
const HOUR_END=24;
let meals=[];
let loading=false;
let renderQueued=false;
let refreshTimer=null;
let lastMealCount='';

const style=document.createElement('style');
style.textContent=`
.meal-expiry-event{outline:1px dashed rgba(76,141,112,.32)}
.meal-expiry-event b:before{content:'⏳ ';font-weight:400}
.meal-expiry-overnight{opacity:.9}
`;
document.head.appendChild(style);

function localDateKey(d){
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}
function fmtTime(d){return d.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'});}
function activeHistoryCutoff(){return new Date(Date.now()-30*24*3600*1000).toISOString();}

function selectedDay(){
  const text=document.querySelector('#selectedPretty')?.textContent?.trim();
  if(text){
    const parsed=new Date(text);
    if(!Number.isNaN(parsed.getTime()))return parsed;
  }
  return new Date();
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

function expiryRowsFor(day){
  const key=localDateKey(day);
  return meals.map(row=>{
    const expiry=new Date(new Date(row.eaten_at).getTime()+24*3600*1000);
    return {...row,expiry};
  }).filter(row=>localDateKey(row.expiry)===key);
}

function makeExpiryEvent(row,overnightIndex){
  const expiry=row.expiry;
  const hpx=innerWidth<=760?50:60;
  const total=(HOUR_END-HOUR_START)*hpx;
  const mins=(expiry.getHours()-HOUR_START)*60+expiry.getMinutes();
  const beforeTimeline=mins<0;
  let top=(mins/60)*hpx;
  if(beforeTimeline)top=2+(overnightIndex*28);
  top=Math.max(0,Math.min(top,total-26));

  const d=document.createElement('div');
  d.className='event body meal-expiry-event'+(beforeTimeline?' meal-expiry-overnight':'');
  d.dataset.mealExpiryId=row.id;
  d.style.top=top+'px';
  d.style.height='26px';

  const mealNumber=Number(row.meal_number);
  const label=mealNumber>=1&&mealNumber<=5?`Meal ${mealNumber}`:'Meal';
  d.innerHTML=`<b>${label} expires</b><div class="event-meta"><span class="event-time">${fmtTime(expiry)}</span></div>`;
  return d;
}

function render(force=false){
  const col=document.querySelector('#daycol');
  if(!col)return;
  const expected=expiryRowsFor(selectedDay());
  const expectedIds=expected.map(x=>String(x.id)).sort();
  const existing=[...col.querySelectorAll('[data-meal-expiry-id]')];
  const existingIds=existing.map(x=>x.dataset.mealExpiryId).sort();
  const layout=(innerWidth<=760?'mobile':'desktop')+':'+localDateKey(selectedDay());

  const same=!force&&col.dataset.mealExpiryLayout===layout&&expectedIds.length===existingIds.length&&expectedIds.every((id,i)=>id===existingIds[i]);
  if(same)return;

  existing.forEach(x=>x.remove());
  let overnightIndex=0;
  expected.forEach(row=>{
    const before=((row.expiry.getHours()-HOUR_START)*60+row.expiry.getMinutes())<0;
    col.appendChild(makeExpiryEvent(row,before?overnightIndex++:0));
  });
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

window.addEventListener('meal-state-changed',scheduleRefresh);
window.addEventListener('resize',()=>queueRender(true));
document.addEventListener('visibilitychange',()=>{if(!document.hidden)loadMeals();});

setTimeout(loadMeals,250);
setInterval(loadMeals,5*60*1000);
