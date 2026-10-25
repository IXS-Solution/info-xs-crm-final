type R=Record<string,any>;
export function visibleRecords(records:R[],admin:boolean,member:R){
 if(admin)return records;
 const owns=(r:R)=>r.owner===member.id;
 const companies=new Set(records.filter(r=>r.kind==='company'&&owns(r)).map(r=>r.id));
 const leads=new Set(records.filter(r=>r.kind==='lead'&&owns(r)).map(r=>r.id));
 return records.flatMap(r=>{
  if(r.kind==='team')return r.id===member.id?[{id:r.id,kind:r.kind,name:r.name,email:r.email,status:r.status}]:[];
  if(['product','vendor','template'].includes(r.kind))return [r];
  if(['company','lead','proposal','iso'].includes(r.kind))return owns(r)?[r]:[];
  if(r.kind==='contact')return companies.has(r.company)?[r]:[];
  if(r.kind==='activity')return leads.has(r.lead)?[r]:[];
  return [];
 });
}
export function checkSalesWrite(r:R,old:R|undefined,records:R[],admin:boolean,member:R){
 if(admin)return;
 if(['lead','proposal','iso','company'].includes(r.kind)){
  if(old&&old.owner!==member.id)throw Error('This record belongs to another salesperson');
  if(r.owner&&r.owner!==member.id)throw Error('Cannot assign records to another salesperson');
  r.owner=member.id;
 }
 const company=records.find(x=>x.id===r.company&&x.kind==='company');
 if(['contact','lead','proposal','iso'].includes(r.kind)&&(!company||company.owner!==member.id))throw Error('Select a company in your own working area');
 if(r.kind==='contact'&&old){const original=records.find(x=>x.kind==='company'&&x.id===old.company);if(original?.owner!==member.id)throw Error('Contact access denied');}
 if(r.kind==='activity'){
  const lead=records.find(x=>x.kind==='lead'&&x.id===r.lead);if(lead?.owner!==member.id)throw Error('Lead access denied');
  if(r.contact&&!records.some(x=>x.kind==='contact'&&x.id===r.contact&&x.company===lead?.company))throw Error('Select a contact from this lead’s company');
 }
}
