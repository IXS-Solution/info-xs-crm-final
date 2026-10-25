import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {writeFileSync} from 'node:fs';
const base=process.env.CRM_QC_URL||'http://127.0.0.1:5180';if(!/^http:\/\/127\.0\.0\.1:\d+$/.test(base))throw Error('Isolated localhost only');
const headers={'oai-authenticated-user-id':'qc-owner','oai-authenticated-user-email':'qc-owner@example.test','Content-Type':'application/json'};
async function api(body){const r=await fetch(base+'/api/crm',{headers,method:body?'POST':'GET',body:body?JSON.stringify(body):undefined});return {status:r.status,data:await r.json()}}
for(let batch=0;batch<5;batch++){const r=await api({action:'import',target:'contact',rows:Array.from({length:200},(_,i)=>({name:`Load Contact ${batch*200+i}`,company:'Load Test Company',email:`load${batch*200+i}@qc.test`}))});assert.equal(r.status,200);}
const count=(await api()).data.records.length,results=[];
for(const concurrency of [5,20,50]){
 const times=[],statuses={};let read=0,write=0;const start=performance.now(),until=start+10000;
 await Promise.all(Array.from({length:concurrency},async(_,worker)=>{let step=0;while(performance.now()<until){const t=performance.now();let status;try{const isWrite=step++%20===19;const r=await api(isWrite?{action:'import',target:'contact',rows:[{name:`Mixed ${concurrency} ${worker} ${step}`,company:'Mixed Load Company',email:`mixed${concurrency}-${worker}-${step}@qc.test`}]}:undefined);status=r.status;isWrite?write++:read++;}catch{status='network-error'}statuses[status]=(statuses[status]||0)+1;times.push(performance.now()-t);if(status!==200)break;}}));
 const elapsed=performance.now()-start;times.sort((a,b)=>a-b);const result={concurrency,startingRecords:count,readRequests:read,writeRequests:write,statuses,elapsedMs:Math.round(elapsed),requestsPerSecond:Math.round(times.length/(elapsed/1000)),p50Ms:Math.round(times[Math.floor(times.length*.5)]),p95Ms:Math.round(times[Math.floor(times.length*.95)]),maxMs:Math.round(times.at(-1))};results.push(result);console.log(JSON.stringify(result));
}
writeFileSync('qc/sustained-load-results.json',JSON.stringify({testedAt:new Date().toISOString(),environment:'Local production Worker with isolated D1 and R2, 1,000 imported test contacts plus catalogue and QC fixtures',durationPerStageSeconds:10,results},null,2)+'\n');assert(results.every(r=>Object.keys(r.statuses).every(s=>s==='200')),'Load test returned failures');
