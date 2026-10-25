// Test-only adapter: route handlers run in real workerd/D1; Next supplies these in production.
import {AsyncLocalStorage} from 'node:async_hooks';
export const requests=new AsyncLocalStorage();
export async function cookies(){const request=requests.getStore();return {get(name){const value=request.headers.get('cookie')?.split(';').map(s=>s.trim()).find(s=>s.startsWith(name+'='))?.slice(name.length+1);return value?{value}:undefined}}}
