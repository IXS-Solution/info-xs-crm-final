import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync,mkdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
const require=createRequire(import.meta.url);const wranglerRequire=createRequire(require.resolve('wrangler/package.json'));
const {Miniflare}=wranglerRequire('miniflare');
mkdirSync('.sites-runtime',{recursive:true});
execFileSync('node_modules/.bin/esbuild',['tests/worker.mjs','--bundle','--format=esm','--platform=node','--external:cloudflare:workers','--external:node:*','--alias:next/headers=./tests/headers.mjs','--outfile=.sites-runtime/test-worker.mjs'],{stdio:'pipe'});
test('account and import endpoints work against real D1 with mocked email delivery',async()=>{
 const emails=[];let rejectEmail=false;
 const mf=new Miniflare({modules:true,scriptPath:'.sites-runtime/test-worker.mjs',compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],bindings:{CRM_PUBLIC_URL:'https://crm.example.test',CRM_ADMIN_EMAIL:'info@info-xs.com',CRM_SETUP_TOKEN:'test-setup-token',CRM_EMAIL_FROM:'CRM <crm@info-xs.com>',RESEND_API_KEY:'test-only'},outboundService:async req=>{assert.equal(new URL(req.url).origin,'https://api.resend.com');emails.push(await req.json());return Response.json(rejectEmail?{error:'mock failure'}:{id:'test-mail'},{status:rejectEmail?500:200})}});
 try{
 const db=await mf.getD1Database('DB');
 for(const file of ['drizzle/0000_short_tag.sql','drizzle/0001_wakeful_randall_flagg.sql'])for(const sql of readFileSync(file,'utf8').split('--> statement-breakpoint').map(x=>x.trim()).filter(Boolean))await db.prepare(sql).run();
 let cookie='';
 async function call(path,body={},options={}){const r=await mf.dispatchFetch('https://crm.example.test'+path,{method:options.method||'POST',headers:{origin:options.origin||'https://crm.example.test','content-type':'application/json',cookie,...(options.headers||{})},...(options.method==='GET'?{}:{body:JSON.stringify(body)})});return {r,j:await r.json()}}
 assert.equal((await call('/api/auth/bootstrap')).r.status,403);
 assert.equal((await call('/api/auth/bootstrap',{}, {headers:{authorization:'Bearer test-setup-token'}})).r.status,200);assert.equal(emails.length,1);assert.equal(emails[0].to[0],'info@info-xs.com');
 const token=()=>new URL(emails.at(-1).text.match(/https:\/\/[^\s]+\/activate\?token=[a-f0-9]+/)[0]).searchParams.get('token');
 const adminToken=token();const password='correct horse battery staple';
 assert.equal((await call('/api/auth/login',{email:'info@info-xs.com',password})).r.status,401);
 assert.equal((await call('/api/auth/activate',{token:adminToken,password:'short'})).r.status,400);
 assert.equal((await call('/api/auth/activate',{token:adminToken,password})).r.status,200);
 assert.equal((await call('/api/auth/activate',{token:adminToken,password})).r.status,400);
 assert.equal((await call('/api/auth/login',{email:'info@info-xs.com',password:'wrong password'})).r.status,401);
 const login=await call('/api/auth/login',{email:'INFO@INFO-XS.COM',password});assert.equal(login.r.status,200);cookie=login.r.headers.get('set-cookie').split(';')[0];assert.match(login.r.headers.get('set-cookie'),/HttpOnly; Secure; SameSite=Lax/);
 assert.equal((await call('/api/users',{action:'invite',name:'External',email:'x@other.com'})).r.status,400);
 assert.equal((await call('/api/users',{action:'invite',name:'Staff',email:'staff@info-xs.com'},{origin:'https://evil.test'})).r.status,400);
 assert.equal((await call('/api/users',{action:'invite',name:'Staff',email:'staff@info-xs.com'})).r.status,200);
 let staffToken=token();const list=await call('/api/users',{}, {method:'GET'});const staff=list.j.users.find(x=>x.email==='staff@info-xs.com');assert.ok(staff);assert.equal(staff.password_hash,undefined);assert.equal(staff.invitation_hash,undefined);
 await call('/api/users',{action:'resend',id:staff.id});assert.equal((await call('/api/auth/activate',{token:staffToken,password})).r.status,400);staffToken=token();
 await db.prepare('UPDATE crm_users SET invitation_expires=0 WHERE id=?').bind(staff.id).run();assert.equal((await call('/api/auth/activate',{token:staffToken,password})).r.status,400);
 await call('/api/users',{action:'resend',id:staff.id});staffToken=token();assert.equal((await call('/api/auth/activate',{token:staffToken,password})).r.status,200);
 rejectEmail=true;const failed=await call('/api/users',{action:'invite',name:'Retry',email:'retry@info-xs.com'});assert.equal(failed.r.status,502);assert.equal(failed.j.accountCreated,true);rejectEmail=false;
 const adminCookie=cookie;const memberLogin=await call('/api/auth/login',{email:'staff@info-xs.com',password});cookie=memberLogin.r.headers.get('set-cookie').split(';')[0];const memberCookie=cookie;
 assert.equal((await call('/api/users',{}, {method:'GET'})).r.status,403);
 const bad=await call('/api/contacts/import',{rows:[{name:'Bad',company:'Missing',email:'not-email'}]});assert.equal(bad.r.status,400);assert.equal((await db.prepare("SELECT count(*) n FROM crm_records WHERE kind='contact'").first()).n,0);
 const imported=await call('/api/contacts/import',{createCompanies:true,rows:[{name:'Alice',company:'Acme',email:'alice@example.com',phone:'03001234567'},{name:'Bob',company:'Acme'}]});assert.equal(imported.j.imported,2);assert.equal(imported.j.companiesCreated,1);
 assert.equal((await call('/api/contacts/import',{rows:[{name:'Again',company:'Acme',email:'ALICE@example.com'}]})).r.status,400);
 cookie=adminCookie;assert.equal((await call('/api/users',{action:'disable',id:staff.id})).r.status,200);cookie=memberCookie;assert.equal((await call('/api/contacts/import',{rows:[{name:'Blocked',company:'Acme'}]})).r.status,401);
 assert.equal((await call('/api/auth/login',{email:'staff@info-xs.com',password})).r.status,401);
 cookie=adminCookie;await db.prepare('UPDATE crm_sessions SET expires=0 WHERE user_id=\'initial-admin\'').run();assert.equal((await call('/api/users',{}, {method:'GET'})).r.status,403);
 for(let i=0;i<11;i++)await call('/api/auth/login',{email:'absent@info-xs.com',password});const limited=await call('/api/auth/login',{email:'absent@info-xs.com',password});assert.match(limited.j.error,/Too many attempts/);
 const relogin=await call('/api/auth/login',{email:'info@info-xs.com',password});cookie=relogin.r.headers.get('set-cookie').split(';')[0];await call('/api/auth/logout');assert.equal((await call('/api/users',{}, {method:'GET'})).r.status,403);
 }finally{await mf.dispose()}
});
