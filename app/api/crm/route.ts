import {crmContext as context} from '../../../lib/crm-context';
import { planImport } from '../../../lib/import-records';
import { normalizeStaffEmail, isStaffEmail } from '../../../lib/account-policy';
import { normalizeWebsite } from '../../../lib/website';
export const dynamic='force-dynamic';
const reply=(x:any,status=200)=>Response.json(x,{status});
export async function GET(){try{const c=await context();return reply({records:c.records,user:{email:c.u.email,name:c.u.displayName,admin:c.admin,memberId:c.member?.id}})}catch(e:any){return reply({error:e.message},403)}}
export async function POST(req:Request){try{
 const c=await context();const b:any=await req.json();const {action}=b;
 if(action==='import'){
 const plan=planImport(b.target,b.rows,c.records,c.admin),now=new Date().toISOString();
 // Stable import identities prevent simultaneous copies of the same file creating duplicates.
 const idMap=new Map<string,string>();
 for(const r of plan.created){
 const company=[...c.records,...plan.created].find((x:any)=>x.id===r.company)?.name||'';
 const key=JSON.stringify([r.kind,String(r.email||r.name).trim().toLowerCase(),r.kind==='contact'&&!r.email?String(company).trim().toLowerCase():'']);
 const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(key));idMap.set(r.id,'import-'+Array.from(new Uint8Array(hash),v=>v.toString(16).padStart(2,'0')).join(''));
 }
 const imported:Record<string,any>[]=plan.created.map(r=>({...r,id:idMap.get(r.id)!,...(r.company?{company:idMap.get(r.company)||r.company}:{}),createdAt:now,updatedAt:now,updatedBy:c.u.email}));
 const results=imported.length?await c.db.batch(imported.map(r=>c.db.prepare('INSERT OR IGNORE INTO crm_records(id,kind,data,version) VALUES(?,?,?,1)').bind(r.id,r.kind,JSON.stringify(r)))):[];
 const inserted=(kind:string)=>imported.filter((r,i)=>r.kind===kind&&results[i].meta.changes).length;
 return reply({ok:true,created:inserted(b.target),companies:b.target==='company'?0:inserted('company'),skipped:[...plan.skipped,...imported.map((r,i)=>r.kind===b.target&&!results[i].meta.changes?i+1:0).filter(Boolean)]});
 }
 let r=b.record;const old=c.records.find((x:any)=>x.id===r?.id);const kinds=['team','company','contact','lead','activity','product','proposal','template','vendor','literature'];
 if(['company','vendor'].includes(r?.kind)&&action!=='delete')r.website=normalizeWebsite(r.website);
 if(!r||!kinds.includes(r.kind))return reply({error:'Invalid record'},400);
 if(['team','template','product','vendor','literature'].includes(r.kind)&&!c.admin)return reply({error:'Owner permission required'},403);
 if(r.kind==='team'&&action!=='delete'){r.email=normalizeStaffEmail(r.email);if(c.records.some((x:any)=>x.kind==='team'&&x.id!==r.id&&String(x.email).trim().toLowerCase()===r.email))return reply({error:'A team member with this username already exists.'},400);}
 if(old&&old.kind!==r.kind)return reply({error:'Invalid record type'},400);
 if(!c.admin&&['lead','proposal'].includes(r.kind)&&(old?.owner||r.owner)!==c.member?.id)return reply({error:'This record belongs to another salesperson'},403);
 if(r.kind==='activity'&&!c.admin&&c.records.find((x:any)=>x.id===r.lead)?.owner!==c.member?.id)return reply({error:'Lead access denied'},403);
 if(action==='delete'){
 if(!c.admin)return reply({error:'Owner permission required'},403);
 if(c.records.some((x:any)=>x.id!==r.id&&(x.vendor===r.id||x.company===r.id||x.owner===r.id||x.lead===r.id||x.items?.some((i:any)=>i.product===r.id)||x.brochures?.includes(r.id))))return reply({error:'This record is in use. Update the linked records first.'},400);
 if(r.kind==='activity'||r.kind==='proposal')return reply({error:'Activity and proposal records are retained for audit'},400);
 await c.db.prepare('DELETE FROM crm_records WHERE id=? AND version=?').bind(r.id,r.version).run();return reply({ok:true});}
 if(!String(r.name||r.title||r.summary||'').trim())return reply({error:'A name or title is required'},400);
 if(r.kind==='contact'&&!c.records.some((x:any)=>x.kind==='company'&&x.id===r.company))return reply({error:'Select a company'},400);
 if(r.kind==='vendor'&&action!=='delete'&&!['Active','Inactive'].includes(r.status))return reply({error:'Select a valid vendor status'},400);
 if(r.kind==='product'&&action!=='delete'){
 if(r.vendor&&!c.records.some((x:any)=>x.kind==='vendor'&&x.id===r.vendor))return reply({error:'Select a registered vendor'},400);
 if(!['Product','Service'].includes(r.type))return reply({error:'Select Product or Service'},400);
 if(r.price!==null&&(r.price===''||!Number.isFinite(Number(r.price))||Number(r.price)<0))return reply({error:'Enter a valid non-negative price'},400);
 }
 if(r.kind==='literature')return reply({error:'Use the vendor literature upload control'},400);
 if(r.kind==='proposal'){
 if(action==='save'&&r.brochures?.some((id:string)=>!c.records.some((x:any)=>x.id===id&&x.kind==='literature')))return reply({error:'A selected brochure is unavailable'},400);
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
 const now=new Date().toISOString();r={...r,id:old?.id||crypto.randomUUID(),createdAt:old?.createdAt||now,updatedAt:now,updatedBy:c.u.email};
 if(old){const result:any=await c.db.prepare('UPDATE crm_records SET data=?,version=version+1 WHERE id=? AND version=?').bind(JSON.stringify(r),r.id,b.record.version).run();if(!result.meta.changes)return reply({error:'Record changed. Refresh and try again.'},409)}else await c.db.prepare('INSERT INTO crm_records(id,kind,data,version) VALUES(?,?,?,1)').bind(r.id,r.kind,JSON.stringify(r)).run();
 return reply({ok:true});
 }catch(e:any){return reply({error:e.message},400)}}
