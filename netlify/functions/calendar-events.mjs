import { requireUser, decrypt, refreshGoogleAccessToken, json } from './_shared/lib.mjs';

async function gfetch(url,token){
  const r=await fetch(url,{headers:{Authorization:`Bearer ${token}`}});
  const data=await r.json();
  if(!r.ok) throw new Error(data?.error?.message||'Google Calendar API request failed');
  return data;
}

export async function handler(event){
  try{
    const {user,sb}=await requireUser(event);
    const {data:conn,error}=await sb.from('google_connections').select('*').eq('user_id',user.id).maybeSingle();
    if(error)throw error;
    if(!conn) return json(409,{error:'Google Calendar is not connected'});
    const refreshToken=decrypt(conn.encrypted_refresh_token);
    const token=await refreshGoogleAccessToken(refreshToken);

    const start=event.queryStringParameters?.start || new Date(Date.now()-7*86400000).toISOString();
    const end=event.queryStringParameters?.end || new Date(Date.now()+30*86400000).toISOString();

    const list=await gfetch('https://www.googleapis.com/calendar/v3/users/me/calendarList?minAccessRole=reader&maxResults=250',token);
    const calendars=(list.items||[]).filter(c=>{
      const text=((c.summary||'')+' '+(c.id||'')).toLowerCase();
      return !text.includes('holiday') && c.deleted!==true;
    });

    const groups=await Promise.all(calendars.map(async cal=>{
      const url='https://www.googleapis.com/calendar/v3/calendars/'+encodeURIComponent(cal.id)+'/events?'+new URLSearchParams({
        timeMin:start,timeMax:end,singleEvents:'true',orderBy:'startTime',maxResults:'2500'
      });
      try{
        const data=await gfetch(url,token);
        return (data.items||[]).filter(x=>x.status!=='cancelled').map(x=>({
          id:`${cal.id}:${x.id}`,
          title:x.summary||'(untitled)',
          start:x.start?.dateTime||x.start?.date,
          end:x.end?.dateTime||x.end?.date,
          location:x.location||'',
          description:x.description||'',
          calendarId:cal.id,
          calendarName:cal.summary||cal.id,
          htmlLink:x.htmlLink||''
        }));
      }catch(e){
        console.warn('Skipping calendar',cal.summary,e.message);
        return [];
      }
    }));
    const events=groups.flat().sort((a,b)=>new Date(a.start)-new Date(b.start));
    return json(200,{events,calendarsChecked:calendars.length,connectedEmail:conn.google_email});
  }catch(e){return json(e.statusCode||500,{error:e.message});}
}
