import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

export function env(name){
  const v=process.env[name];
  if(!v) throw new Error(`Missing environment variable: ${name}`);
  return v;
}
export function serviceSupabase(){
  return createClient(env('SUPABASE_URL'),env('SUPABASE_SERVICE_ROLE_KEY'),{
    auth:{persistSession:false,autoRefreshToken:false}
  });
}
export async function requireUser(event){
  const auth=event.headers.authorization||event.headers.Authorization||'';
  const token=auth.startsWith('Bearer ')?auth.slice(7):null;
  if(!token) throw Object.assign(new Error('Unauthorized'),{statusCode:401});
  const sb=serviceSupabase();
  const {data,error}=await sb.auth.getUser(token);
  if(error||!data.user) throw Object.assign(new Error('Unauthorized'),{statusCode:401});
  return {user:data.user,sb};
}
function b64url(input){return Buffer.from(input).toString('base64url');}
export function createState(userId){
  const payload=b64url(JSON.stringify({userId,exp:Date.now()+10*60*1000,nonce:crypto.randomBytes(12).toString('hex')}));
  const sig=crypto.createHmac('sha256',env('STATE_SECRET')).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}
export function verifyState(state){
  const [payload,sig]=String(state||'').split('.');
  if(!payload||!sig) throw new Error('Invalid OAuth state');
  const expected=crypto.createHmac('sha256',env('STATE_SECRET')).update(payload).digest('base64url');
  if(sig.length!==expected.length||!crypto.timingSafeEqual(Buffer.from(sig),Buffer.from(expected))) throw new Error('Invalid OAuth state');
  const data=JSON.parse(Buffer.from(payload,'base64url').toString('utf8'));
  if(!data.userId||Date.now()>data.exp) throw new Error('Expired OAuth state');
  return data;
}
function key(){
  const raw=env('TOKEN_ENCRYPTION_KEY');
  const buf=Buffer.from(raw,'hex');
  if(buf.length!==32) throw new Error('TOKEN_ENCRYPTION_KEY must be exactly 64 hex characters');
  return buf;
}
export function encrypt(text){
  const iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',key(),iv);
  const encrypted=Buffer.concat([cipher.update(text,'utf8'),cipher.final()]),tag=cipher.getAuthTag();
  return [iv,tag,encrypted].map(x=>x.toString('base64url')).join('.');
}
export function decrypt(blob){
  const [ivB,tagB,dataB]=String(blob).split('.');
  const decipher=crypto.createDecipheriv('aes-256-gcm',key(),Buffer.from(ivB,'base64url'));
  decipher.setAuthTag(Buffer.from(tagB,'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(dataB,'base64url')),decipher.final()]).toString('utf8');
}
export function json(statusCode,body,extraHeaders={}){
  return {statusCode,headers:{'content-type':'application/json','cache-control':'no-store',...extraHeaders},body:JSON.stringify(body)};
}
export async function refreshGoogleAccessToken(refreshToken){
  const body=new URLSearchParams({
    client_id:env('GOOGLE_CLIENT_ID'),
    client_secret:env('GOOGLE_CLIENT_SECRET'),
    refresh_token:refreshToken,
    grant_type:'refresh_token'
  });
  const res=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body});
  const data=await res.json();
  if(!res.ok) throw new Error(data.error_description||data.error||'Could not refresh Google token');
  return data.access_token;
}
