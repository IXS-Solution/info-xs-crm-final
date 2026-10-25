type R=Record<string,any>;
export const reportSources:Record<string,string>={iso:'ISO costing',lead:'Sales pipeline',proposal:'Proposals',activity:'Sales activities',team:'Team performance',company:'Customer companies',vendor:'Vendors',product:'Products & services'};
const common={id:'Record ID',name:'Name / title',owner:'Sales owner',company:'Company',date:'Date',status:'Status',createdAt:'Created date',updatedAt:'Updated date'};
export const reportFields:Record<string,Record<string,string>>={
 iso:{...common,isoNumber:'ISO number',sales:'Sales excl. tax',cost:'Landed cost',tax:'Sales tax',invoice:'Invoice value',gp:'Final GP',margin:'Final GP %',finance:'Financial charges'},
 lead:{...common,stage:'Stage',value:'Opportunity value',followup:'Next follow-up',closeDate:'Close date',source:'Lead source'},
 proposal:{...common,total:'Proposal amount',reference:'Reference',validUntil:'Validity date'},
 activity:{...common,type:'Activity type',lead:'Lead',contact:'Contact',outcome:'Outcome'},
 team:{id:'Staff ID',name:'Team member',email:'Email',status:'Status',designation:'Designation',joiningDate:'Joining date',quota:'Quota for selected year',won:'Won sales for selected year',attainment:'Quota attainment %',open:'Open pipeline',orders:'Recorded ISO count',isoSales:'Recorded ISO sales',gp:'Recorded ISO final GP'},
 company:{...common,industry:'Industry',city:'City',phone:'Phone',email:'Email'},
 vendor:{...common,contactPerson:'Contact person',city:'City',email:'Email',phone:'Phone',vendorType:'Vendor type',technologyScope:'Technology / solution scope',partnershipStatus:'Partnership progress',distributor:'Distributor'},
 product:{id:'Offering ID',name:'Offering',type:'Type',vendor:'Vendor',brand:'Brand',category:'Category',unit:'Unit',price:'Unit price'}
};
export const numericFields=new Set(['sales','cost','tax','invoice','gp','margin','finance','value','total','quota','won','attainment','open','orders','isoSales','price']);
export const operators={eq:'equals',neq:'does not equal',contains:'contains',gt:'greater than',gte:'at least',lt:'less than',lte:'at most',empty:'is empty',notempty:'is not empty'};
export function validateReport(r:R){
 const fields=reportFields[r.source];if(!fields)throw Error('Select a report data source');
 if(!Array.isArray(r.columns)||!r.columns.length||r.columns.some((k:any)=>!Object.hasOwn(fields,k)))throw Error('Select valid report columns');
 if(r.groupBy&&!Object.hasOwn(fields,r.groupBy))throw Error('Invalid grouping');
 if(r.sortBy&&!Object.hasOwn(fields,r.sortBy)&&r.sortBy!=='count')throw Error('Invalid sort column');
 if(!['asc','desc'].includes(r.direction))throw Error('Invalid sort direction');
 if(!Array.isArray(r.filters)||r.filters.length>20||r.filters.some((f:R)=>!Object.hasOwn(fields,f.field)||!Object.hasOwn(operators,f.op)||typeof f.value!=='string'||(numericFields.has(f.field)&&!['empty','notempty'].includes(f.op)&&(!f.value.trim()||!Number.isFinite(Number(f.value))))))throw Error('Invalid report filters');
 if(!Array.isArray(r.metrics)||new Set(r.metrics.map((m:R)=>m.op+'_'+m.field)).size!==r.metrics.length||r.metrics.some((m:R)=>!numericFields.has(m.field)||!Object.hasOwn(fields,m.field)||!['sum','avg','min','max'].includes(m.op)))throw Error('Invalid report metrics');
 if(!/^\d{4}$/.test(String(r.year)))throw Error('Enter a four-digit quota year');
 for(const key of ['from','to'])if(r[key]&&!/^\d{4}-\d{2}-\d{2}$/.test(r[key]))throw Error('Enter valid date filters');
 if(r.from&&r.to&&r.from>r.to)throw Error('Start date must precede end date');
}
export function reportRows(records:R[],source:string,year:string){
 const byId=new Map(records.map(r=>[r.id,r]));const name=(id:string)=>byId.get(id)?.name||'Unassigned';
 return records.filter(r=>r.kind===source).map(r=>{
  const lead=byId.get(r.lead),owner=r.owner||(r.kind==='activity'?lead?.owner:'');
  const row:R={...r,name:r.name||r.title||'',owner:name(owner),company:name(r.company||lead?.company),vendor:r.vendor?name(r.vendor):'',lead:lead?.name||'',contact:byId.get(r.contact)?.name||'',date:(r.orderDate||r.closeDate||r.date||r.createdAt||'').slice(0,10)};
  if(source==='iso')Object.assign(row,{sales:r.totals?.sales||0,cost:r.totals?.cost||0,tax:r.totals?.tax||0,invoice:r.totals?.total||0,gp:r.totals?.finalGP||0,margin:r.totals?.finalGPPercent||0,finance:r.totals?.financeCharges||0});
  if(source==='team'){
   const leads=records.filter(x=>x.kind==='lead'&&x.owner===r.id),won=leads.filter(x=>x.stage==='Won'&&(x.closeDate||x.updatedAt||'').startsWith(year)).reduce((a,x)=>a+Number(x.value||0),0);
   const orders=records.filter(x=>x.kind==='iso'&&x.owner===r.id&&x.status==='Recorded'&&(x.orderDate||'').startsWith(year));const quota=Number(r.quotas?.[year]||0);
   Object.assign(row,{quota,won,attainment:quota?won/quota*100:0,open:leads.filter(x=>!['Won','Lost'].includes(x.stage)).reduce((a,x)=>a+Number(x.value||0),0),orders:orders.length,isoSales:orders.reduce((a,x)=>a+Number(x.totals?.sales||0),0),gp:orders.reduce((a,x)=>a+Number(x.totals?.finalGP||0),0)});
  }
  return row;
 });
}
export function runReport(records:R[],spec:R){
 validateReport(spec);
 const rows=reportRows(records,spec.source,String(spec.year)).filter(row=>{
  if(spec.from&&(!row.date||row.date<spec.from))return false;if(spec.to&&(!row.date||row.date>spec.to))return false;
  return spec.filters.every((f:R)=>{const value=row[f.field]??'',target=f.value;const a=String(value).toLowerCase(),b=target.toLowerCase();switch(f.op){case 'eq':return numericFields.has(f.field)?Number(value)===Number(target):a===b;case 'neq':return numericFields.has(f.field)?Number(value)!==Number(target):a!==b;case 'contains':return a.includes(b);case 'gt':return numericFields.has(f.field)?Number(value)>Number(target):a>b;case 'gte':return numericFields.has(f.field)?Number(value)>=Number(target):a>=b;case 'lt':return numericFields.has(f.field)?Number(value)<Number(target):a<b;case 'lte':return numericFields.has(f.field)?Number(value)<=Number(target):a<=b;case 'empty':return value==='';case 'notempty':return value!=='';default:return false}});
 });
 const aggregate=(rs:R[])=>Object.fromEntries(spec.metrics.map((m:R)=>{const values=rs.map(r=>r[m.field]).filter(v=>v!==''&&v!=null&&Number.isFinite(Number(v))).map(Number);return [m.op+'_'+m.field,!values.length?0:m.op==='sum'?values.reduce((a,b)=>a+b,0):m.op==='avg'?values.reduce((a,b)=>a+b,0)/values.length:m.op==='min'?Math.min(...values):Math.max(...values)]}));
 let results=rows;if(spec.groupBy){const groups=new Map<string,R[]>();for(const r of rows){const k=String(r[spec.groupBy]??'');groups.set(k,[...(groups.get(k)||[]),r])}results=[...groups].map(([k,rs])=>({[spec.groupBy]:k,count:rs.length,...aggregate(rs)}))}
 const sortKey=spec.groupBy?(spec.sortBy===spec.groupBy||spec.sortBy==='count'?spec.sortBy:'count'):spec.sortBy;
 if(sortKey)results.sort((a,b)=>{const av=a[sortKey]??'',bv=b[sortKey]??'';const c=typeof av==='number'&&typeof bv==='number'?av-bv:String(av).localeCompare(String(bv));return spec.direction==='desc'?-c:c});
 return {rows:results,count:rows.length,totals:aggregate(rows)};
}
export const reportTemplate=(source='iso'):R=>({kind:'report',name:'Custom report',source,columns:Object.keys(reportFields[source]).slice(0,6),filters:[],metrics:[],groupBy:'',sortBy:'name',direction:'asc',from:'',to:'',year:String(new Date().getFullYear())});
export function standardReports(){return [
 {...reportTemplate('iso'),name:'ISO profitability',columns:['isoNumber','name','owner','company','status','sales','cost','gp','margin'],metrics:[{field:'sales',op:'sum'},{field:'gp',op:'sum'}]},
 {...reportTemplate('iso'),name:'Recorded ISOs below 10% GP',columns:['isoNumber','name','owner','sales','gp','margin'],filters:[{field:'margin',op:'lt',value:'10'},{field:'status',op:'eq',value:'Recorded'}]},
 {...reportTemplate('lead'),name:'Open pipeline by salesperson',groupBy:'owner',filters:[{field:'stage',op:'neq',value:'Won'},{field:'stage',op:'neq',value:'Lost'}],metrics:[{field:'value',op:'sum'}]},
 {...reportTemplate('team'),name:'Sales performance & quotas',columns:['name','status','quota','won','attainment','open','orders','isoSales','gp'],metrics:[{field:'won',op:'sum'},{field:'isoSales',op:'sum'},{field:'gp',op:'sum'}]},
 {...reportTemplate('proposal'),name:'Proposals awaiting approval',columns:['name','company','owner','total','status','createdAt'],filters:[{field:'status',op:'eq',value:'Pending approval'}],metrics:[{field:'total',op:'sum'}]},
 {...reportTemplate('activity'),name:'Activity by salesperson',groupBy:'owner'},
 {...reportTemplate('lead'),name:'Overdue follow-ups',columns:['name','company','owner','stage','followup','value'],filters:[{field:'followup',op:'notempty',value:''},{field:'followup',op:'lt',value:new Date().toISOString().slice(0,10)},{field:'stage',op:'neq',value:'Won'},{field:'stage',op:'neq',value:'Lost'}]}
 ]}
export function csvCell(value:any){let s=String(value??'');if(/^[\s]*[=+\-@\t\r]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"'}
