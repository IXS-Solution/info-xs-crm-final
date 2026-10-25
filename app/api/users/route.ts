import { database,requireAdmin,checkOrigin,inviteUser,rateLimit } from '../../../lib/auth/server';
import { normalizeStaffEmail } from '../../../lib/account-policy';
export const dynamic='force-dynamic';
const json=(x:unknown,status=200)=>Response.json(x,{status,headers:{'Cache-Control':'no-store'}});
export async function GET(){try{await requireAdmin();const r=await database().prepare('SELECT id,email,name,role,status,invitation_expires,created_at FROM crm_users ORDER BY created_at DESC').all();return json({users:r.results})}catch{return json({error:'Administrator access required'},403)}}
export async function POST(req:Request){
 try{
  checkOrigin(req);const admin=await requireAdmin();const db=database();const b=await req.json() as Record<string,any>;await rateLimit('users:'+admin.userId,30);
  if(b.action==='invite'){
   const email=normalizeStaffEmail(b.email);const name=String(b.name||'').trim();if(!name||name.length>120)throw Error('Enter a name of at most 120 characters');
   if(await db.prepare('SELECT id FROM crm_users WHERE email=?').bind(email).first())return json({error:'An account with this email already exists. Use resend or enable instead.'},409);
   const id=crypto.randomUUID();await db.prepare('INSERT INTO crm_users(id,email,name,role,status,created_at) VALUES(?,?,?,\'member\',\'invited\',?)').bind(id,email,name,Date.now()).run();
   try{await inviteUser(id)}catch(e){return json({error:(e as Error).message,accountCreated:true},502)}
   return json({ok:true});
  }
  if(typeof b.id!=='string')throw Error('Select an account');
  const target=await db.prepare('SELECT id,status,role FROM crm_users WHERE id=?').bind(b.id).first<{id:string,status:string,role:string}>();if(!target)throw Error('Account not found');
  if(b.action==='resend'){await inviteUser(b.id);return json({ok:true})}
  if(!['disable','enable'].includes(b.action))throw Error('Unknown action');
  if(target.role==='admin')throw Error('The administrator account cannot be disabled here');
  if(b.action==='enable'&&target.status!=='disabled')throw Error('Account is not disabled');
  if(b.action==='enable'){
   await db.prepare('UPDATE crm_users SET status=CASE WHEN password_hash IS NULL THEN \'invited\' ELSE \'active\' END WHERE id=?').bind(b.id).run();
  }else await db.batch([db.prepare('UPDATE crm_users SET status=\'disabled\',invitation_hash=NULL,invitation_expires=NULL WHERE id=?').bind(b.id),db.prepare('DELETE FROM crm_sessions WHERE user_id=?').bind(b.id)]);
  return json({ok:true});
 }catch(e){return json({error:e instanceof Error?e.message:'User management failed'},400)}
}
