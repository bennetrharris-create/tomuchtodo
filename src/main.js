import './styles.css';
import { createClient } from '@supabase/supabase-js';

const SB_URL = import.meta.env.VITE_SUPABASE_URL;
const SB_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY;
const configured = Boolean(SB_URL && SB_ANON);
const supabase = configured ? createClient(SB_URL, SB_ANON) : null;

const app = document.querySelector('#app');
let session = null;
let selectedDate = new Date();
let calendarEvents = [];
let calendarConnected = false;

const HOUR_START = 6, HOUR_END = 24;
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

function escapeHtml(s=''){return String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));}
function localDateKey(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
function prettyDate(d){return d.toLocaleDateString([],{weekday:'long',month:'long',day:'numeric',year:'numeric'});}
function fmtTime(d){return d.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'});}
function sameDate(a,b){return localDateKey(a)===localDateKey(b);}
function iconFor(c){return {School:'📖',Research:'⚗️',Body:'🏋️',Work:'💼',Money:'💰',Future:'◎',Transit:'🚌',Life:'•'}[c]||'•';}
function categoryFor(title='', calendar=''){
  const s=(title+' '+calendar).toLowerCase();
  if(/chem|bio |biochem|physiology|equation|math|class|lecture|exam|canvas/.test(s)) return 'School';
  if(/du lab|research|hood|zoom meeting/.test(s)) return 'Research';
  if(/meal|gym|quads|hamstring|biceps|triceps|chest|back|shoulder|workout/.test(s)) return 'Body';
  if(/work|buc-ee|buc ee|leave for work|wake up, get ready for work/.test(s)) return 'Work';
  if(/bus|transit/.test(s)) return 'Transit';
  return 'Other';
}

function authHtml(){
  return `<section class="authscreen"><div class="authcard">
    <h1>My Life</h1><p>Your calendar, tasks, meals and progress — synced across your devices.</p>
    ${configured?'':'<div class="config-error"><b>Setup needed.</b> Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in Netlify before this build can sign in.</div>'}
    <div class="field"><label>Email</label><input id="authEmail" type="email" placeholder="you@example.com"></div>
    <div class="field"><label>Password</label><input id="authPassword" type="password" minlength="6" placeholder="At least 6 characters"></div>
    <div class="authactions"><button class="primary" id="signIn">Sign in</button><button class="btn" id="signUp">Create account</button></div>
    <div id="authNotice" class="notice hidden"></div>
  </div></section>`;
}

function dashboardHtml(){
  const name=session?.user?.user_metadata?.display_name || session?.user?.email?.split('@')[0] || 'Bennet';
  return `<div class="shell">
  <aside class="sidebar"><div class="logo">My Life</div><div class="motto">Discipline builds freedom.</div>
    <nav class="nav"><button class="active">⌂ Home</button><button>▦ Calendar</button><button>🎓 School</button><button>⚗ Research</button><button>♢ Body</button><button>▣ Work</button><button>◉ Money</button><button>◎ Future</button><button>□ Notes</button><button>▱ Files</button></nav>
    <div class="profile">${escapeHtml(name)}<br><span style="opacity:.65">${escapeHtml(session.user.email||'')}</span><br><button id="signOut" class="btn" style="margin-top:9px">Sign out</button></div>
  </aside>
  <main class="main">
    <header class="hero"><h1 id="greeting">Good evening, ${escapeHtml(name)}.</h1><p id="todayPretty">${prettyDate(new Date())} · San Marcos, TX</p></header>
    <section class="dash">
      <div class="col1"><div class="card">
        <div class="calendar-top"><div><div class="head" style="margin:0"><h2>▦ Today</h2></div><div id="selectedPretty" class="small"></div></div>
          <div class="date-nav"><button class="btn" id="prevDay">‹</button><button class="btn" id="todayBtn">Today</button><button class="btn" id="nextDay">›</button></div>
        </div>
        <div class="cal-wrap"><div class="times" id="times"></div><div class="daycol" id="daycol"></div></div>
      </div></div>
      <div class="col2">
        <div class="card"><div class="head"><h2><span class="statusdot"></span> Right Now</h2></div>
          <div class="bigstatus" id="statusTitle">Loading…</div><div class="small" id="statusSub"></div>
          <div class="actions" style="margin-top:12px"><button class="primary" id="addTask">+ Add Task</button><button class="btn" id="logMeal">Log Meal</button><button class="btn" id="logWeight">Log Weight</button></div>
        </div>
        <div class="card"><div class="head"><h2>Today's Tasks</h2><button class="btn" id="addTask2">+ Add</button></div><div id="tasks"></div></div>
        <div class="card"><div class="head"><h2>Upcoming</h2></div><div id="upcoming"></div></div>
      </div>
      <div class="col3">
        <div class="card"><div class="head"><h2>Google Calendar</h2></div>
          <div class="connection"><div><strong id="calStatus" class="disconnected">Not connected</strong><div class="small" id="calSub">Connect once; the dashboard will load your live calendars.</div></div><button class="primary" id="connectCalendar">Connect</button></div>
        </div>
        <div class="card"><div class="head"><h2>🍴 Meal Tracker</h2></div><div class="mealcount"><span id="mealCount">0</span> / 5 meals</div><div class="mealdots" id="mealDots"></div><button class="primary" style="width:100%" id="mealButton">Log Meal 1</button><div class="small" style="margin-top:9px">Each meal stays active for 24 hours, so your night-shift days still work correctly.</div></div>
        <div class="card"><div class="head"><h2>Today's Stats</h2></div><div class="statsgrid">
          <div class="stat"><div class="small">Active meals</div><div class="v" id="statMeals">0 / 5</div></div>
          <div class="stat"><div class="small">Latest weight</div><div class="v" id="latestWeight">—</div></div>
          <div class="stat"><div class="small">Events today</div><div class="v" id="eventCount">0</div></div>
          <div class="stat"><div class="small">Tasks left</div><div class="v" id="taskLeft">0</div></div>
        </div></div>
      </div>
    </section>
  </main></div>
  <div class="mobilebar"><button>⌂<br>Home</button><button>▦<br>Calendar</button><button>✓<br>Tasks</button><button>◎<br>More</button></div>

  <div class="modal" id="taskModal"><div class="modalbox"><h3>Add task</h3>
    <div class="field"><label>Task</label><input id="taskTitle" placeholder="e.g. Review biochemistry lecture notes"></div>
    <div class="field"><label>Category</label><select id="taskCategory"><option>School</option><option>Research</option><option>Body</option><option>Work</option><option>Money</option><option>Future</option></select></div>
    <div class="field"><label>Due date</label><input id="taskDue" type="date"></div>
    <div class="modalactions"><button class="btn" id="cancelTask">Cancel</button><button class="primary" id="saveTask">Add task</button></div>
  </div></div>

  <div class="modal" id="weightModal"><div class="modalbox"><h3>Log weight</h3>
    <div class="field"><label>Weight (lb)</label><input id="weightInput" type="number" min="50" max="400" step="0.1" placeholder="170.0"></div>
    <div class="modalactions"><button class="btn" id="cancelWeight">Cancel</button><button class="primary" id="saveWeight">Save</button></div>
  </div></div>`;
}

async function boot(){
  if(!configured){app.innerHTML=authHtml(); wireAuth(); return;}
  try{
    const sessionResult=await Promise.race([
      supabase.auth.getSession(),
      new Promise((_,reject)=>setTimeout(()=>reject(new Error('Session restore timed out')),5000))
    ]);
    if(sessionResult.error) throw sessionResult.error;
    session=sessionResult.data.session;
  }catch(e){
    app.innerHTML=authHtml();
    wireAuth();
    showAuthNotice('Could not restore your session. Try signing in again.',true);
    return;
  }
  if(!session){app.innerHTML=authHtml(); wireAuth(); return;}

  // Make the dashboard interactive immediately. Cloud/calendar data loads in
  // the background so one slow integration cannot freeze the whole app.
  app.innerHTML=dashboardHtml();
  wireDashboard();
  greeting();
  renderTimes();
  renderCalendar();

  loadTasks().catch(console.error);
  loadMeals().catch(console.error);
  loadWeight().catch(console.error);
  loadCalendar().then(renderCalendar).catch(console.error);
}

function wireAuth(){
  if(!configured)return;
  $('#signIn').onclick=async()=>{
    showAuthNotice('Signing in…');
    const email=$('#authEmail').value.trim(), password=$('#authPassword').value;
    const {error}=await supabase.auth.signInWithPassword({email,password});
    if(error)showAuthNotice(error.message,true); else location.reload();
  };
  $('#signUp').onclick=async()=>{
    showAuthNotice('Creating account…');
    const email=$('#authEmail').value.trim(), password=$('#authPassword').value;
    const {data,error}=await supabase.auth.signUp({email,password});
    if(error)showAuthNotice(error.message,true);
    else if(data.session)location.reload();
    else showAuthNotice('Account created. Check your email if confirmation is enabled in Supabase.');
  };
}
function showAuthNotice(msg,bad=false){const n=$('#authNotice');if(!n)return;n.textContent=msg;n.classList.remove('hidden');n.style.background=bad?'#fff0ee':'#eee8df';}

function wireDashboard(){
  $('#signOut').onclick=async()=>{await supabase.auth.signOut();location.reload();};
  $('#prevDay').onclick=()=>{selectedDate.setDate(selectedDate.getDate()-1);renderCalendar();};
  $('#nextDay').onclick=()=>{selectedDate.setDate(selectedDate.getDate()+1);renderCalendar();};
  $('#todayBtn').onclick=()=>{selectedDate=new Date();renderCalendar();};
  $('#addTask').onclick=$('#addTask2').onclick=()=>openTask();
  $('#cancelTask').onclick=()=>$('#taskModal').classList.remove('open');
  $('#saveTask').onclick=saveTask;
  $('#logMeal').onclick=$('#mealButton').onclick=saveMeal;
  $('#logWeight').onclick=()=>{$('#weightModal').classList.add('open');$('#weightInput').focus();};
  $('#cancelWeight').onclick=()=>$('#weightModal').classList.remove('open');
  $('#saveWeight').onclick=saveWeight;
  $('#connectCalendar').onclick=connectCalendar;
  window.addEventListener('resize',()=>{renderTimes();renderCalendar();});
}

function greeting(){
  const h=new Date().getHours(), word=h<12?'Good morning':h<18?'Good afternoon':'Good evening';
  const name=session.user.user_metadata?.display_name || session.user.email?.split('@')[0] || 'Bennet';
  $('#greeting').textContent=`${word}, ${name}.`;
  $('#todayPretty').textContent=`${prettyDate(new Date())} · San Marcos, TX`;
}

async function authedFunction(name, options={}){
  const {data,error}=await supabase.auth.getSession();
  if(error) throw error;
  const token=data.session?.access_token;
  if(!token) throw new Error('Your session expired. Please sign in again.');
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),8000);
  try{
    const headers={...(options.headers||{}),Authorization:`Bearer ${token}`};
    const res=await fetch(`/.netlify/functions/${name}`,{...options,headers,signal:controller.signal});
    const body=await res.json().catch(()=>({}));
    if(!res.ok)throw new Error(body.error||`Function ${name} failed`);
    return body;
  }catch(e){
    if(e.name==='AbortError') throw new Error('Calendar connection timed out');
    throw e;
  }finally{
    clearTimeout(timeout);
  }
}

