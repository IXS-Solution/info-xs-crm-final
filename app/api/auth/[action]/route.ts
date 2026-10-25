import { database,settings,checkOrigin,rateLimit,SESSION_COOKIE,currentUser,inviteUser } from '../../../../lib/auth/server';
import { digest,randomToken,hashPassword,verifyPassword,validatePassword } from '../../../../lib/auth/crypto';
import { normalizeStaffEmail } from '../../../../lib/account-policy';
export const dynamic='force-dynamic';
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
export async function POST(req:Request,{params}:{params:Promise<{action:string}>}){
 try{
  checkOrigin(req);const {action}=await params;const db=database();const body=await req.json() as Record<string,any>;
  const ip=req.headers.get('cf-connecting-ip')||'shared';
  if(action==='logout'){
   const cookie=req.headers.get('cookie')?.split(';').map(x=>x.trim()).find(x=>x.startsWith(SESSION_COOKIE+'='))?.slice(SESSION_COOKIE.length+1);
   if(cookie)await db.prepare('DELETE FROM crm_sessions WHERE token_hash=?').bind(await digest(cookie)).run();
   return new Response(JSON.stringify({ok:true}),{headers:{'Content-Type':'application/json','Set-Cookie':`${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`,'Cache-Control':'no-store'}});
  }
  if(action==='bootstrap'){
   if(!settings().CRM_SETUP_TOKEN || req.headers.get('authorization')!==`Bearer ${settings().CRM_SETUP_TOKEN}`)return json({error:'Setup is not authorized'},403);
   const email=normalizeStaffEmail(settings().CRM_ADMIN_EMAIL||'info@info-xs.com');
   const existing=await db.prepare('SELECT id,email,status FROM crm_users WHERE role=\'admin\' LIMIT 1').first<{id:string,email:string,status:string}>();
   if(existing){
    if(existing.email!==email||existing.status!=='invited')return json({error:'Administrator already configured'},409);
    await inviteUser(existing.id);return json({ok:true});
   }
   // The constant id reserves a single bootstrap administrator, including concurrent requests.
   await db.prepare('INSERT INTO crm_users(id,email,name,role,status,created_at) VALUES(?,?,?,\'admin\',\'invited\',?)').bind('initial-admin',email,'Info-XS Administrator',Date.now()).run();
   await inviteUser('initial-admin');return json({ok:true});
  }
  await rateLimit('ip:'+ip,50);
  if(action==='activate'){
   const {token,password}=body;validatePassword(password);
   if(typeof token!=='string'||!/^[a-f0-9]{64}$/.test(token))return json({error:'Invalid or expired activation link'},400);
   const hash=await digest(token);const passwordHash=await hashPassword(password);
   const result=await db.prepare('UPDATE crm_users SET password_hash=?,status=\'active\',invitation_hash=NULL,invitation_expires=NULL WHERE invitation_hash=? AND invitation_expires>? AND status=\'invited\'').bind(passwordHash,hash,Date.now()).run();
   if(!result.meta.changes)return json({error:'Invalid or expired activation link. Ask your administrator to resend the invitation.'},400);
   return json({ok:true});
  }
  if(action==='login'){
   const email=normalizeStaffEmail(body.email);await rateLimit('email:'+email);
   if(typeof body.password!=='string'||body.password.length>128)return json({error:'Invalid email or password'},401);
   const u=await db.prepare('SELECT id,password_hash,status FROM crm_users WHERE email=?').bind(email).first<{id:string,password_hash:string|null,status:string}>();
   const dummy='pbkdf2$100000$'+'0'.repeat(64)+'$'+'0'.repeat(64);
   const valid=await verifyPassword(body.password,u?.password_hash||dummy);
   if(!u||u.status!=='active'||!valid)return json({error:'Invalid email or password, or account is not active'},401);
   const token=randomToken();await db.prepare('INSERT INTO crm_sessions(token_hash,user_id,expires) VALUES(?,?,?)').bind(await digest(token),u.id,Date.now()+8*3600000).run();
   return new Response(JSON.stringify({ok:true}),{headers:{'Content-Type':'application/json','Set-Cookie':`${SESSION_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=28800`,'Cache-Control':'no-store'}});
  }
  return json({error:'Unknown action'},404);
 }catch(e){return json({error:e instanceof Error?e.message:'Authentication failed'},400)}
}
export async function GET(){const u=await currentUser();return json({user:u});}
