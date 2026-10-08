import {ingredients,itemName,resultKey,label} from './engine.js';

// Plans are alternatives: keep the largest quantity needed by a single plan.
export function missingItemList(plans){
 const items=new Map();
 for(const plan of plans){
  const quantities=new Map();
  for(const item of ingredients(plan).filter(item=>item.missing)){
   const key=resultKey(item),entry=quantities.get(key);
   if(entry)entry.quantity++;
   else quantities.set(key,{name:itemName(item),quantity:1});
  }
  for(const [key,entry] of quantities){
   const previous=items.get(key);
   if(!previous||entry.quantity>previous.quantity)items.set(key,entry);
  }
 }
 return [...items.values()].sort((a,b)=>a.name.localeCompare(b.name,'pl'));
}

export function missingListText(items){
 return items.map(({quantity,name})=>`${quantity} - ${name}`).join('\n');
}

// Use canonical affixes, not the gendered prefix in the full item name.
export function missingAffixList(plans,axis){
 if(axis!=='prefix'&&axis!=='suffix')throw new RangeError('Nieznany rodzaj afiksu.');
 const names=new Set();
 for(const plan of plans)for(const item of ingredients(plan)){
  if(item.missing&&item[axis])names.add(label(item[axis]));
 }
 return [...names].sort((a,b)=>a.localeCompare(b,'pl'));
}
