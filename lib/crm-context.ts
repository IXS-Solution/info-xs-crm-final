import {isStaffEmail} from './account-policy';
import {partnerCatalogue} from './partner-catalogue';
import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '../app/chatgpt-auth';
export async function crmContext(){
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