async function connectCalendar(){
  try{
    $('#connectCalendar').textContent='Opening…';
    const {url}=await authedFunction('google-auth-start');
    location.href=url;
  }catch(e){alert(e.message);$('#connectCalendar').textContent='Connect';}
}

async function loadCalendar(){
  const start=new Date();start.setDate(start.getDate()-7);start.setHours(0,0,0,0);
  const end=new Date();end.setDate(end.getDate()+30);end.setHours(23,59,59,999);
  try{
    const q=`?start=${encodeURIComponent(start.toISOString())}&end=${encodeURIComponent(end.toISOString())}`;
    const data=await authedFunction('calendar-events'+q);
    calendarConnected=true;
    calendarEvents=(data.events||[]).map(e=>({...e,category:categoryFor(e.title,e.calendarName)}));
    $('#calStatus').textContent='Connected';$('#calStatus').className='connected';
    $('#calSub').textContent=`Live · ${data.calendarsChecked||0} calendars`;
    $('#connectCalendar').textContent='Reconnect';
  }catch(e){
    calendarConnected=false;calendarEvents=[];
    $('#calStatus').textContent='Not connected';$('#calStatus').className='disconnected';
    $('#calSub').textContent=e.message.includes('not connected')?'Connect once to load your live schedule.':'Calendar unavailable: '+e.message;
    $('#connectCalendar').textContent='Connect';
  }
}

