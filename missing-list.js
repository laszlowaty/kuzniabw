import {ingredients,itemName,resultKey} from './engine.js';

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
