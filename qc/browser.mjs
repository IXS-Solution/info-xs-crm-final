import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
const {chromium}=await import(process.env.CRM_QC_PLAYWRIGHT_MODULE||'playwright');
const base=process.env.CRM_QC_URL||'http://127.0.0.1:5180';if(!base.startsWith('http://127.0.0.1:'))throw Error('Local isolated QA only');
const fixture=JSON.parse(readFileSync('qc/api-load-results.json')).fixtures;
const browser=await chromium.launch({executablePath:process.env.CRM_QC_CHROMIUM||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
const context=await browser.newContext({extraHTTPHeaders:{'oai-authenticated-user-id':'qc-owner','oai-authenticated-user-email':'qc-owner@example.test'},acceptDownloads:true});
const page=await context.newPage(),errors=[],checks=[];page.on('pageerror',e=>errors.push(e.message));
async function check(name,fn){await fn();checks.push(name);console.log('PASS',name)}
async function nav(name){await page.getByRole('button',{name,exact:true}).click()}
try{
const auth={'oai-authenticated-user-id':'qc-owner','oai-authenticated-user-email':'qc-owner@example.test','Content-Type':'application/json'};
const before=await(await fetch(base+'/api/crm',{headers:auth})).json();
for(const record of before.records.filter(r=>r.kind==='contact'&&['csv@qc.test','excel@qc.test','pdf@qc.test','card@qc.test','scanned@qc.test'].includes(r.email)))await fetch(base+'/api/crm',{method:'POST',headers:auth,body:JSON.stringify({record,action:'delete'})});
await page.goto(base);await page.getByRole('heading',{name:'Your sales, in focus.'}).waitFor();
await check('two and three product comparisons and proposal recommendation',async()=>{
 await nav('Product comparison');for(let i=0;i<3;i++)await page.locator('.compare-selectors select').nth(i).selectOption(fixture.products[i]);
 assert.equal(await page.locator('th').filter({hasText:/^QC Product/}).count(),3);assert(await page.getByRole('cell',{name:'3 years',exact:true}).isVisible());
 await page.locator('.compare-selectors select').nth(2).selectOption('');assert.equal(await page.locator('th').filter({hasText:/^QC Product/}).count(),2);
 await page.getByLabel('Client requirements').fill('Reliable hardware within PKR 300');await page.getByLabel('Recommended offering').selectOption(fixture.products[0]);await page.getByLabel('Reason for recommendation').fill('Matches the required workload and budget');await page.getByRole('button',{name:'Create proposal with recommendation'}).click();
 assert.match(await page.getByLabel('Executive summary / scope').inputValue(),/Matches the required workload/);assert.match(await page.getByLabel('Description for line 1',{exact:true}).inputValue(),/QC Product 1/);await page.getByRole('button',{name:'Cancel',exact:true}).click();
});
await check('CSV parsing, column mapping, review and persistent import',async()=>{
 await nav('Import & scan');await page.locator('input[type=file]').setInputFiles({name:'contacts.csv',mimeType:'text/csv',buffer:Buffer.from('name,company,email,notes\nCSV Person,CSV Company,csv@qc.test,"Contains a comma, correctly quoted"\n')});await page.getByRole('button',{name:'Preview 1 rows'}).click();assert.equal(await page.getByLabel('Row 1 notes').inputValue(),'Contains a comma, correctly quoted');await page.getByRole('button',{name:'Confirm import'}).click();await page.getByRole('status').filter({hasText:'Imported 1 records'}).waitFor();
});
await check('Excel .xlsx parsing and saving',async()=>{
 await page.locator('input[type=file]').setInputFiles('/tmp/crm-qc-fixtures/contacts.xlsx');await page.getByRole('button',{name:'Preview 1 rows'}).click();assert.equal(await page.getByLabel('Row 1 name').inputValue(),'Excel Person');await page.getByRole('button',{name:'Confirm import'}).click();await page.getByRole('status').filter({hasText:'Imported 1 records'}).waitFor();
});
await check('PDF text extraction and editable preview',async()=>{
 await page.locator('input[type=file]').setInputFiles('/tmp/crm-qc-fixtures/contacts.pdf');await page.getByLabel('Row 1 name').waitFor();assert.equal(await page.getByLabel('Row 1 email').inputValue(),'pdf@qc.test');await page.getByLabel('Row 1 company').fill('PDF Company');await page.getByRole('button',{name:'Confirm import'}).click();await page.getByRole('status').filter({hasText:'Imported 1 records'}).waitFor();
});
await check('visiting card OCR from a real image using local assets',async()=>{
 const image=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=1200;c.height=600;const x=c.getContext('2d');x.fillStyle='white';x.fillRect(0,0,c.width,c.height);x.fillStyle='black';x.font='40px Arial';['Card Person','Card Company','card@qc.test','+92 300 1234567'].forEach((t,i)=>x.fillText(t,60,100+i*100));return c.toDataURL().split(',')[1]});
 await page.getByLabel('Input method').selectOption('card');await page.locator('input[type=file]').setInputFiles({name:'card.png',mimeType:'image/png',buffer:Buffer.from(image,'base64')});await page.getByLabel('Row 1 name').waitFor({timeout:120000});assert.equal(await page.getByLabel('Row 1 email').inputValue(),'card@qc.test');await page.getByLabel('Row 1 company').fill('Card Company');await page.getByRole('button',{name:'Confirm import'}).click();await page.getByRole('status').filter({hasText:'Imported 1 records'}).waitFor();
});
await check('scanned PDF fallback renders the page and runs OCR',async()=>{
 await page.getByLabel('Input method').selectOption('file');await page.locator('input[type=file]').setInputFiles('/tmp/crm-qc-fixtures/scanned.pdf');await page.getByLabel('Row 1 email').waitFor({timeout:120000});assert.equal(await page.getByLabel('Row 1 email').inputValue(),'scanned@qc.test');await page.getByLabel('Row 1 name').fill('Scanned Person');await page.getByLabel('Row 1 company').fill('Scanned Company');await page.getByRole('button',{name:'Confirm import'}).click();await page.getByRole('status').filter({hasText:'Imported 1 records'}).waitFor();
});
await check('vendor brochure list and proposal attachment selection',async()=>{
 await nav('Vendors');await page.getByLabel('Select vendor catalogue').selectOption(fixture.vendor);assert(await page.getByRole('link',{name:'QC Brochure',exact:true}).isVisible());
 await page.getByLabel('Document title').fill('QC UI uploaded brochure '+Date.now());const uploadedName=await page.getByLabel('Document title').inputValue();await page.locator('.literature input[type=file]').setInputFiles('/tmp/crm-qc-fixtures/contacts.pdf');await page.getByRole('button',{name:'Upload brochure',exact:true}).click();await page.getByRole('link',{name:uploadedName,exact:true}).waitFor();
 await nav('Proposals');await page.getByRole('button',{name:'Create proposal',exact:true}).click();await page.getByLabel('Partner for line 1').selectOption('Info-XS');await page.getByLabel('Product for line 1',{exact:true}).selectOption(fixture.products[0]);const row=page.locator('label.check-row').filter({hasText:'QC Brochure'});await row.getByRole('checkbox').check();assert(await row.getByRole('checkbox').isChecked());await page.getByRole('button',{name:'Cancel',exact:true}).click();
});
await check('approved proposal package contains proposal and original brochure',async()=>{
 await page.getByRole('button',{name:'QC Proposal',exact:true}).click();const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Download proposal & brochures (ZIP)'}).click();const download=await downloadPromise;const {unzipSync,strFromU8}=await import('fflate');const files=unzipSync(readFileSync(await download.path()));assert(files['Proposal.html']);assert.match(strFromU8(files['Proposal.html']),/QC Proposal/);assert.match(strFromU8(files[Object.keys(files).find(f=>f.startsWith('Brochures/'))]),/QC brochure content/);await page.getByRole('button',{name:'Print / save PDF'}).waitFor();await page.keyboard.press('Escape');
});
await check('mobile layout has no page overflow',async()=>{
 // Close detail with the visible header close control.
 await page.locator('.detail-overlay .modal-head .icon-button').click();await page.setViewportSize({width:390,height:844});await nav('Product comparison');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth),false);
});
assert.deepEqual(errors,[]);writeFileSync('qc/browser-results.json',JSON.stringify({testedAt:new Date().toISOString(),checks,pageErrors:errors},null,2)+'\n');
}finally{await browser.close()}