function eventsForDate(d){const key=localDateKey(d);return calendarEvents.filter(e=>localDateKey(new Date(e.start))===key).sort((a,b)=>new Date(a.start)-new Date(b.start));}
function minsFromStart(d){return((d.getHours()-HOUR_START)*60+d.getMinutes());}
function renderTimes(){
  const el=$('#times');if(!el)return;el.innerHTML='';const hpx=innerWidth<=760?50:60;el.style.height=((HOUR_END-HOUR_START)*hpx)+'px';$('#daycol').style.height=((HOUR_END-HOUR_START)*hpx)+'px';
  for(let h=HOUR_START;h<=HOUR_END;h++){const x=document.createElement('div');x.className='time-label';x.style.top=((h-HOUR_START)*hpx)+'px';x.textContent=h===24?'12 AM':new Date(2000,0,1,h).toLocaleTimeString([],{hour:'numeric'});el.appendChild(x);}
}
function renderCalendar(){
  const col=$('#daycol');if(!col)return;col.innerHTML='';$('#selectedPretty').textContent=prettyDate(selectedDate);
  const hpx=innerWidth<=760?50:60, dayEvents=eventsForDate(selectedDate);$('#eventCount').textContent=dayEvents.length;
  dayEvents.forEach(e=>{
    const s=new Date(e.start),en=new Date(e.end);let top=(minsFromStart(s)/60)*hpx;let height=((en-s)/3600000)*hpx;
    top=Math.max(0,Math.min(top,(HOUR_END-HOUR_START)*hpx-24));height=Math.max(26,Math.min(height,(HOUR_END-HOUR_START)*hpx-top));
    const d=document.createElement('div');d.className='event '+e.category.toLowerCase();d.style.top=top+'px';d.style.height=height+'px';
    d.innerHTML=`<b>${escapeHtml(e.title)}</b><small>${fmtTime(s)} – ${fmtTime(en)}${e.location?' · '+escapeHtml(e.location):''}</small>`;col.appendChild(d);
  });
  const now=new Date();
  if(sameDate(now,selectedDate)&&now.getHours()>=HOUR_START&&now.getHours()<HOUR_END){const y=(minsFromStart(now)/60)*hpx;const line=document.createElement('div');line.className='nowline';line.style.top=y+'px';line.innerHTML='<span class="nowlabel">now</span>';col.appendChild(line);}
  renderRightNow();renderUpcoming();
}
function renderRightNow(){
  const now=new Date(), dayEvents=eventsForDate(selectedDate),title=$('#statusTitle'),sub=$('#statusSub');
  if(!calendarConnected){title.textContent='Connect your calendar';sub.textContent='Then this panel will automatically know what you are doing now and what comes next.';return;}
  if(!sameDate(now,selectedDate)){const first=dayEvents[0];title.textContent=first?first.title:'No events';sub.textContent=first?`First event at ${fmtTime(new Date(first.start))}`:'Nothing scheduled for this day.';return;}
  const current=dayEvents.find(e=>new Date(e.start)<=now&&new Date(e.end)>now),next=dayEvents.find(e=>new Date(e.start)>now);
  if(current){title.textContent=current.title;sub.textContent=`Now · ends ${fmtTime(new Date(current.end))}`;}
  else if(next){const mins=Math.round((new Date(next.start)-now)/60000);title.textContent="You're free";sub.textContent=`Next: ${next.title} · ${fmtTime(new Date(next.start))}${mins<180?' · in '+mins+' min':''}`;}
  else{title.textContent="You're done for today";sub.textContent='No more scheduled events.';}
}
function renderUpcoming(){
  const box=$('#upcoming');if(!box)return;const now=new Date(),future=calendarEvents.filter(e=>new Date(e.start)>now).sort((a,b)=>new Date(a.start)-new Date(b.start)).slice(0,6);box.innerHTML='';
  if(!future.length){box.innerHTML='<div class="small">No upcoming calendar events loaded.</div>';return;}
  future.forEach(e=>{const row=document.createElement('div');row.className='listitem';row.innerHTML=`<div>${iconFor(e.category)}</div><div><b>${escapeHtml(e.title)}</b><div class="small">${new Date(e.start).toLocaleDateString([],{weekday:'short',month:'short',day:'numeric'})} · ${fmtTime(new Date(e.start))}</div></div><span class="badge ${e.category}">${e.category}</span>`;box.appendChild(row);});
}

