import {targetVendorData} from './target-vendor-data';
type R=Record<string,any>;
export const targetVendorImportKey='target-vendors-partnership-v1';
export const targetVendorBrands=targetVendorData.map(v=>v.name);
const normalize=(s:string)=>String(s||'').toLowerCase().replace(/\(distr[ib]*utor\)/g,'').replace(/[^a-z0-9]/g,'');
const aliases:Record<string,string[]>={'Huawei EBG':['Huawei'],'Supermicro':['SuperMicro'],'Avientek':['Avientek (Distributor)','Avientek (Distrbutor)']};
/** One-time seed plan. Reuses vendors and catalogue rows; never overwrites user pricing or existing links. */
export function buildTargetVendorImport(records:R[]){
 const inserts:R[]=[],updates:{record:R,version:number}[]=[];
 const vendorByName=new Map<string,string>();
 for(const source of targetVendorData){
  const {catalogue,...seed}=source;
  const names=[source.name,...(aliases[source.name]||[])].map(normalize);
  const old=records.find(r=>r.kind==='vendor'&&(r.id===source.id||names.includes(normalize(r.name))));
  const vendor:R=old?{...old}:{...seed,sourceVendorName:source.name};
  if(old){for(const [key,value] of Object.entries(seed)){if(!['id','name','kind','status'].includes(key)&&(vendor[key]===undefined||vendor[key]===null||vendor[key]===''))vendor[key]=value;}
   vendor.sourceVendorName=source.name;
   if(JSON.stringify(vendor)!==JSON.stringify(old))updates.push({record:vendor,version:old.version});
  }else inserts.push(vendor);
  vendorByName.set(source.name,vendor.id);
  catalogue.forEach((family,index)=>{
   const id=source.id.replace('target-vendor-','target-product-')+'-'+String(index+1).padStart(3,'0');
   const existing=records.find(r=>r.kind==='product'&&(r.id===id||(normalize(r.name)===normalize(family.name)&&(r.vendor===vendor.id||!r.vendor))));
   if(existing){if(!existing.vendor)updates.push({record:{...existing,vendor:vendor.id},version:existing.version});return}
   const internal=source.vendorType==='Internal services',distributed=source.vendorType==='Distributor';
   inserts.push({id,kind:'product',name:family.name,brand:source.name,vendor:vendor.id,category:family.category,type:family.type,unit:family.type==='Service'?(internal?'Month':'Subscription'):'Each',price:null,priceStatus:'Quote required',sku:'',sourceUrl:source.catalogueUrl,reviewedOn:internal?null:'2026-10-25',catalogueOrigin:internal?'Proposed internal service':distributed?'Distributor portfolio family':'Official product family',description:(internal?'Proposed service scope; agree SLA, service hours, response targets and exclusions.':distributed?'Distributor portfolio family; confirm actual manufacturer, model, regional supply and authorization.':'Product family; select exact model or edition, configuration, licensing and support term.')+' Supplier quote and local availability must be confirmed before commitment.'});
  });
 }
 const brandVendors:Record<string,string>={HP:'HP',H3C:'H3C',Huawei:'Huawei EBG',Microsoft:'Microsoft','Trend Micro':'Trend Micro'};
 for(const p of records.filter(r=>r.kind==='product'&&!r.vendor&&brandVendors[r.brand])){
  if(updates.some(u=>u.record.id===p.id))continue;
  updates.push({record:{...p,vendor:vendorByName.get(brandVendors[p.brand])},version:p.version});
 }
 return {inserts,updates};
}
export async function seedTargetVendors(db:any,records:R[],email:string){
 const installed=await db.prepare('SELECT value FROM crm_config WHERE key=?').bind(targetVendorImportKey).first();if(installed)return false;
 const plan=buildTargetVendorImport(records),now=new Date().toISOString();
 const inserts:R[]=plan.inserts.map((r:R)=>({...r,createdAt:now,updatedAt:now,updatedBy:email}));
 const statements=[...inserts.map(r=>db.prepare('INSERT OR IGNORE INTO crm_records(id,kind,data,version) VALUES(?,?,?,1)').bind(r.id,r.kind,JSON.stringify(r))),...plan.updates.map(({record:r,version})=>db.prepare('UPDATE crm_records SET data=?,version=version+1 WHERE id=? AND version=?').bind(JSON.stringify({...r,updatedAt:now,updatedBy:email}),r.id,version)),db.prepare('INSERT OR IGNORE INTO crm_config(key,value) VALUES(?,?)').bind(targetVendorImportKey,JSON.stringify({installedAt:now,source:'Partneship Certificate Sheet.xlsx',vendorEntries:targetVendorData.length}))];
 await db.batch(statements);return true;
}
