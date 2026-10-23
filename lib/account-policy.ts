export const STAFF_EMAIL_DOMAIN='info-xs.com';
export function normalizeStaffEmail(value:unknown):string {
 const email=String(value??'').trim().toLowerCase();
 if(!/^[a-z0-9](?:[a-z0-9._%+-]*[a-z0-9])?@info-xs\.com$/.test(email)||email.split('@')[0].includes('..'))throw new Error('CRM usernames must be valid @info-xs.com email addresses, for example hanfi@info-xs.com.');
 return email;
}
export function isStaffEmail(value:unknown):boolean {try{normalizeStaffEmail(value);return true}catch{return false}}
