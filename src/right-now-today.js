import { createClient } from '@supabase/supabase-js';

const SB_URL=import.meta.env.VITE_SUPABASE_URL;
const SB_ANON=import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase=(SB_URL&&SB_ANON)?createClient(SB_URL,SB_ANON):null;

let todayEvents=[];
let ready=false;
let loading=null;
let renderQueued=false;

function fmtTime(d){return d.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'});}

function todayWindow(){
  const start=new Date();start.setHours(0,0,0,0);
  const end=new Date(start);end.setDate(end.getDate()+1);end.setMilliseconds(-1);
  return {start,end};
}

async function loadTodayEvents(){
  if(!supabase||loading)return loading;
  loading=(async()=>{
    try{
      const {data,error}=await supabase.auth.getSession();
      if(error||!data.session?.access_token)return;
      const {start,end}=todayWindow();
      const q=`?start=${encodeURIComponent(start.toISOString())}&end=${encodeURIComponent(end.toISOString())}`;
      const res=await fetch('/.netlify/functions/calendar-events'+q,{headers:{Authorization:`Bearer ${data.session.access_token}`}});
      if(!res.ok)return;
      const body=await res.json();
      todayEvents=(body.events||[]).slice().sort((a,b)=>new Date(a.start)-new Date(b.start));
      ready=true;
      renderTodayRightNow();
    }catch(e){console.warn('Could not refresh Right Now',e);}
    finally{loading=null;}
  })();
  return loading;
}

function renderTodayRightNow(){
  if(!ready)return;
  const title=document.querySelector('#statusTitle');
  const sub=document.querySelector('#statusSub');
  if(!title||!sub)return;

  const now=new Date();
  const current=todayEvents.find(e=>new Date(e.start)<=now&&new Date(e.end)>now);
  const next=todayEvents.find(e=>new Date(e.start)>now);
  let nextTitle,nextSub;

  if(current){
    nextTitle=current.title;
    nextSub=`Now · ends ${fmtTime(new Date(current.end))}`;
  }else if(next){
    const mins=Math.max(0,Math.round((new Date(next.start)-now)/60000));
    nextTitle="You're free";
    nextSub=`Next: ${next.title} · ${fmtTime(new Date(next.start))}${mins<180?' · in '+mins+' min':''}`;
  }else{
    nextTitle="You're done for today";
    nextSub='No more scheduled events.';
  }

  if(title.textContent!==nextTitle)title.textContent=nextTitle;
  if(sub.textContent!==nextSub)sub.textContent=nextSub;
}

function queueRender(){
  if(renderQueued)return;
  renderQueued=true;
  requestAnimationFrame(()=>{renderQueued=false;renderTodayRightNow();});
}

const app=document.querySelector('#app');
if(app){
  new MutationObserver(queueRender).observe(app,{childList:true,subtree:true,characterData:true});
}

loadTodayEvents();
setInterval(renderTodayRightNow,60000);
setInterval(loadTodayEvents,5*60*1000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)loadTodayEvents();});
