import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {performance} from 'node:perf_hooks';
const base=process.env.CRM_QC_URL||'http://127.0.0.1:5180';
if(!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(base))throw Error('QC is restricted to an isolated local server');
const owner={'oai-authenticated-user-id':'qc-owner','oai-authenticated-user-email':'qc-owner@example.test'},staff={'oai-authenticated-user-id':'qc-staff','oai-authenticated-user-email':'qc@info-xs.com'};
const checks=[];async function request(path='/api/crm',body,headers=owner){const res=await fetch(base+path,{method:body?'POST':'GET',headers:{...headers,...(body instanceof FormData?{}:{'Content-Type':'application/json'})},body:body?(body instanceof FormData?body:JSON.stringify(body)):undefined});const data=(res.headers.get('content-type')||'').includes('json')?await res.json():await res.arrayBuffer();return {status:res.status,data,res};}
async function check(name,fn){await fn();checks.push(name);console.log('PASS',name)}
async function records(){return (await request()).data.records}
async function save(record,action='save'){const r=await request('/api/crm',{record,action});assert.equal(r.status,200,JSON.stringify(r.data));return (await records()).find(r=>r.kind===record.kind&&(record.title?r.title===record.title:r.name===record.name))}
await request();
await check('unauthenticated and unregistered users denied',async()=>{assert.equal((await request('/api/crm',undefined,{})).status,403);assert.equal((await request('/api/crm',undefined,staff)).status,403)});
const team=await save({kind:'team',name:'QC Sales',email:'qc@info-xs.com',status:'Active'});
const vendor=await save({kind:'vendor',name:'QC Vendor',status:'Active'});
const other=await save({kind:'vendor',name:'QC Other Vendor',status:'Active'});
const company=await save({kind:'company',name:'QC Client'});
const products=[];for(let i=1;i<=3;i++)products.push(await save({kind:'product',name:'QC Product '+i,vendor:vendor.id,type:'Product',price:100*i,unit:'Each',brand:'Info-XS',category:'QC',description:'QC specification '+i,warranty:i+' years',availability:'2 days'}));
await check('staff contact import allowed and catalogue writes denied',async()=>{
 assert.equal((await request('/api/crm',undefined,staff)).status,200);
 assert.equal((await request('/api/crm',{action:'import',target:'vendor',rows:[{name:'Forbidden'}]},staff)).status,400);
 assert.equal((await request('/api/crm',{action:'save',record:{kind:'product',name:'Forbidden',type:'Product',price:1}},staff)).status,403);
 const imported=await request('/api/crm',{action:'import',target:'contact',rows:[{name:'QC Contact',company:'QC Import Client',email:'contact@qc.test'}]},staff);assert.equal(imported.status,200);assert.equal(imported.data.created,1);assert.equal(imported.data.companies,1);
});
await check('invalid bulk import is atomic and duplicates are skipped',async()=>{
 const before=(await records()).length;assert.equal((await request('/api/crm',{action:'import',target:'contact',rows:[{name:'Would be valid',company:'Should not exist'},{name:'Missing company'}]})).status,400);assert.equal((await records()).length,before);
 const r=await request('/api/crm',{action:'import',target:'contact',rows:[{name:'QC Contact',company:'QC Import Client',email:'contact@qc.test'}]});assert.equal(r.data.created,0);assert.equal(r.data.skipped.length,1);
 assert.equal((await request('/api/crm',{action:'import',target:'company',rows:Array(201).fill({name:'Too many'})})).status,400);
 assert.equal((await request('/api/crm',{action:'import',target:'product',rows:[{name:'Invalid price',price:'-5'}]})).status,400);
});
await check('ten simultaneous imports create one contact and company',async()=>{
 const responses=await Promise.all(Array.from({length:10},()=>request('/api/crm',{action:'import',target:'contact',rows:[{name:'Concurrent Contact',company:'Concurrent Company',email:'concurrent@qc.test'}]})));
 assert(responses.every(r=>r.status===200));assert.equal(responses.reduce((n,r)=>n+r.data.created,0),1);const rs=await records();assert.equal(rs.filter(r=>r.name==='Concurrent Contact').length,1);assert.equal(rs.filter(r=>r.name==='Concurrent Company').length,1);
});
const pdf='%PDF-1.4\nQC brochure content\n%%EOF';
function upload(vendorId,productId='',filename='qc-brochure.pdf'){const f=new FormData();f.set('vendor',vendorId);f.set('product',productId);f.set('name','QC Brochure');f.set('file',new File([pdf],filename,{type:'application/pdf'}));return f;}
await check('brochure upload validates permissions, vendor, product and file type',async()=>{
 assert.equal((await request('/api/crm/files',upload(vendor.id),staff)).status,403);
 assert.equal((await request('/api/crm/files',upload('missing'))).status,400);
 assert.equal((await request('/api/crm/files',upload(other.id,products[0].id))).status,400);
 assert.equal((await request('/api/crm/files',upload(vendor.id,'','bad.exe'))).status,400);
 const uploaded=await request('/api/crm/files',upload(vendor.id,products[0].id));assert.equal(uploaded.status,200,JSON.stringify(uploaded.data));
});
const brochure=(await records()).find(r=>r.kind==='literature'&&r.name==='QC Brochure');
await check('brochures download intact through authenticated API',async()=>{
 const r=await request('/api/crm/files?id='+brochure.id,undefined,staff);assert.equal(r.status,200);assert.equal(new TextDecoder().decode(r.data),pdf);assert.match(r.res.headers.get('content-disposition'),/^attachment/);assert.equal((await request('/api/crm/files?id='+brochure.id,undefined,{})).status,403);
});
let proposal=await save({kind:'proposal',title:'QC Proposal',company:company.id,owner:team.id,items:[{product:products[0].id,brand:'Info-XS',description:'QC Product 1',qty:2,price:100}],discount:10,tax:10,terms:'QC Terms',scope:'QC Scope',brochures:[brochure.id]});
await check('proposal totals, approval permissions and brochure retention',async()=>{
 assert.equal(proposal.total,209);proposal=await save(proposal,'submit');assert.equal(proposal.status,'Pending approval');
 assert.equal((await request('/api/crm',{record:proposal,action:'approve'},staff)).status,403);
 proposal=await save(proposal,'approve');assert.equal(proposal.status,'Approved');assert.deepEqual(proposal.brochures,[brochure.id]);
 assert.equal((await request('/api/crm',{record:brochure,action:'delete'})).status,400);
});
await check('optimistic locking rejects stale edits',async()=>{
 const first=await request('/api/crm',{action:'save',record:{...company,city:'First edit'}});assert.equal(first.status,200);
 assert.equal((await request('/api/crm',{action:'save',record:{...company,city:'Stale edit'}})).status,409);
});
const load=[];for(const concurrency of [5,20,50]){
 let next=0,errors=0;const times=[],count=250,start=performance.now();
 await Promise.all(Array.from({length:concurrency},async()=>{while(next++<count){const t=performance.now();try{const r=await request();if(r.status!==200||!Array.isArray(r.data.records))errors++}catch{errors++}times.push(performance.now()-t)}}));
 const elapsed=performance.now()-start;times.sort((a,b)=>a-b);const r={concurrency,requests:count,errors,elapsedMs:Math.round(elapsed),requestsPerSecond:Math.round(count/(elapsed/1000)),p50Ms:Math.round(times[Math.floor(times.length*.5)]),p95Ms:Math.round(times[Math.floor(times.length*.95)]),maxMs:Math.round(times.at(-1))};load.push(r);console.log('LOAD',JSON.stringify(r));assert.equal(errors,0);
}
writeFileSync('qc/api-load-results.json',JSON.stringify({testedAt:new Date().toISOString(),environment:'Local production Worker, isolated D1 and R2; not hosted capacity',checks,load,fixtures:{team:team.id,vendor:vendor.id,company:company.id,products:products.map(p=>p.id),brochure:brochure.id,proposal:proposal.id}},null,2)+'\n');
