import { createClient } from '@supabase/supabase-js';

const SB_URL=import.meta.env.VITE_SUPABASE_URL;
const SB_ANON=import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase=(SB_URL&&SB_ANON)?createClient(SB_URL,SB_ANON):null;

let allWeights=[];
let range='30D';
let loading=false;
let loadQueued=false;
let lastHost=null;

const style=document.createElement('style');
style.id='weight-history-styles';
style.textContent=`
.weight-chart-card{min-width:0}
.weight-chart-wrap{margin-top:14px;padding-top:12px;border-top:1px solid var(--line)}
.weight-chart-top{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:8px}
.weight-chart-title{font-size:12px;font-weight:720}
.weight-ranges{display:flex;gap:4px;flex-wrap:wrap}
.weight-range-btn{border:1px solid var(--line);background:#fbf9f4;color:var(--muted);border-radius:7px;padding:4px 7px;font-size:10px;line-height:1}
.weight-range-btn.active{background:var(--deep);border-color:var(--deep);color:#fff}
.weight-chart-area{width:100%;min-height:174px;position:relative}
.weight-chart-svg{display:block;width:100%;height:auto;overflow:visible}
.weight-grid{stroke:rgba(120,115,105,.14);stroke-width:1}
.weight-axis-label{fill:var(--muted);font-size:10px;font-family:Inter,ui-sans-serif,system-ui,sans-serif}
.weight-line{fill:none;stroke:var(--accent);stroke-width:2.5;stroke-linejoin:round;stroke-linecap:round}
.weight-dot{fill:var(--paper);stroke:var(--accent);stroke-width:2;cursor:pointer}
.weight-dot.selected{fill:var(--accent);stroke-width:2.5}
.weight-chart-detail{min-height:18px;margin-top:5px;color:var(--muted);font-size:10.5px;text-align:center}
.weight-chart-empty{display:grid;place-items:center;min-height:150px;text-align:center;color:var(--muted);font-size:12px;border:1px dashed var(--line);border-radius:10px;padding:18px}
.weight-chart-loading{opacity:.65}
@media(max-width:760px){.weight-chart-area{min-height:160px}.weight-chart-top{align-items:flex-start}.weight-range-btn{padding:6px 8px;font-size:10px}}
`;
document.head.appendChild(style);

function bodySection(){
  return [...document.querySelectorAll('.section-view')].find(view=>view.querySelector('.section-hero h2')?.textContent?.includes('Body'))||null;
}

function latestWeightCard(section){
  return [...section.querySelectorAll('.section-card')].find(card=>
    [...card.querySelectorAll(':scope > .small')].some(el=>el.textContent.trim()==='Latest weight')
  )||null;
}

