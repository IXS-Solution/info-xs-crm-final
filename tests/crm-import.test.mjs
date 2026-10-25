import test from 'node:test';
import assert from 'node:assert/strict';
import {planImport} from '../lib/import-records.ts';
import {contactsFromText} from '../lib/contact-extraction.ts';
test('contacts create one shared company and skip duplicate contacts',()=>{
 const plan=planImport('contact',[{name:'Ali',company:'Acme',email:'ali@acme.test'},{name:'Sara',company:'ACME'},{name:'Ali',company:'Acme',email:'ali@acme.test'}],[],false);
 assert.equal(plan.created.filter(r=>r.kind==='company').length,1);assert.equal(plan.created.filter(r=>r.kind==='contact').length,2);assert.deepEqual(plan.skipped,[3]);
 const contacts=plan.created.filter(r=>r.kind==='contact');assert.equal(contacts[0].company,contacts[1].company);
});
test('existing matching names are scoped to the customer company',()=>{
 const old=[{id:'c1',kind:'company',name:'Acme'},{id:'c2',kind:'company',name:'Other'},{kind:'contact',name:'Ali',company:'c1'}];
 const plan=planImport('contact',[{name:'ALI',company:'ACME'},{name:'Ali',company:'Other'}],old,false);assert.equal(plan.created.length,1);assert.equal(plan.created[0].company,'c2');assert.deepEqual(plan.skipped,[1]);
});
test('validation rejects a whole plan before any write',()=>{
 assert.throws(()=>planImport('contact',[{name:'Ali',company:'Acme'},{name:'Sara'}],[],true),/Row 2: company/);
 assert.throws(()=>planImport('vendor',[{name:'Vendor'}],[],false),/Owner permission/);
 assert.throws(()=>planImport('product',[{name:'Server',price:-1}],[],true),/invalid price/);
 assert.throws(()=>planImport('company',[{name:'Acme',email:'broken'}],[],true),/invalid email/);
 assert.throws(()=>planImport('company',Array(201).fill({name:'X'}),[],true),/200/);
});
test('products preserve quote-required pricing and validate vendor names',()=>{
 const plan=planImport('product',[{name:'Server',vendor:'Vendor'}],[{kind:'vendor',id:'v1',name:'Vendor'}],true);assert.equal(plan.created[0].vendor,'v1');assert.equal(plan.created[0].price,null);
 assert.throws(()=>planImport('product',[{name:'Server',vendor:'Missing'}],[],true),/register vendor/);
});
test('visiting card extraction keeps original text and extracts contact details',()=>{
 const text='Ali Khan\nAcme Ltd\nali@acme.test\n+92 300 1234567';const [row]=contactsFromText(text);assert.equal(row.name,'Ali Khan');assert.equal(row.company,'Acme Ltd');assert.equal(row.email,'ali@acme.test');assert.equal(row.phone,'+92 300 1234567');assert.equal(row.notes,text);
});
