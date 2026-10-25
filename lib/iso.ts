export type ISORecord = Record<string, any>;
const amount=(v:any,label:string)=>{if(v===''||v==null)throw Error(label+' is required');const n=Number(v);if(!Number.isFinite(n)||n<0)throw Error(label+' must be a non-negative number');return n};
const pct=(v:any,label:string)=>{const n=amount(v,label);if(n>100)throw Error(label+' cannot exceed 100%');return n};
export function calculateISO(r:ISORecord){
 if(!Array.isArray(r.items)||!r.items.length||r.items.length>200)throw Error('Add between 1 and 200 costing lines');
 const exchangeRate=amount(r.exchangeRate,'Exchange rate');if(!exchangeRate)throw Error('Exchange rate must be greater than zero');
 const items=r.items.map((i:ISORecord)=>{
  if(!String(i.description||'').trim())throw Error('Each line needs a description');
  if(!['Imported','Local','Service'].includes(i.source))throw Error('Select a valid costing source');
  const qty=amount(i.qty,'Quantity');if(!qty)throw Error('Quantity must be greater than zero');
  const unitCost=amount(i.unitCost,'Unit cost'),importPercent=pct(i.importPercent,'Import uplift'),freight=amount(i.freight,'Freight'),taxPercent=pct(i.taxPercent,'Sales tax'),withholdingPercent=pct(i.withholdingPercent,'Withholding'),targetMargin=pct(i.targetMargin,'Target margin'),unitSell=amount(i.unitSell,'Selling price');
  if(targetMargin===100)throw Error('Target margin must be less than 100%');
  const landedUnitCost=unitCost*(i.source==='Imported'?exchangeRate*(1+importPercent/100):1);
  const cost=landedUnitCost*qty+freight,sales=unitSell*qty,tax=sales*taxPercent/100,withholding=sales*withholdingPercent/100,gp=sales-cost-withholding;
  return {...i,qty,unitCost,importPercent,freight,taxPercent,withholdingPercent,targetMargin,unitSell,landedUnitCost,cost,sales,tax,withholding,gp,gpPercent:sales?gp/sales*100:0,suggestedUnitSell:(landedUnitCost+freight/qty)/(1-targetMargin/100)};
 });
 const sum=(k:string)=>items.reduce((a:number,i:ISORecord)=>a+i[k],0);
 const sales=sum('sales'),cost=sum('cost'),tax=sum('tax'),withholding=sum('withholding'),salesPromo=amount(r.salesPromo,'Sales promotion'),advance=amount(r.advance,'Advance'),financePercent=pct(r.financePercent,'Monthly financing rate'),financeMonths=amount(r.financeMonths,'Financing months');
 const guarantee=(key:string)=>{const percent=pct(r[key+'Percent'],key+' percentage'),months=amount(r[key+'Months'],key+' months'),rate=pct(r[key+'Rate'],key+' monthly charge'),cash=pct(r[key+'Cash'],key+' cash cover');const value=(sales+tax)*percent/100;return {value,charge:value*cash/100*rate/100*months}};
 const earnest=guarantee('earnest'),bank=guarantee('bank'),bond=guarantee('bond');
 const financeCharges=Math.max(cost-advance,0)*financePercent/100*financeMonths+earnest.charge+bank.charge+bond.charge;
 const initialGP=sales-cost-withholding,finalGP=initialGP-salesPromo-financeCharges;
 const totals={sales,cost,tax,withholding,total:sales+tax,initialGP,salesPromo,financeCharges,finalGP,finalGPPercent:sales?finalGP/sales*100:0,earnest:earnest.value,bank:bank.value,bond:bond.value};
 if(Object.values(totals).some(n=>!Number.isFinite(n)))throw Error('Costing amounts are too large');
 return {items,totals};
}
export const newISOLine=()=>({description:'',source:'Local',vendor:'',product:'',qty:1,unit:'Each',unitCost:0,importPercent:0,freight:0,targetMargin:10,unitSell:0,taxPercent:0,withholdingPercent:0});
export const newISO=(owner:string)=>({kind:'iso',name:'',company:'',owner,status:'Draft',orderDate:new Date().toISOString().slice(0,10),currency:'USD',exchangeRate:1,items:[newISOLine()],salesPromo:0,advance:0,financePercent:0,financeMonths:0,earnestPercent:0,earnestMonths:0,earnestRate:0,earnestCash:100,bankPercent:0,bankMonths:0,bankRate:0,bankCash:20,bondPercent:0,bondMonths:0,bondRate:0,bondCash:20});
