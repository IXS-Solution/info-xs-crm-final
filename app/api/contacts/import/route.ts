import { currentUser,database,checkOrigin } from '../../../../lib/auth/server';
import { planContactImport } from '../../../../lib/contact-import';
export async function POST(req:Request){try{
 checkOrigin(req);const user=await currentUser();if(!user)return Response.json({error:'Sign in required'},{status:401});
 if(Number(req.headers.get('content-length')||0)>2_000_000)return Response.json({error:'Import is too large'},{status:413});
 const raw=await req.text();if(raw.length>2_000_000)return Response.json({error:'Import is too large'},{status:413});
 const b=JSON.parse(raw);const db=database();const result=await db.prepare('SELECT id,kind,data FROM crm_records WHERE kind IN (\'company\',\'contact\')').all<{id:string,kind:string,data:string}>();
 const plan=planContactImport(b.rows,result.results.map(r=>({...JSON.parse(r.data),id:r.id,kind:r.kind})),b.createCompanies===true);
 if(plan.errors.length)return Response.json({error:'Fix the reported rows before importing. No records were saved.',errors:plan.errors},{status:400});
 const now=new Date().toISOString();
 const records=[...plan.companies,...plan.contacts].map(r=>({...r,createdAt:now,updatedAt:now,updatedBy:user.email}));
 await db.prepare("INSERT INTO crm_records(id,kind,data,version) SELECT json_extract(value,'$.id'),json_extract(value,'$.kind'),value,1 FROM json_each(?)").bind(JSON.stringify(records)).run();
 return Response.json({ok:true,imported:plan.contacts.length,companiesCreated:plan.companies.length});
 }catch(e){return Response.json({error:e instanceof Error?e.message:'Import failed'},{status:400})}}
