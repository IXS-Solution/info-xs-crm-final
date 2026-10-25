// Run a production build locally without debugger response retention during load tests.
import {unstable_startWorker} from 'wrangler';
const worker=await unstable_startWorker({config:'dist/server/wrangler.json',dev:{remote:false,persist:process.env.CRM_QC_STATE||'/tmp/crm-qc-state',inspector:false,watch:false,logLevel:'error',server:{hostname:'127.0.0.1',port:Number(process.env.CRM_QC_PORT||5180)}}});
console.log('QC production server ready');
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{await worker.dispose();process.exit(0)});