function fmtWeight(v){return `${Number(v).toFixed(1)} lb`;}
function fmtPointDate(d){return d.toLocaleDateString([],{month:'short',day:'numeric'});}
function fmtDetailDate(d){return d.toLocaleString([],{month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'});}

function filteredRows(){
  if(range==='ALL')return allWeights;
  const days=range==='7D'?7:range==='90D'?90:30;
  const cutoff=Date.now()-days*24*3600*1000;
  return allWeights.filter(row=>new Date(row.measured_at).getTime()>=cutoff);
}

function updateLatestMetric(card){
  const metric=card?.querySelector('.section-metric');
  if(!metric)return;
  const latest=allWeights.at(-1);
  metric.textContent=latest?fmtWeight(latest.value_lb):'—';
}

function axisNumber(v){
  const rounded=Math.round(v*10)/10;
  return Number.isInteger(rounded)?String(rounded):rounded.toFixed(1);
}

function renderGraph(host){
  const card=host.closest('.section-card');
  updateLatestMetric(card);
  const rows=filteredRows();
  const activeButtons=host.querySelectorAll('.weight-range-btn');
  activeButtons.forEach(btn=>btn.classList.toggle('active',btn.dataset.range===range));

  const area=host.querySelector('.weight-chart-area');
  const detail=host.querySelector('.weight-chart-detail');
  if(!area||!detail)return;

  if(!rows.length){
    area.innerHTML='<div class="weight-chart-empty">No logged weights in this range yet.</div>';
    detail.textContent='';
    return;
  }

  const W=520,H=180;
  const pad={l:42,r:12,t:12,b:32};
  const innerW=W-pad.l-pad.r;
  const innerH=H-pad.t-pad.b;
  const times=rows.map(r=>new Date(r.measured_at).getTime());
  const vals=rows.map(r=>Number(r.value_lb)).filter(Number.isFinite);
  if(!vals.length){
    area.innerHTML='<div class="weight-chart-empty">No valid weight entries to graph yet.</div>';
    detail.textContent='';
    return;
  }

  let xMin=Math.min(...times),xMax=Math.max(...times);
  if(xMin===xMax){xMin-=12*3600000;xMax+=12*3600000;}
  let rawMin=Math.min(...vals),rawMax=Math.max(...vals);
  const spread=Math.max(rawMax-rawMin,1);
  let yMin=Math.floor((rawMin-spread*.18)*2)/2;
  let yMax=Math.ceil((rawMax+spread*.18)*2)/2;
  if(yMax-yMin<2){const mid=(yMax+yMin)/2;yMin=mid-1;yMax=mid+1;}

  const x=t=>pad.l+((t-xMin)/(xMax-xMin))*innerW;
  const y=v=>pad.t+(1-(v-yMin)/(yMax-yMin))*innerH;

  const grid=[];
  for(let i=0;i<=4;i++){
    const value=yMax-(i/4)*(yMax-yMin);
    const yy=pad.t+(i/4)*innerH;
    grid.push(`<line class="weight-grid" x1="${pad.l}" y1="${yy}" x2="${W-pad.r}" y2="${yy}"></line>`);
    grid.push(`<text class="weight-axis-label" x="${pad.l-7}" y="${yy+3}" text-anchor="end">${axisNumber(value)}</text>`);
  }

  const points=rows.map(row=>{
    const t=new Date(row.measured_at).getTime();
    const v=Number(row.value_lb);
    return {row,cx:x(t),cy:y(v)};
  }).filter(p=>Number.isFinite(p.cx)&&Number.isFinite(p.cy));

  const poly=points.map(p=>`${p.cx.toFixed(2)},${p.cy.toFixed(2)}`).join(' ');
  const dots=points.map((p,i)=>`<circle class="weight-dot${i===points.length-1?' selected':''}" data-weight-id="${p.row.id}" cx="${p.cx.toFixed(2)}" cy="${p.cy.toFixed(2)}" r="4.5" tabindex="0" role="button" aria-label="${fmtWeight(p.row.value_lb)} on ${fmtDetailDate(new Date(p.row.measured_at))}"></circle>`).join('');

  const firstDate=new Date(rows[0].measured_at);
  const lastDate=new Date(rows.at(-1).measured_at);
  area.innerHTML=`<svg class="weight-chart-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Weight over time line graph">
    ${grid.join('')}
    ${points.length>1?`<polyline class="weight-line" points="${poly}"></polyline>`:''}
    ${dots}
    <text class="weight-axis-label" x="${pad.l}" y="${H-9}" text-anchor="start">${fmtPointDate(firstDate)}</text>
    <text class="weight-axis-label" x="${W-pad.r}" y="${H-9}" text-anchor="end">${fmtPointDate(lastDate)}</text>
    <text class="weight-axis-label" x="${pad.l+innerW/2}" y="${H-9}" text-anchor="middle">Time</text>
  </svg>`;

  function selectPoint(id){
    area.querySelectorAll('.weight-dot').forEach(dot=>dot.classList.toggle('selected',dot.dataset.weightId===id));
    const row=rows.find(r=>String(r.id)===String(id));
    if(row)detail.textContent=`${fmtWeight(row.value_lb)} · ${fmtDetailDate(new Date(row.measured_at))}`;
  }

  area.querySelectorAll('.weight-dot').forEach(dot=>{
    dot.addEventListener('click',()=>selectPoint(dot.dataset.weightId));
    dot.addEventListener('focus',()=>selectPoint(dot.dataset.weightId));
    dot.addEventListener('keydown',e=>{
      if(e.key==='Enter'||e.key===' '){e.preventDefault();selectPoint(dot.dataset.weightId);}
    });
  });

  selectPoint(String(rows.at(-1).id));
}

function makeHost(card){
  const host=document.createElement('div');
  host.className='weight-chart-wrap';
  host.dataset.weightChart='1';
  host.innerHTML=`
    <div class="weight-chart-top">
      <div class="weight-chart-title">Weight over time</div>
      <div class="weight-ranges" role="group" aria-label="Weight graph range">
        <button class="weight-range-btn" type="button" data-range="7D">7D</button>
        <button class="weight-range-btn active" type="button" data-range="30D">30D</button>
        <button class="weight-range-btn" type="button" data-range="90D">90D</button>
        <button class="weight-range-btn" type="button" data-range="ALL">All</button>
      </div>
    </div>
    <div class="weight-chart-area"><div class="weight-chart-empty weight-chart-loading">Loading weight history…</div></div>
    <div class="weight-chart-detail" aria-live="polite"></div>`;

  const logButton=card.querySelector('[data-action="weight"]');
  if(logButton)card.insertBefore(host,logButton);
  else card.appendChild(host);

  host.addEventListener('click',e=>{
    const btn=e.target.closest('.weight-range-btn');
    if(!btn)return;
    range=btn.dataset.range;
    renderGraph(host);
  });
  return host;
}

async function loadWeights(host){
  if(!supabase||loading)return;
  loading=true;
  try{
    const {data,error}=await supabase.from('weights')
      .select('id,value_lb,measured_at')
      .order('measured_at',{ascending:true})
      .limit(1000);
    if(error)throw error;
    allWeights=(data||[]).filter(r=>Number.isFinite(Number(r.value_lb))&&!Number.isNaN(new Date(r.measured_at).getTime()));
    if(host?.isConnected)renderGraph(host);
  }catch(e){
    console.warn('Could not load weight history',e);
    const area=host?.querySelector('.weight-chart-area');
    if(area)area.innerHTML='<div class="weight-chart-empty">Could not load weight history right now.</div>';
  }finally{
    loading=false;
  }
}

function ensureChart(){
  const section=bodySection();
  if(!section)return;
  const card=latestWeightCard(section);
  if(!card)return;
  card.classList.add('weight-chart-card');
  let host=card.querySelector('[data-weight-chart="1"]');
  if(!host)host=makeHost(card);
  if(host!==lastHost){
    lastHost=host;
    loadWeights(host);
  }else if(allWeights.length){
    renderGraph(host);
  }
}

function queueEnsure(){
  if(loadQueued)return;
  loadQueued=true;
  requestAnimationFrame(()=>{loadQueued=false;ensureChart();});
}

const app=document.querySelector('#app');
if(app){
  new MutationObserver(queueEnsure).observe(app,{childList:true,subtree:true,characterData:true});
  queueEnsure();
}

document.addEventListener('visibilitychange',()=>{
  if(!document.hidden&&lastHost?.isConnected)loadWeights(lastHost);
});
setInterval(()=>{if(lastHost?.isConnected)loadWeights(lastHost);},5*60*1000);
