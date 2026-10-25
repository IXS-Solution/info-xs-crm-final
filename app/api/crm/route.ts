import {calculateISO} from '../../../lib/iso';
import { normalizeStaffEmail, isStaffEmail } from '../../../lib/account-policy';
import { partnerCatalogue } from '../../../lib/partner-catalogue';
import { normalizeWebsite } from '../../../lib/website';
import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '../../chatgpt-auth';
export const dynamic='force-dynamic';
const reply=(x:any,status=200)=>Response.json(x,{status});
async function context(){
 const u=await getChatGPTUser();if(!u)throw new Error('Sign in required');const db=env.DB;if(!db)throw new Error("Database is unavailable");
 await db.prepare('INSERT OR IGNORE INTO crm_config (key,value) VALUES (?,?)').bind('owner',u.userId).run();
 const owner:any=await db.prepare('SELECT value FROM crm_config WHERE key=?').bind('owner').first();
 const seeded=await db.prepare('SELECT value FROM crm_config WHERE key=?').bind('partner-catalogue-v1').first();
 if(!seeded){await db.batch([...partnerCatalogue.map(p=>db.prepare('INSERT OR IGNORE INTO crm_records(id,kind,data,version) VALUES(?,?,?,1)').bind(p.id,p.kind,JSON.stringify(p))),db.prepare('INSERT OR IGNORE INTO crm_config(key,value) VALUES(?,?)').bind('partner-catalogue-v1','installed')]);}
 const rs:any=await db.prepare('SELECT * FROM crm_records').all();const records=rs.results.map((r:any)=>({...JSON.parse(r.data),id:r.id,kind:r.kind,version:r.version}));
 const admin=owner.value===u.userId;
 if(!admin&&!isStaffEmail(u.email))throw new Error('Access is restricted to approved @info-xs.com staff accounts.');
 const member=records.find((r:any)=>r.kind==='team'&&r.email?.toLowerCase()===u.email.toLowerCase()&&r.status==='Active');
 if(!admin&&!member)throw new Error('Your account is not an active team member');return {u,db,records,admin,member};
}
export async function GET(){try{const c=await context();return reply({records:c.records.filter((r:any)=>r.kind!=='iso'||c.admin||r.owner===c.member?.id),user:{email:c.u.email,name:c.u.displayName,admin:c.admin,memberId:c.member?.id}})}catch(e:any){return reply({error:e.message},403)}}
export async function POST(req:Request){try{
 const c=await context();const b:any=await req.json();const {action}=b;let r=b.record;const old=c.records.find((x:any)=>x.id===r?.id);const kinds=['team','company','contact','lead','activity','product','proposal','template','vendor','iso'];
 if(['company','vendor'].includes(r?.kind)&&action!=='delete')r.website=normalizeWebsite(r.website);
 if(!r||!kinds.includes(r.kind))return reply({error:'Invalid record'},400);
 if(['team','template','product','vendor'].includes(r.kind)&&!c.admin)return reply({error:'Owner permission required'},403);
 if(r.kind==='team'&&action!=='delete'){r.email=normalizeStaffEmail(r.email);if(c.records.some((x:any)=>x.kind==='team'&&x.id!==r.id&&String(x.email).trim().toLowerCase()===r.email))return reply({error:'A team member with this username already exists.'},400);}
 if(old&&old.kind!==r.kind)return reply({error:'Invalid record type'},400);
 if(!c.admin&&['lead','proposal'].includes(r.kind)&&(old?.owner||r.owner)!==c.member?.id)return reply({error:'This record belongs to another salesperson'},403);
 if(r.kind==='activity'&&!c.admin&&c.records.find((x:any)=>x.id===r.lead)?.owner!==c.member?.id)return reply({error:'Lead access denied'},403);
 if(r.kind==='iso'&&!c.admin&&(old?.owner||r.owner)!==c.member?.id)return reply({error:'ISO access denied'},403);
 if(r.kind==='iso'&&!c.admin&&r.owner!==c.member?.id)return reply({error:'Cannot reassign this ISO'},403);
 if(action==='delete'){
 if(!c.admin)return reply({error:'Owner permission required'},403);
 if(c.records.some((x:any)=>x.id!==r.id&&(x.vendor===r.id||x.company===r.id||x.owner===r.id||x.lead===r.id||x.items?.some((i:any)=>i.product===r.id))))return reply({error:'This record is in use. Update the linked records first.'},400);
 if(['activity','proposal','iso'].includes(r.kind))return reply({error:'Activity, proposal and ISO records are retained for audit'},400);
 await c.db.prepare('DELETE FROM crm_records WHERE id=? AND version=?').bind(r.id,r.version).run();return reply({ok:true});}
 if(!String(r.name||r.title||r.summary||'').trim())return reply({error:'A name or title is required'},400);
 if(r.kind==='contact'&&!c.records.some((x:any)=>x.kind==='company'&&x.id===r.company))return reply({error:'Select a company'},400);
 if(r.kind==='vendor'&&action!=='delete'&&!['Active','Inactive'].includes(r.status))return reply({error:'Select a valid vendor status'},400);
 if(r.kind==='product'&&action!=='delete'){
 if(r.vendor&&!c.records.some((x:any)=>x.kind==='vendor'&&x.id===r.vendor))return reply({error:'Select a registered vendor'},400);
 if(!['Product','Service'].includes(r.type))return reply({error:'Select Product or Service'},400);
 if(r.price!==null&&(r.price===''||!Number.isFinite(Number(r.price))||Number(r.price)<0))return reply({error:'Enter a valid non-negative price'},400);
 }
 if(r.kind==='iso'){
 if(!['save','record'].includes(action))return reply({error:'Invalid ISO action'},400);
 if(r.id&&!old)return reply({error:'ISO no longer exists. Refresh and try again.'},409);
 if(old?.status==='Recorded')return reply({error:'Recorded ISOs are locked for audit'},400);
 if(!c.records.some((x:any)=>x.kind==='company'&&x.id===r.company))return reply({error:'Select a customer company'},400);
 if(!c.records.some((x:any)=>x.kind==='team'&&x.id===r.owner&&x.status==='Active'))return reply({error:'Select an active sales owner'},400);
 if(!/^\d{4}-\d{2}-\d{2}$/.test(r.orderDate||'')||!Number.isFinite(Date.parse(r.orderDate)))return reply({error:'Enter a valid order date'},400);
 for(const i of r.items||[]){if(i.vendor&&!c.records.some((x:any)=>x.kind==='vendor'&&x.id===i.vendor))return reply({error:'Invalid vendor'},400);if(i.product&&!c.records.some((x:any)=>x.kind==='product'&&x.id===i.product))return reply({error:'Invalid catalogue offering'},400);}
 const calculated=calculateISO(r);
 if(action==='record'&&calculated.items.some((i:any)=>i.unitSell<=0))return reply({error:'Every recorded line needs a positive selling price'},400);
 const id=old?.id||crypto.randomUUID();
 r={...r,...calculated,id,isoNumber:old?.isoNumber||'ISO-'+new Date().getUTCFullYear()+'-'+id.toUpperCase(),status:action==='record'?'Recorded':'Draft',createdBy:old?.createdBy||c.u.email,history:[...(old?.history||[]),{action,by:c.u.email,at:new Date().toISOString()}]};
 }
 if(r.kind==='proposal'){
 const statuses:any={submit:['Draft','Changes requested'],approve:['Pending approval'],return:['Pending approval'],sent:['Approved']};
 if(action!=='save'){
 if(!old||!statuses[action]?.includes(old.status))return reply({error:'Invalid proposal transition'},400);
 if(['approve','return'].includes(action)&&!c.admin)return reply({error:'Only Sohail Tareen can approve or return proposals'},403);
 r={...old,status:({submit:'Pending approval',approve:'Approved',return:'Changes requested',sent:'Sent'} as any)[action],reviewNote:b.note||'',history:[...(old.history||[]),{action,by:c.u.email,at:new Date().toISOString(),note:b.note||''}]};
 }else{
 if(old?.status==='Pending approval'||old?.status==='Sent')return reply({error:'Pending and sent proposals cannot be edited'},400);
 if(!r.items?.length||r.items.some((i:any)=>!i.description||!Number.isFinite(Number(i.qty))||Number(i.qty)<=0||i.price===''||i.price==null||!Number.isFinite(Number(i.price))||Number(i.price)<0))return reply({error:'Add valid proposal line items'},400);
 r.status='Draft';r.history=old?.history||[];
 }
 const subtotal=r.items.reduce((a:number,i:any)=>a+Number(i.qty)*Number(i.price),0);if(Number(r.discount||0)<0||Number(r.discount||0)>subtotal||Number(r.tax||0)<0)return reply({error:'Invalid discount or tax'},400);
 r.total=Math.round((subtotal-Number(r.discount||0))*(1+Number(r.tax||0)/100)*100)/100;
 }
 if(r.kind==='activity'&&old)return reply({error:'Activity entries are append-only'},400);
 const now=new Date().toISOString();r={...r,id:old?.id||(r.kind==='iso'?r.id:crypto.randomUUID()),createdAt:old?.createdAt||now,updatedAt:now,updatedBy:c.u.email};
 if(old){const result:any=await c.db.prepare('UPDATE crm_records SET data=?,version=version+1 WHERE id=? AND version=?').bind(JSON.stringify(r),r.id,b.record.version).run();if(!result.meta.changes)return reply({error:'Record changed. Refresh and try again.'},409)}else await c.db.prepare('INSERT INTO crm_records(id,kind,data,version) VALUES(?,?,?,1)').bind(r.id,r.kind,JSON.stringify(r)).run();
 return reply({ok:true,...(r.kind==='iso'?{id:r.id,isoNumber:r.isoNumber}:{})});
 }catch(e:any){return reply({error:e.message},400)}}
