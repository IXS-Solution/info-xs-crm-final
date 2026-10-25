'use client';
import {useState} from 'react';
import {aliases,contactsFromText,headerKey,importFields} from '../../lib/contact-extraction';
type R=Record<string,any>;
async function recognize(image:File|HTMLCanvasElement,status:(s:string)=>void){
 const {createWorker}=await import('tesseract.js');
 const worker=await createWorker('eng',1,{workerPath:'/ocr/worker.min.js',corePath:'/ocr/core',langPath:'/ocr/lang',logger:m=>status(m.status+(m.progress?' '+Math.round(m.progress*100)+'%':''))});
 try{return (await worker.recognize(image)).data.text}finally{await worker.terminate()}
}
async function pdfText(file:File,status:(s:string)=>void){
 const pdfjs=await import('pdfjs-dist');pdfjs.GlobalWorkerOptions.workerSrc='/ocr/pdf.worker.min.mjs';
 const task=pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer())});const doc=await task.promise;
 try{if(doc.numPages>20)throw Error('Import up to 20 PDF pages at a time');const pages=[];
 for(let i=1;i<=doc.numPages;i++){status(`Reading PDF page ${i} of ${doc.numPages}`);const page=await doc.getPage(i),content=await page.getTextContent();let text='';
 for(const item of content.items){if('str' in item)text+=item.str+(item.hasEOL?'\n':' ');}
 if(text.trim().length<10){const viewport=page.getViewport({scale:1.5}),canvas=document.createElement('canvas');canvas.width=viewport.width;canvas.height=viewport.height;await page.render({canvas,canvasContext:canvas.getContext('2d')!,viewport}).promise;text=await recognize(canvas,status);}
 pages.push(text)}return pages.join('\n\n');}finally{await task.destroy()}
}
export function DataImporter({admin,onSaved}:{admin:boolean,onSaved:()=>Promise<void>}){
 const [target,setTarget]=useState('contact'),[mode,setMode]=useState('file'),[headers,setHeaders]=useState<string[]>([]),[source,setSource]=useState<string[][]>([]),[mapping,setMapping]=useState<Record<string,string>>({}),[rows,setRows]=useState<R[]>([]),[busy,setBusy]=useState(false),[status,setStatus]=useState(''),[error,setError]=useState(''),[result,setResult]=useState(''),[raw,setRaw]=useState('');
 const fields=importFields[target];
 function reset(){setRows([]);setHeaders([]);setSource([]);setMapping({});setError('');setResult('');setRaw('')}
 async function read(file:File){setBusy(true);reset();setStatus('Reading file…');try{
 if(file.size>10*1024*1024)throw Error('Maximum import file size is 10 MB');const ext=file.name.split('.').pop()?.toLowerCase();
 if(mode==='card'||ext==='pdf'){
 if(mode==='card'&&!['png','jpg','jpeg','webp'].includes(ext||''))throw Error('Choose a PNG, JPEG or WebP visiting-card image');
 const text=ext==='pdf'?await pdfText(file,setStatus):await recognize(file,setStatus);setRaw(text);
 const drafts=contactsFromText(text);setRows(drafts.map(r=>target==='vendor'?{...r,name:r.company,contactPerson:r.name}:r));
 }else{
 let grid:unknown[][];
 if(ext==='xlsx'){const {readSheet}=await import('read-excel-file/browser');grid=await readSheet(file);}
 else if(ext==='csv'){const {default:Papa}=await import('papaparse');const parsed=Papa.parse<string[]>(await file.text(),{skipEmptyLines:'greedy'});if(parsed.errors.length)throw Error('CSV error: '+parsed.errors[0].message);grid=parsed.data;}
 else throw Error('Choose an .xlsx, .csv or .pdf file');
 if(grid.length<2)throw Error('The first row must contain headers, followed by data rows');if(grid.length>201)throw Error('Import up to 200 rows at a time');
 const h=grid[0].map((v,i)=>String(v||'Column '+(i+1)));setHeaders(h);setSource(grid.slice(1).map(row=>h.map((_,i)=>String(row[i]??''))));
 const map:Record<string,string>={};for(const field of fields){const index=h.findIndex(x=>aliases[field]?.includes(headerKey(x)));if(index>=0)map[field]=String(index)}setMapping(map);
 }
 setStatus('Review the extracted data before saving.');
 }catch(e:any){setError(e.message||'Could not read this file')}finally{setBusy(false)}}
 function sample(){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([fields.join(',')+'\n'+fields.map(f=>f==='name'?'Example name':f==='company'?'Example company':'').join(',')+'\n'],{type:'text/csv'}));a.download=target+'-import-template.csv';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
 return <div className="padded"><h2>Import data & scan visiting cards</h2><p className="muted">Import Excel (.xlsx), CSV and PDF files, or scan a customer or vendor card. Extraction runs in your browser. Review every field; scanned names and company names may need correction. English OCR is supported.</p><div className="form-grid"><label>Destination<select disabled={busy} value={target} onChange={e=>{setTarget(e.target.value);setMode('file');reset()}}><option value="contact">Customer contacts</option><option value="company">Customer companies</option>{admin&&<><option value="vendor">Vendors</option><option value="product">Products</option></>}</select></label><label>Input method<select disabled={busy} value={mode} onChange={e=>{setMode(e.target.value);reset()}}><option value="file">Excel / CSV / PDF</option>{['contact','vendor'].includes(target)&&<option value="card">Scan visiting card</option>}</select></label><label>{mode==='card'?'Take a photo or choose a card image':'Choose a file (10 MB maximum)'}<input key={target+mode} disabled={busy} type="file" accept={mode==='card'?'image/png,image/jpeg,image/webp':'.xlsx,.csv,.pdf'} capture={mode==='card'?'environment':undefined} onChange={e=>{if(e.target.files?.[0])void read(e.target.files[0]);e.target.value=''}}/></label><div><button onClick={sample}>Download CSV template</button></div></div>{busy&&<p role="status">{status}</p>}{error&&<p className="error" role="alert">{error}</p>}{result&&<p className="notice" role="status">{result}</p>}
 {headers.length>0&&<><h3>Match columns</h3><p className="muted">Map your file headers to CRM fields. Name is required; customer contacts also require a company.</p><div className="form-grid">{fields.map(f=><label key={f}>{f}<select value={mapping[f]??''} onChange={e=>setMapping({...mapping,[f]:e.target.value})}><option value="">Do not import</option>{headers.map((h,i)=><option key={i} value={i}>{h}</option>)}</select></label>)}</div><button disabled={!mapping.name||target==='contact'&&!mapping.company} onClick={()=>setRows(source.map(row=>Object.fromEntries(fields.map(f=>[f,mapping[f]!==undefined&&mapping[f]!==''?row[Number(mapping[f])]:'']))))}>Preview {source.length} rows</button></>}
 {raw&&<details><summary>Extracted text</summary><pre className="extracted-text">{raw}</pre><p>PDF records are separated by blank lines. Adjust the rows below before saving.</p></details>}
 {rows.length>0&&<><h3>Review {rows.length} records</h3><p className="muted">Existing records with the same email, or the same name and company, are skipped. New customer companies are created automatically. No existing records are overwritten.</p><div className="tablewrap import-table"><table><thead><tr>{fields.map(f=><th key={f}>{f}</th>)}<th>Remove</th></tr></thead><tbody>{rows.map((row,i)=><tr key={i}>{fields.map(f=><td key={f}><input aria-label={`Row ${i+1} ${f}`} value={row[f]||''} onChange={e=>setRows(rows.map((r,j)=>i===j?{...r,[f]:e.target.value}:r))}/></td>)}<td><button disabled={busy} onClick={()=>setRows(rows.filter((_,j)=>i!==j))}>Remove</button></td></tr>)}</tbody></table></div><div className="actions"><button disabled={busy} onClick={()=>setRows([...rows,{}])}>Add row</button><button className="primary" disabled={busy||rows.some(r=>!r.name?.trim()||target==='contact'&&!r.company?.trim())} onClick={async()=>{setBusy(true);setError('');try{const res=await fetch('/api/crm',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'import',target,rows})});const j=await res.json() as R;if(!res.ok)throw Error(j.error);setResult(`Imported ${j.created} records${j.companies?` and ${j.companies} customer companies`:''}. Skipped ${j.skipped.length} duplicates.`);setRows([]);setHeaders([]);setRaw('');await onSaved()}catch(e:any){setError(e.message)}finally{setBusy(false)}}}>{busy?'Saving…':'Confirm import'}</button></div></>}
 </div>
}
