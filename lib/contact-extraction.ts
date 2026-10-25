export function contactsFromText(text:string){
 const blocks=text.split(/\n\s*\n|\f/).filter(b=>b.trim());
 return blocks.map(block=>{
 const lines=block.split('\n').map(l=>l.trim()).filter(Boolean),email=block.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0]||'',phone=block.match(/\+?\d[\d ()-]{7,}\d/)?.[0]||'';
 const names=lines.filter(l=>!l.includes('@')&&!/\d{3}|https?:|www\./i.test(l));
 return {name:names[0]||'',company:names[1]||'',designation:'',email,phone,notes:block};
 });
}
export const importFields:Record<string,string[]>={contact:['name','company','designation','email','phone','city','notes'],company:['name','email','phone','city','notes'],vendor:['name','contactPerson','email','phone','city','notes'],product:['name','vendor','brand','category','sku','description','price','unit']};
export const aliases:Record<string,string[]>={name:['name','fullname','contactname','companyname','vendorname','productname'],company:['company','organization','organisation','companyname'],designation:['designation','jobtitle','title'],email:['email','emailaddress','emailid'],phone:['phone','telephone','mobile','phonenumber','contactnumber'],contactPerson:['contactperson','contactname'],city:['city','location'],notes:['notes','remarks'],vendor:['vendor','supplier'],brand:['brand','manufacturer'],category:['category'],sku:['sku','model','reference'],description:['description','specifications'],price:['price','unitprice'],unit:['unit']};
export const headerKey=(s:string)=>s.toLowerCase().replace(/[^a-z0-9]/g,'');
