export type ContactRow={name:string,company:string,email:string,phone:string,designation:string,role:string,whatsapp:string,notes:string};
type Existing={id:string,kind:string,name?:string,email?:string,company?:string};
const text=(v:unknown)=>String(v??'').trim();
export function parseContactRows(rows:unknown[][]):ContactRow[]{
 if(!rows.length)throw Error('The worksheet is empty');
 const headers=rows[0].map(v=>text(v).toLowerCase());
 for(const name of ['name','company'])if(!headers.includes(name))throw Error(`Missing required column: ${name}`);
 const fields=['name','company','email','phone','designation','role','whatsapp','notes'] as const;
 return rows.slice(1).filter(r=>r.some(v=>text(v))).map(row=>Object.fromEntries(fields.map(key=>[key,text(row[headers.indexOf(key)])])) as ContactRow);
}
export function planContactImport(rows:unknown,existing:Existing[],createCompanies=false){
 if(!Array.isArray(rows)||!rows.length||rows.length>500)throw Error('Import between 1 and 500 contacts at a time');
 const errors:{row:number,message:string}[]=[];const contacts:Record<string,unknown>[]=[];const companies:Record<string,unknown>[]=[];
 const byName=new Map<string,Existing[]>();
 for(const c of existing.filter(r=>r.kind==='company')){const k=text(c.name).toLowerCase();byName.set(k,[...(byName.get(k)||[]),c])}
 const duplicates=new Set(existing.filter(r=>r.kind==='contact').map(r=>r.email?`email:${text(r.email).toLowerCase()}`:`name:${text(r.name).toLowerCase()}:${r.company}`));
 rows.forEach((input:unknown,i:number)=>{
  const r=(input&&typeof input==='object'?input:{}) as Record<string,unknown>;const name=text(r.name),company=text(r.company),email=text(r.email).toLowerCase();
  const fail=(message:string)=>errors.push({row:i+2,message});
  if(Object.values(r).some(v=>typeof v!=='string'||v.length>2000)){fail('Cells must be text with at most 2,000 characters');return}
  if(!name||!company){fail('Name and company are required');return}
  if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){fail('Invalid email address');return}
  const role=text(r.role)||'Influencer';if(!['Influencer','Decision Maker','Deal Cracker'].includes(role)){fail('Role must be Influencer, Decision Maker or Deal Cracker');return}
  let matches=byName.get(company.toLowerCase())||[];
  if(matches.length>1){fail('Company name is ambiguous; rename duplicate companies before importing');return}
  if(!matches.length){
   if(!createCompanies){fail(`Company not found: ${company}`);return}
   const c={id:crypto.randomUUID(),kind:'company',name:company};companies.push(c);matches=[c];byName.set(company.toLowerCase(),matches);
  }
  const companyId=matches[0].id;const key=email?`email:${email}`:`name:${name.toLowerCase()}:${companyId}`;
  if(duplicates.has(key)){fail('Duplicate contact in the worksheet or existing CRM');return}duplicates.add(key);
  contacts.push({id:crypto.randomUUID(),kind:'contact',name,company:companyId,email,role,...Object.fromEntries(['phone','whatsapp','designation','notes'].map(k=>[k,text(r[k])]))});
 });
 return {contacts,companies,errors};
}