async function loadTasks(){
  const {data,error}=await supabase.from('tasks').select('*').order('done').order('due_date',{ascending:true,nullsFirst:false}).limit(30);if(error){console.error(error);return;}renderTasks(data||[]);
}
function renderTasks(tasks){
  const box=$('#tasks');box.innerHTML='';tasks.slice(0,8).forEach(t=>{const row=document.createElement('div');row.className='taskrow '+(t.done?'taskdone':'');row.innerHTML=`<input type="checkbox" ${t.done?'checked':''}><div><div class="tasktitle">${escapeHtml(t.title)}</div><div class="small">${t.due_date?'Due '+t.due_date:'No due date'}</div></div><span class="badge ${t.category}">${escapeHtml(t.category)}</span>`;row.querySelector('input').onchange=async ev=>{await supabase.from('tasks').update({done:ev.target.checked}).eq('id',t.id);loadTasks();};box.appendChild(row);});$('#taskLeft').textContent=tasks.filter(t=>!t.done).length;
}
function openTask(){$('#taskDue').value=localDateKey(selectedDate);$('#taskModal').classList.add('open');$('#taskTitle').focus();}
async function saveTask(){
  const title=$('#taskTitle').value.trim();if(!title)return;
  const {error}=await supabase.from('tasks').insert({user_id:session.user.id,title,category:$('#taskCategory').value,due_date:$('#taskDue').value||null});if(error){alert(error.message);return;}
  $('#taskTitle').value='';$('#taskModal').classList.remove('open');loadTasks();
}

