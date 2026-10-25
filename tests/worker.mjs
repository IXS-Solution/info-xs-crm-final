import * as auth from '../app/api/auth/[action]/route.ts';
import * as users from '../app/api/users/route.ts';
import * as contacts from '../app/api/contacts/import/route.ts';
import * as crm from '../app/api/crm/route.ts';
import {requests} from './headers.mjs';
export default {fetch(req){return requests.run(req,()=>{const p=new URL(req.url).pathname;if(p.startsWith('/api/auth/'))return auth.POST(req,{params:Promise.resolve({action:p.split('/').pop()})});if(p==='/api/users')return req.method==='GET'?users.GET():users.POST(req);if(p==='/api/contacts/import')return contacts.POST(req);if(p==='/api/crm')return crm.GET();return new Response('Missing',{status:404})})}};
