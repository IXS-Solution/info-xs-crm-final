import {env} from 'cloudflare:workers';
import {crmContext as context} from '../../../../lib/crm-context';
export const dynamic='force-dynamic';
export async function GET(req:Request){try{
 const c=await context();const id=new URL(req.url).searchParams.get('id');const r=c.records.find((r:any)=>r.id===id&&r.kind==='literature');
 if(!r)return Response.json({error:'Document not found'},{status:404});
 const file=await env.BUCKET?.get(r.storageKey);if(!file)return Response.json({error:'File unavailable'},{status:404});
 return new Response(file.body,{headers:{'Content-Type':r.contentType,'Content-Disposition':`attachment; filename="${r.filename.replace(/[^a-zA-Z0-9._-]/g,'_')}"`,'X-Content-Type-Options':'nosniff','Cache-Control':'private, no-store'}});
 }catch(e:any){return Response.json({error:e.message},{status:403})}}
export async function POST(req:Request){try{
 // Fully consume bounded multipart input before returning; this also protects chunked uploads.
 const maxBody=11*1024*1024;
 if(Number(req.headers.get('content-length')||0)>maxBody)throw Error('Maximum file size is 10 MB');
 const reader=req.body?.getReader();if(!reader)throw Error('Choose a file');
 const chunks:Uint8Array[]=[];let size=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>maxBody){await reader.cancel();throw Error('Maximum file size is 10 MB');}chunks.push(value);}}finally{reader.releaseLock();}
 const form=await new Response(new Blob(chunks as BlobPart[]),{headers:{'Content-Type':req.headers.get('content-type')||''}}).formData();
 const c=await context();if(!c.admin)return Response.json({error:'Owner permission required'},{status:403});
 if(!env.BUCKET)throw Error('Document storage is unavailable');
 const file=form.get('file'),vendor=String(form.get('vendor')||''),product=String(form.get('product')||'');
 if(!(file instanceof File)||!file.size||file.size>10*1024*1024)throw Error('Choose a file up to 10 MB');
 if(!c.records.some((r:any)=>r.kind==='vendor'&&r.id===vendor))throw Error('Select a registered vendor');
 if(product&&!c.records.some((r:any)=>r.kind==='product'&&r.id===product&&r.vendor===vendor))throw Error('Choose a product belonging to this vendor');
 const types:Record<string,string>={pdf:'application/pdf',png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg'};
 const contentType=types[file.name.split('.').pop()?.toLowerCase()||''];if(!contentType)throw Error('Upload a PDF, PNG or JPEG brochure');
 const id=crypto.randomUUID(),storageKey=`literature/${id}`,now=new Date().toISOString();
 const r={id,kind:'literature',name:String(form.get('name')||file.name).slice(0,200),vendor,product,filename:file.name,contentType,size:file.size,storageKey,createdAt:now,updatedAt:now,updatedBy:c.u.email};
 await env.BUCKET.put(storageKey,file.stream(),{httpMetadata:{contentType}});
 try{await c.db.prepare('INSERT INTO crm_records(id,kind,data,version) VALUES(?,?,?,1)').bind(id,r.kind,JSON.stringify(r)).run();}catch(e){await env.BUCKET.delete(storageKey);throw e;}
 return Response.json({ok:true});
 }catch(e:any){return Response.json({error:e.message},{status:400})}}