async function loadMeals(){
  const cutoff=new Date(Date.now()-24*3600*1000).toISOString();
  const {data,error}=await supabase.from('meals').select('id,eaten_at').gte('eaten_at',cutoff).order('eaten_at');if(error){console.error(error);return;}renderMeals(data||[]);
}
function renderMeals(rows){
  const count=Math.min((rows||[]).length,5);
  $('#mealCount').textContent=count;
  $('#statMeals').textContent=`${count} / 5`;
  $('#mealButton').textContent=count<5?`Log Meal ${count+1}`:'5 / 5 Active';
  $('#mealButton').disabled=count>=5;
  const dots=$('#mealDots');
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
async function saveMeal(){
  const cutoff=new Date(Date.now()-24*3600*1000).toISOString();const {count}=await supabase.from('meals').select('*',{count:'exact',head:true}).gte('eaten_at',cutoff);
  if((count||0)>=5){alert('All five meals are active. The oldest will expire 24 hours after you logged it.');return;}
  const {error}=await supabase.from('meals').insert({user_id:session.user.id});if(error)alert(error.message);else loadMeals();
}

async function loadWeight(){
  const {data,error}=await supabase.from('weights').select('value_lb,measured_at').order('measured_at',{ascending:false}).limit(1);if(error)return;
  $('#latestWeight').textContent=data?.[0]?`${Number(data[0].value_lb).toFixed(1)} lb`:'—';
}
async function saveWeight(){
  const v=parseFloat($('#weightInput').value);if(!v)return;
  const {error}=await supabase.from('weights').insert({user_id:session.user.id,value_lb:v});if(error){alert(error.message);return;}
  $('#weightInput').value='';$('#weightModal').classList.remove('open');loadWeight();
}

// Sign-in and sign-out flows explicitly reload after they finish.
// Avoid an auth-state reload listener here; Supabase may emit SIGNED_IN while
// restoring a session, which can otherwise create an initialization loop.
if('serviceWorker' in navigator)navigator.serviceWorker.register('/sw.js').catch(()=>{});
boot();
