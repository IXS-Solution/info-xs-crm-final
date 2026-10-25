type Row=Record<string,any>;
const clean=(v:unknown)=>String(v??'').trim();
export function planImport(target:string,rows:Row[],existing:Row[],admin:boolean){
 if(!['contact','company','vendor','product'].includes(target))throw Error('Select a valid import destination');
 if(['vendor','product'].includes(target)&&!admin)throw Error('Owner permission required');
 if(!Array.isArray(rows)||!rows.length||rows.length>200)throw Error('Import between 1 and 200 rows at a time');
 const created:Row[]=[],skipped:number[]=[];
 const records=()=>[...existing,...created];
 const same=(a:unknown,b:unknown)=>clean(a).toLowerCase()===clean(b).toLowerCase();
 for(let index=0;index<rows.length;index++){
  const row=rows[index],name=clean(row.name),email=clean(row.email).toLowerCase();
  if(!name)throw Error(`Row ${index+1}: name is required`);
  if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw Error(`Row ${index+1}: invalid email`);
  if(records().some(r=>r.kind===target&&((email&&same(r.email,email))||(same(r.name,name)&&(target!=='contact'||same(r.companyName||records().find(c=>c.id===r.company)?.name,row.company)))))){skipped.push(index+1);continue;}
  let record:Row={id:crypto.randomUUID(),kind:target,name,email,phone:clean(row.phone),city:clean(row.city),notes:clean(row.notes),source:'File import'};
  if(target==='contact'){
   const companyName=clean(row.company);if(!companyName)throw Error(`Row ${index+1}: company is required`);
   let company=records().find(r=>r.kind==='company'&&same(r.name,companyName));
   if(!company){company={id:crypto.randomUUID(),kind:'company',name:companyName,source:'File import'};created.push(company);}
   record={...record,company:company.id,designation:clean(row.designation),role:'Influencer'};
  }
  if(target==='vendor')record={...record,status:'Active',contactPerson:clean(row.contactPerson)};
  if(target==='product'){
   const price=clean(row.price);if(price&&(!Number.isFinite(Number(price))||Number(price)<0))throw Error(`Row ${index+1}: invalid price`);
   const vendor=clean(row.vendor)?records().find(r=>r.kind==='vendor'&&same(r.name,row.vendor)):null;
   if(clean(row.vendor)&&!vendor)throw Error(`Row ${index+1}: register vendor "${row.vendor}" first`);
   record={...record,type:'Product',brand:clean(row.brand),category:clean(row.category),sku:clean(row.sku),description:clean(row.description),price:price?Number(price):null,unit:clean(row.unit)||'Each',vendor:vendor?.id||''};
  }
  created.push(record);
 }
 return {created,skipped};
}
