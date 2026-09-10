import { requireUser, createState, env, json } from './_shared/lib.mjs';

export async function handler(event){
  try{
    const {user}=await requireUser(event);
    const state=createState(user.id);
    const params=new URLSearchParams({
      client_id:env('GOOGLE_CLIENT_ID'),
      redirect_uri:env('GOOGLE_REDIRECT_URI'),
      response_type:'code',
      access_type:'offline',
      prompt:'consent',
      include_granted_scopes:'true',
      scope:[
        'openid','email',
        'https://www.googleapis.com/auth/calendar.readonly',
        'https://www.googleapis.com/auth/calendar.calendarlist.readonly'
      ].join(' '),
      state
    });
    return json(200,{url:`https://accounts.google.com/o/oauth2/v2/auth?${params}`});
  }catch(e){return json(e.statusCode||500,{error:e.message});}
}
