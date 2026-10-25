import { env } from 'cloudflare:workers';
import { cookies } from 'next/headers';
import { normalizeStaffEmail } from '../account-policy';
import { digest, randomToken } from './crypto';
export const SESSION_COOKIE='crm_session';
export const settings=()=>env as unknown as Record<string,string>;
export function database(){if(!env.DB)throw Error('Database is unavailable');return env.DB;}
export async function currentUser(){
 const token=(await cookies()).get(SESSION_COOKIE)?.value;if(!token)return null;
 const u=await database().prepare('SELECT u.id,u.email,u.name,u.role FROM crm_sessions s JOIN crm_users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires>? AND u.status=\'active\'').bind(await digest(token),Date.now()).first<{id:string,email:string,name:string,role:string}>();
 if(!u)return null;normalizeStaffEmail(u.email);
 return {userId:u.id,email:u.email,displayName:u.name,admin:u.role==='admin'};
}
export async function requireAdmin(){const u=await currentUser();if(!u?.admin)throw Error('Administrator access required');return u;}
export function checkOrigin(req:Request){
 const origin=req.headers.get('origin');const expected=settings().CRM_PUBLIC_URL;
 if(!origin || origin!==new URL(expected||req.url).origin)throw Error('Request origin is not allowed');
}
export async function rateLimit(key:string,limit=10){
 const now=Date.now();const r=await database().prepare('INSERT INTO crm_auth_limits(key,attempts,expires) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN expires<? THEN 1 ELSE attempts+1 END, expires=CASE WHEN expires<? THEN excluded.expires ELSE expires END RETURNING attempts').bind(key,now+15*60*1000,now,now).first<{attempts:number}>();
 if(!r || r.attempts>limit)throw Error('Too many attempts. Please try again in 15 minutes.');
}
export async function sendInvitation(email:string,token:string){
 const s=settings();if(!s.CRM_PUBLIC_URL||!s.CRM_EMAIL_FROM||!s.RESEND_API_KEY)throw Error('Invitation email is not configured. Configure CRM_PUBLIC_URL, CRM_EMAIL_FROM and RESEND_API_KEY.');
 const origin=new URL(s.CRM_PUBLIC_URL);if(origin.protocol!=='https:')throw Error('CRM_PUBLIC_URL must use HTTPS');
 const url=new URL('/activate',origin);url.searchParams.set('token',token);
 const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${s.RESEND_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({from:s.CRM_EMAIL_FROM,to:[email],subject:'Activate your Info-XS CRM account',text:`You have been invited to Info-XS CRM. Open this link to choose your own password:\n\n${url}\n\nThe link expires in 24 hours and can only be used once. Your CRM is at ${origin.origin}. If you were not expecting this invitation, ignore this email.`})});
 if(!response.ok)throw Error('The email provider could not deliver the invitation. Check the verified sender and email configuration, then resend.');
}
export async function inviteUser(id:string){
 const db=database();const u=await db.prepare('SELECT email,status FROM crm_users WHERE id=?').bind(id).first<{email:string,status:string}>();
 if(!u||u.status!=='invited')throw Error('Only pending accounts can receive activation invitations');
 normalizeStaffEmail(u.email);const token=randomToken();const hash=await digest(token);
 await db.prepare('UPDATE crm_users SET invitation_hash=?,invitation_expires=? WHERE id=? AND status=\'invited\'').bind(hash,Date.now()+86400000,id).run();
 await sendInvitation(u.email,token);
}
