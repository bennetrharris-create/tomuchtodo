const style=document.createElement('style');
style.textContent=`
.event .event-meta{min-width:0;text-align:right;display:flex;flex-direction:column;align-items:flex-end;justify-content:center;line-height:1.05}
.event .event-time{font-size:9.5px;opacity:.76;white-space:nowrap}
.event .event-location{font-size:8.5px;opacity:.58;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%;margin-top:2px}
@media(max-width:760px){.event .event-time{font-size:9px}.event .event-location{font-size:8px;margin-top:1px}}
`;
document.head.appendChild(style);

function formatCalendarEvent(el){
  if(!(el instanceof Element)||!el.matches('.event')||el.dataset.metaFormatted==='1') return;
  const old=el.querySelector(':scope > small');
  if(!old) return;
  const raw=(old.textContent||'').trim();
  const marker=' · ';
  const cut=raw.indexOf(marker);
  const time=cut>=0?raw.slice(0,cut):raw;
  const location=cut>=0?raw.slice(cut+marker.length):'';

  const meta=document.createElement('div');
  meta.className='event-meta';
  const timeEl=document.createElement('span');
  timeEl.className='event-time';
  timeEl.textContent=time;
  meta.appendChild(timeEl);

  if(location){
    const locationEl=document.createElement('span');
    locationEl.className='event-location';
    locationEl.textContent=location;
    locationEl.title=location;
    meta.appendChild(locationEl);
  }

  old.replaceWith(meta);
  el.dataset.metaFormatted='1';
}

function scan(node){
  if(!(node instanceof Element)) return;
  if(node.matches('.event')) formatCalendarEvent(node);
  node.querySelectorAll?.('.event').forEach(formatCalendarEvent);
}

const app=document.querySelector('#app');
if(app){
  scan(app);
  new MutationObserver(records=>{
    for(const record of records){
      for(const node of record.addedNodes) scan(node);
    }
  }).observe(app,{childList:true,subtree:true});
}
