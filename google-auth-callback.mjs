import { verifyState, env, serviceSupabase, encrypt } from './_shared/lib.mjs';

export async function handler(event){
  const site=env('SITE_URL').replace(/\/$/,'');
  try{
    if(event.queryStringParameters?.error) throw new Error(`Google authorization failed: ${event.queryStringParameters.error}`);
    const code=event.queryStringParameters?.code,state=event.queryStringParameters?.state;
    if(!code||!state) throw new Error('Missing OAuth code or state');
    const {userId}=verifyState(state);
    const tokenBody=new URLSearchParams({
      code,
      client_id:env('GOOGLE_CLIENT_ID'),
      client_secret:env('GOOGLE_CLIENT_SECRET'),
      redirect_uri:env('GOOGLE_REDIRECT_URI'),
      grant_type:'authorization_code'
    });
    const tokenRes=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:tokenBody});
    const tokens=await tokenRes.json();
    if(!tokenRes.ok) throw new Error(tokens.error_description||tokens.error||'Google token exchange failed');

    let googleEmail=null;
    if(tokens.access_token){
      const u=await fetch('https://openidconnect.googleapis.com/v1/userinfo',{headers:{Authorization:`Bearer ${tokens.access_token}`}});
      if(u.ok) googleEmail=(await u.json()).email||null;
    }

    const sb=serviceSupabase();
    const existing=await sb.from('google_connections').select('encrypted_refresh_token').eq('user_id',userId).maybeSingle();
    const encryptedRefresh = tokens.refresh_token ? encrypt(tokens.refresh_token) : existing.data?.encrypted_refresh_token;
    if(!encryptedRefresh) throw new Error('Google did not return a refresh token. Try Connect again and approve access.');

    const {error}=await sb.from('google_connections').upsert({
      user_id:userId,
      encrypted_refresh_token:encryptedRefresh,
      google_email:googleEmail,
      scopes:tokens.scope||null,
      updated_at:new Date().toISOString()
    });
    if(error)throw error;
    return {statusCode:302,headers:{Location:`${site}/?calendar=connected`,'cache-control':'no-store'},body:''};
  }catch(e){
    return {statusCode:302,headers:{Location:`${site}/?calendar=error&message=${encodeURIComponent(e.message)}`,'cache-control':'no-store'},body:''};
  }
}
