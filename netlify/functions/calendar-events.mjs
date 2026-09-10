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

    // Only read the signed-in account's primary Google Calendar. This deliberately
    // excludes subscribed, shared, school, lab, holiday and secondary calendars.
    const url='https://www.googleapis.com/calendar/v3/calendars/primary/events?'+new URLSearchParams({
      timeMin:start,
      timeMax:end,
      singleEvents:'true',
      orderBy:'startTime',
      maxResults:'2500'
    });
    const data=await gfetch(url,token);

    const events=(data.items||[])
      .filter(x=>x.status!=='cancelled')
      .map(x=>({
        id:`primary:${x.id}`,
        title:x.summary||'(untitled)',
        start:x.start?.dateTime||x.start?.date,
        end:x.end?.dateTime||x.end?.date,
        location:x.location||'',
        description:x.description||'',
        calendarId:'primary',
        calendarName:'Primary',
        htmlLink:x.htmlLink||''
      }))
      .sort((a,b)=>new Date(a.start)-new Date(b.start));

    return json(200,{events,calendarsChecked:1,connectedEmail:conn.google_email});
  }catch(e){
    return json(e.statusCode||500,{error:e.message});
  }
}
