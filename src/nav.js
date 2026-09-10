const appRoot = document.querySelector('#app');

const sectionInfo = {
  School: { icon: '🎓', subtitle: 'Assignments, exams, study tasks and academic deadlines.' },
  Research: { icon: '⚗', subtitle: 'Lab work, experiments, meetings and research priorities.' },
  Body: { icon: '♢', subtitle: 'Meals, weight, workouts and recovery.' },
  Work: { icon: '▣', subtitle: 'Shifts, work tasks and schedule context.' },
  Money: { icon: '◉', subtitle: 'Spending, savings and financial goals.' },
  Future: { icon: '◎', subtitle: 'Internships, applications and long-term career plans.' },
  Notes: { icon: '□', subtitle: 'A home for quick notes and ideas.' },
  Files: { icon: '▱', subtitle: 'A home for important documents and references.' }
};

function ensureStyles(){
  if(document.querySelector('#mylife-nav-styles')) return;
  const style=document.createElement('style');
  style.id='mylife-nav-styles';
  style.textContent=`
    .section-view{max-width:1180px;margin:0 auto;padding:18px 18px 88px}
    .section-hero{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:14px}
    .section-hero h2{margin:0;font:30px Georgia,serif}
    .section-hero p{margin:6px 0 0;color:var(--muted);font-size:13px}
    .section-card{background:var(--paper);border:1px solid var(--line);border-radius:var(--radius);box-shadow:var(--shadow);padding:16px;margin-top:12px}
    .section-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
    .section-empty{padding:22px 4px;color:var(--muted);font-size:13px}
    .section-task{display:grid;grid-template-columns:1fr auto;gap:10px;align-items:center;padding:10px 0;border-bottom:1px solid var(--line)}
    .section-task:last-child{border-bottom:0}
    .section-metric{font-size:28px;font-family:Georgia,serif;margin-top:4px}
    @media(max-width:760px){.section-view{padding:14px 10px 82px}.section-grid{grid-template-columns:1fr}.section-hero h2{font-size:25px}}
  `;
  document.head.appendChild(style);
}

function navButtons(){ return [...document.querySelectorAll('.nav button')]; }
function dashboard(){ return document.querySelector('.dash'); }
function main(){ return document.querySelector('.main'); }

function setActive(label){
  navButtons().forEach(btn=>btn.classList.toggle('active',btn.textContent.includes(label)));
}

function removeSection(){ document.querySelector('.section-view')?.remove(); }

function showHome(){
  removeSection();
  const dash=dashboard(); if(dash) dash.style.display='grid';
  setActive('Home');
  window.scrollTo({top:0,behavior:'smooth'});
}

function openTaskFor(category){
  showHome();
  setTimeout(()=>{
    document.querySelector('#addTask')?.click();
    const select=document.querySelector('#taskCategory');
    if(select && [...select.options].some(o=>o.value===category)) select.value=category;
  },80);
}

function collectTasks(category){
  return [...document.querySelectorAll('#tasks .taskrow')].filter(row=>{
    const badge=row.querySelector('.badge');
    return badge?.textContent?.trim()===category;
  }).map(row=>({
    title:row.querySelector('.tasktitle')?.textContent?.trim()||'Untitled task',
    meta:row.querySelector('.small')?.textContent?.trim()||'',
    done:row.classList.contains('taskdone')
  }));
}

function sectionHtml(label){
  const info=sectionInfo[label]||{icon:'•',subtitle:''};
  const tasks=collectTasks(label);
  let special='';

  if(label==='Body'){
    const meals=document.querySelector('#mealCount')?.textContent||'0';
    const weight=document.querySelector('#latestWeight')?.textContent||'—';
    special=`<div class="section-grid">
      <div class="section-card"><div class="small">Active meals</div><div class="section-metric">${meals} / 5</div><button class="primary section-action" data-action="meal" style="margin-top:10px">Log meal</button></div>
      <div class="section-card"><div class="small">Latest weight</div><div class="section-metric">${weight}</div><button class="btn section-action" data-action="weight" style="margin-top:10px">Log weight</button></div>
    </div>`;
  }

  const taskList=tasks.length?tasks.map(t=>`<div class="section-task"><div><b style="${t.done?'text-decoration:line-through;opacity:.55':''}">${escapeText(t.title)}</b><div class="small">${escapeText(t.meta)}</div></div><span class="badge ${label}">${label}</span></div>`).join(''):`<div class="section-empty">No ${label.toLowerCase()} tasks yet.</div>`;

  const placeholder=(label==='Notes'||label==='Files')?`<div class="section-card"><b>${label} is wired into navigation now.</b><div class="small" style="margin-top:6px">The dedicated ${label.toLowerCase()} data model is the next layer; this section will become the permanent ${label.toLowerCase()} workspace.</div></div>`:'';

  return `<section class="section-view">
    <div class="section-hero"><div><h2>${info.icon} ${label}</h2><p>${info.subtitle}</p></div>${!['Notes','Files'].includes(label)?`<button class="primary section-action" data-action="add" data-category="${label}">+ Add ${label} task</button>`:''}</div>
    ${special}
    ${placeholder}
    ${!['Notes','Files'].includes(label)?`<div class="section-card"><div class="head"><h2>${label} tasks</h2></div>${taskList}</div>`:''}
  </section>`;
}

function escapeText(value=''){
  return String(value).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]));
}

function showSection(label){
  const dash=dashboard(); if(!dash) return;
  removeSection();
  dash.style.display='none';
  setActive(label);
  const wrapper=document.createElement('div');
  wrapper.innerHTML=sectionHtml(label);
  const view=wrapper.firstElementChild;
  main().appendChild(view);
  view.addEventListener('click',e=>{
    const btn=e.target.closest('.section-action'); if(!btn) return;
    const action=btn.dataset.action;
    if(action==='add') openTaskFor(btn.dataset.category);
    if(action==='meal'){showHome();setTimeout(()=>document.querySelector('#mealButton')?.click(),80);}
    if(action==='weight'){showHome();setTimeout(()=>document.querySelector('#logWeight')?.click(),80);}
  });
  window.scrollTo({top:0,behavior:'smooth'});
}

function showCalendar(){
  showHome();
  setActive('Calendar');
  const cal=document.querySelector('.col1 .card');
  if(cal) setTimeout(()=>cal.scrollIntoView({behavior:'smooth',block:'start'}),60);
}

function bind(){
  ensureStyles();
  const nav=document.querySelector('.nav');
  if(!nav || nav.dataset.bound==='1') return;
  nav.dataset.bound='1';
  nav.addEventListener('click',e=>{
    const btn=e.target.closest('button'); if(!btn) return;
    const text=btn.textContent.trim();
    if(text.includes('Home')) return showHome();
    if(text.includes('Calendar')) return showCalendar();
    for(const label of Object.keys(sectionInfo)) if(text.includes(label)) return showSection(label);
  });

  const mobile=document.querySelector('.mobilebar');
  if(mobile && mobile.dataset.bound!=='1'){
    mobile.dataset.bound='1';
    mobile.addEventListener('click',e=>{
      const btn=e.target.closest('button'); if(!btn) return;
      const text=btn.textContent;
      if(text.includes('Home')) showHome();
      else if(text.includes('Calendar')) showCalendar();
      else if(text.includes('Tasks')) showSection('School');
      else if(text.includes('More')) showSection('Future');
    });
  }
}

bind();
const observer=new MutationObserver(()=>bind());
if(appRoot) observer.observe(appRoot,{childList:true,subtree:true});
