import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseContactRows,planContactImport} from '../lib/contact-import.ts';
import {normalizeStaffEmail} from '../lib/account-policy.ts';
import {hashPassword,verifyPassword,validatePassword,digest,randomToken} from '../lib/auth/crypto.ts';
const existing=[{id:'company',kind:'company',name:'Example Ltd'},{id:'contact',kind:'contact',name:'Existing',company:'company',email:'existing@example.com'}];
test('staff domain policy rejects external and deceptive domains',()=>{
 assert.equal(normalizeStaffEmail(' INFO@INFO-XS.COM '),'info@info-xs.com');
 for(const email of ['a@example.com','a@info-xs.com.evil.test','a@sub.info-xs.com','a..b@info-xs.com'])assert.throws(()=>normalizeStaffEmail(email));
});
test('passwords use distinct salts and verify without accepting a wrong password',async()=>{
 const a=await hashPassword('a secure test password');const b=await hashPassword('a secure test password');assert.notEqual(a,b);assert.ok(await verifyPassword('a secure test password',a));assert.equal(await verifyPassword('wrong',a),false);assert.throws(()=>validatePassword('short'));assert.throws(()=>validatePassword('a'.repeat(129)));assert.notEqual(await digest(randomToken()),await digest(randomToken()));
});
test('Excel rows normalize headers and preserve textual phone numbers',()=>{
 const r=parseContactRows([[' Name ','COMPANY','phone'],['Alice','Example Ltd','03001234567'],['','','']]);assert.equal(r.length,1);assert.equal(r[0].phone,'03001234567');assert.throws(()=>parseContactRows([['name'],['Alice']]));
});
test('import resolves companies case-insensitively and validates duplicate emails',()=>{
 const plan=planContactImport([{name:'New',company:'example ltd',email:'NEW@example.com'},{name:'Other',company:'Example Ltd',email:'new@example.com'},{name:'Existing',company:'Example Ltd',email:'existing@example.com'}],existing);
 assert.equal(plan.contacts.length,1);assert.equal(plan.contacts[0].company,'company');assert.equal(plan.errors.length,2);assert.equal(plan.errors[0].row,3);
});
test('new company creation requires opt-in and reuses the same company within a workbook',()=>{
 const rows=[{name:'A',company:'New Ltd'},{name:'B',company:'new ltd'}];assert.equal(planContactImport(rows,existing).errors.length,2);
 const p=planContactImport(rows,existing,true);assert.equal(p.errors.length,0);assert.equal(p.companies.length,1);assert.equal(p.contacts[0].company,p.contacts[1].company);
});
test('import rejects malformed email, invalid roles, oversized imports, ambiguous companies and overlong cells',()=>{
 assert.throws(()=>planContactImport(Array(501).fill({}),[]));
 const p=planContactImport([{name:'A',company:'Example Ltd',email:'bad'},{name:'B',company:'Example Ltd',role:'Administrator'},{name:'a'.repeat(2001),company:'Example Ltd'}],existing);assert.equal(p.errors.length,3);
 assert.equal(planContactImport([{name:'A',company:'Example Ltd'}],[...existing,{id:'another',kind:'company',name:'Example Ltd'}]).errors.length,1);
});
test('a real Excel workbook parses into valid importable contacts',async()=>{
 const {readSheet}=await import('read-excel-file/node');const sheet=await readSheet('tests/fixtures/contacts.xlsx');const rows=parseContactRows(sheet);assert.equal(rows[0].phone,'03001234567');assert.equal(planContactImport(rows,existing).errors.length,0);
});
