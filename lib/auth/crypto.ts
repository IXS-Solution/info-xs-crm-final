const encoder = new TextEncoder();
export const randomToken = () => Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, '0')).join('');
export async function digest(value: string) {
 return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value))), b => b.toString(16).padStart(2, '0')).join('');
}
export function validatePassword(password: unknown): asserts password is string {
 if(typeof password !== 'string' || password.length < 12 || password.length > 128) throw new Error('Use a password between 12 and 128 characters.');
}
export async function hashPassword(password: string, salt = randomToken()) {
 const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
 const bits = await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:encoder.encode(salt),iterations:100000},key,256);
 return `pbkdf2$100000$${salt}$${Array.from(new Uint8Array(bits),b=>b.toString(16).padStart(2,'0')).join('')}`;
}
export async function verifyPassword(password: string, stored: string) {
 const parts=stored.split('$');
 if(parts.length!==4 || parts[0]!=='pbkdf2' || parts[1]!=='100000') return false;
 const actual=await hashPassword(password,parts[2]);let diff=actual.length^stored.length;
 for(let i=0;i<actual.length;i++) diff|=actual.charCodeAt(i)^(stored.charCodeAt(i)||0);
 return diff===0;
}
