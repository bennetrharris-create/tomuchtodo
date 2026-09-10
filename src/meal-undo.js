import { createClient } from '@supabase/supabase-js';

const SB_URL=import.meta.env.VITE_SUPABASE_URL;
const SB_ANON=import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase=(SB_URL&&SB_ANON)?createClient(SB_URL,SB_ANON):null;

let pendingMeal=null;
let syncing=false;

const style=document.createElement('style');
style.textContent=`
.meal-undo-btn{width:100%;margin-top:7px;background:transparent}
.meal-undo-btn:disabled{opacity:.42;cursor:not-allowed}
.meal-undo-note{font-size:10px;color:var(--muted);text-align:center;margin-top:5px}
.meal-undo-modal{position:fixed;inset:0;display:none;place-items:center;padding:20px;background:rgba(25,25,25,.43);z-index:80}
.meal-undo-modal.open{display:grid}
.meal-undo-box{width:min(420px,100%);background:var(--paper);border:1px solid var(--line);border-radius:16px;padding:18px;box-shadow:0 22px 60px rgba(0,0,0,.25)}
.meal-undo-box h3{font:22px Georgia,serif;margin:0 0 8px}
.meal-undo-box p{font-size:13px;color:var(--muted);line-height:1.45;margin:0}
.meal-undo-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:16px}
.meal-undo-confirm{border:1px solid #d7a8a4;background:#fff0ee;color:#8d4945;border-radius:9px;padding:8px 11px}
`;
document.head.appendChild(style);

function activeCutoff(){return new Date(Date.now()-24*3600*1000).toISOString();}

async function getActiveMeals(){
  if(!supabase)return [];
  const {data,error}=await supabase.from('meals')
    .select('id,eaten_at')
    .gte('eaten_at',activeCutoff())
    .order('eaten_at',{ascending:false})
    .limit(5);
  if(error){console.warn('Could not load meals for undo',error);return [];}
  return data||[];
}

function setUndoState(count){
  const btn=document.querySelector('#undoMeal');
  if(btn)btn.disabled=count<=0;
}

function renderMealState(rows){
  const count=Math.min((rows||[]).length,5);
  const mealCount=document.querySelector('#mealCount');
  const statMeals=document.querySelector('#statMeals');
  const mealButton=document.querySelector('#mealButton');
  const dots=document.querySelector('#mealDots');

  if(mealCount)mealCount.textContent=count;
  if(statMeals)statMeals.textContent=`${count} / 5`;
  if(mealButton){
    mealButton.textContent=count<5?`Log Meal ${count+1}`:'5 / 5 Active';
    mealButton.disabled=count>=5;
  }
  if(dots){
    dots.innerHTML='';
    for(let i=1;i<=5;i++){
      const b=document.createElement('button');
      b.type='button';
      b.className='meal '+(i<=count?'on':'');
      b.textContent=i;
      b.disabled=true;
      dots.appendChild(b);
    }
  }
  setUndoState(count);
}

function ensureModal(){
  if(document.querySelector('#mealUndoModal'))return;
  const modal=document.createElement('div');
  modal.id='mealUndoModal';
  modal.className='meal-undo-modal';
  modal.innerHTML=`<div class="meal-undo-box" role="dialog" aria-modal="true" aria-labelledby="mealUndoTitle">
    <h3 id="mealUndoTitle">Undo last meal?</h3>
    <p id="mealUndoText">This will remove your most recently logged active meal.</p>
    <div class="meal-undo-actions">
      <button class="btn" id="cancelMealUndo">Cancel</button>
      <button class="meal-undo-confirm" id="confirmMealUndo">Yes, undo meal</button>
    </div>
  </div>`;
  document.body.appendChild(modal);
  modal.querySelector('#cancelMealUndo').onclick=closeModal;
  modal.querySelector('#confirmMealUndo').onclick=confirmUndo;
  modal.addEventListener('click',e=>{if(e.target===modal)closeModal();});
}

function closeModal(){
  pendingMeal=null;
  document.querySelector('#mealUndoModal')?.classList.remove('open');
}

async function openUndo(){
  const meals=await getActiveMeals();
  renderMealState(meals);
  if(!meals.length)return;
  pendingMeal=meals[0];
  ensureModal();
  const when=new Date(pendingMeal.eaten_at).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'});
  const text=document.querySelector('#mealUndoText');
  if(text)text.textContent=`This will remove the meal you logged most recently at ${when}. Your active meal count will drop by one.`;
  document.querySelector('#mealUndoModal')?.classList.add('open');
}

async function confirmUndo(){
  if(!pendingMeal||syncing)return;
  syncing=true;
  const confirm=document.querySelector('#confirmMealUndo');
  if(confirm){confirm.disabled=true;confirm.textContent='Undoing…';}
  try{
    const {error}=await supabase.from('meals').delete().eq('id',pendingMeal.id);
    if(error)throw error;
    closeModal();
    renderMealState(await getActiveMeals());
  }catch(e){
    alert('Could not undo that meal: '+e.message);
  }finally{
    syncing=false;
    if(confirm){confirm.disabled=false;confirm.textContent='Yes, undo meal';}
  }
}

async function ensureUndoUI(){
  const mealButton=document.querySelector('#mealButton');
  if(!mealButton||document.querySelector('#undoMeal'))return;
  const btn=document.createElement('button');
  btn.id='undoMeal';
  btn.type='button';
  btn.className='btn meal-undo-btn';
  btn.textContent='↶ Undo last meal';
  btn.disabled=true;
  btn.onclick=openUndo;
  mealButton.insertAdjacentElement('afterend',btn);

  const note=document.createElement('div');
  note.className='meal-undo-note';
  note.textContent='Undo always asks for confirmation.';
  btn.insertAdjacentElement('afterend',note);

  renderMealState(await getActiveMeals());
}

const app=document.querySelector('#app');
if(app){
  new MutationObserver(()=>ensureUndoUI()).observe(app,{childList:true,subtree:true});
  ensureUndoUI();
}

document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal();});
