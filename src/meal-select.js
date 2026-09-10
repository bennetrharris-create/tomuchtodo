import { createClient } from '@supabase/supabase-js';

const SB_URL=import.meta.env.VITE_SUPABASE_URL;
const SB_ANON=import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase=(SB_URL&&SB_ANON)?createClient(SB_URL,SB_ANON):null;

let installed=false;
let refreshing=false;

const style=document.createElement('style');
style.textContent=`
.meal-log-select{width:100%;margin:0 0 7px;border:1px solid var(--line);border-radius:9px;background:#fffdf8;color:var(--ink);padding:9px 10px}
.meal-log-select:disabled{opacity:.55;cursor:not-allowed}
.meal-schema-note{font-size:10px;color:#8d4945;background:#fff0ee;border:1px solid #e1bab5;border-radius:8px;padding:7px 8px;margin:7px 0}
`;
document.head.appendChild(style);

function activeCutoff(){return new Date(Date.now()-24*3600*1000).toISOString();}

async function getActiveMeals(){
  if(!supabase)return {rows:[],schemaReady:false};
  const query=await supabase.from('meals')
    .select('id,eaten_at,meal_number')
    .gte('eaten_at',activeCutoff())
    .order('eaten_at',{ascending:true});

  if(query.error){
    const msg=(query.error.message||'').toLowerCase();
    if(msg.includes('meal_number')||query.error.code==='42703')return {rows:[],schemaReady:false};
    console.warn('Could not load numbered meals',query.error);
    return {rows:[],schemaReady:true};
  }
  return {rows:query.data||[],schemaReady:true};
}

function normalizedSlots(rows){
  const used=new Set();
  const normalized=[];
  for(const row of rows){
    let n=Number(row.meal_number);
    if(!(n>=1&&n<=5)||used.has(n)){
      n=[1,2,3,4,5].find(x=>!used.has(x));
    }
    if(n){used.add(n);normalized.push({...row,meal_number:n});}
  }
  return normalized;
}

function render(rows){
  const normalized=normalizedSlots(rows);
  const active=new Set(normalized.map(r=>r.meal_number));
  const count=active.size;
  const select=document.querySelector('#mealSelect');
  const button=document.querySelector('#mealButton');
  const dots=document.querySelector('#mealDots');
  const mealCount=document.querySelector('#mealCount');
  const statMeals=document.querySelector('#statMeals');

  if(mealCount)mealCount.textContent=count;
  if(statMeals)statMeals.textContent=`${count} / 5`;

  if(dots){
    dots.innerHTML='';
    for(let i=1;i<=5;i++){
      const b=document.createElement('button');
      b.type='button';
      b.className='meal '+(active.has(i)?'on':'');
      b.textContent=i;
      b.disabled=true;
      dots.appendChild(b);
    }
  }

  if(select){
    const previous=Number(select.value);
    select.innerHTML='';
    for(let i=1;i<=5;i++){
      const option=document.createElement('option');
      option.value=String(i);
      option.textContent=active.has(i)?`Meal ${i} — active`:`Meal ${i}`;
      option.disabled=active.has(i);
      select.appendChild(option);
    }
    const available=[1,2,3,4,5].filter(i=>!active.has(i));
    select.disabled=!available.length;
    select.value=String(available.includes(previous)?previous:(available[0]||1));
  }

  if(button){
    const selected=Number(select?.value||1);
    button.textContent=count>=5?'5 / 5 Active':`Log Meal ${selected}`;
    button.disabled=count>=5;
  }

  const undo=document.querySelector('#undoMeal');
  if(undo)undo.disabled=count<=0;
}

async function refresh(){
  if(refreshing)return;
  refreshing=true;
  try{
    const {rows,schemaReady}=await getActiveMeals();
    if(!schemaReady){
      document.querySelector('#mealSchemaNote')?.classList.remove('hidden');
      return;
    }
    document.querySelector('#mealSchemaNote')?.classList.add('hidden');
    render(rows);
  }finally{refreshing=false;}
}

async function logSelectedMeal(){
  const select=document.querySelector('#mealSelect');
  if(!select||select.disabled)return;
  const mealNumber=Number(select.value);

  const state=await getActiveMeals();
  if(!state.schemaReady){
    alert('The one-time meal-number database update still needs to be run in Supabase.');
    return;
  }
  const active=new Set(normalizedSlots(state.rows).map(r=>r.meal_number));
  if(active.has(mealNumber)){
    await refresh();
    alert(`Meal ${mealNumber} is already active.`);
    return;
  }

  const {data,error}=await supabase.auth.getSession();
  if(error||!data.session?.user?.id){alert('Please sign in again.');return;}

  const button=document.querySelector('#mealButton');
  if(button){button.disabled=true;button.textContent='Logging…';}
  const result=await supabase.from('meals').insert({user_id:data.session.user.id,meal_number:mealNumber});
  if(result.error){
    alert('Could not log that meal: '+result.error.message);
  }
  await refresh();
  window.dispatchEvent(new CustomEvent('meal-state-changed'));
}

async function install(){
  if(installed)return;
  const button=document.querySelector('#mealButton');
  if(!button)return;

  const state=await getActiveMeals();
  if(!state.schemaReady){
    // Keep the original sequential logger working until the one-time Supabase
    // migration is applied, rather than breaking the existing tracker.
    let note=document.querySelector('#mealSchemaNote');
    if(!note){
      note=document.createElement('div');
      note.id='mealSchemaNote';
      note.className='meal-schema-note';
      note.textContent='Meal-number update pending. Run the new Supabase migration to enable choosing Meal 1–5.';
      button.insertAdjacentElement('beforebegin',note);
    }
    return;
  }

  installed=true;
  const card=button.closest('.card');
  if(card)card.id='mealTrackerCard';

  const select=document.createElement('select');
  select.id='mealSelect';
  select.className='meal-log-select';
  select.setAttribute('aria-label','Choose meal number');
  button.insertAdjacentElement('beforebegin',select);
  select.onchange=()=>{
    if(!button.disabled)button.textContent=`Log Meal ${select.value}`;
  };

  // main.js used direct onclick properties, so replacing these handlers here
  // cleanly changes the behavior without stacking a second log action.
  button.onclick=logSelectedMeal;
  const quick=document.querySelector('#logMeal');
  if(quick)quick.onclick=()=>{
    card?.scrollIntoView({behavior:'smooth',block:'center'});
    setTimeout(()=>select.focus(),350);
  };

  render(state.rows);
  setTimeout(refresh,750);
  setTimeout(refresh,1500);
}

const app=document.querySelector('#app');
if(app){
  new MutationObserver(()=>install()).observe(app,{childList:true,subtree:true});
  install();
}

window.addEventListener('meal-state-changed',refresh);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
