/** Accept common company website input while storing only HTTP(S) URLs. */
export function normalizeWebsite(input: unknown): string {
 const value=String(input??'').trim();
 if(!value)return '';
 if(/\s/.test(value))throw new Error('Website address cannot contain spaces. Example: www.info-xs.com');
 const candidate=value.startsWith('//')?'https:'+value:/^[a-z][a-z0-9+.-]*:/i.test(value)?value:'https://'+value;
 try{const url=new URL(candidate);if(!['http:','https:'].includes(url.protocol)||url.username||url.password||!url.hostname.includes('.')||url.hostname.startsWith('.')||url.hostname.endsWith('.')||url.hostname.includes('..'))throw new Error();return url.href;}
 catch{throw new Error('Enter a valid website, such as info-xs.com, www.info-xs.com or https://www.info-xs.com.');}
}
