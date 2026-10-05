import {assessAffixes} from './strong-combos.js';
import {assessProfileAffixes,itemDefense} from './profile-affixes.js';

export function sortResults(results,order,profile,details,catalog){
 const profileRanks=new Map(),generalRanks=new Map();
 const profileRank=item=>{if(!profileRanks.has(item))profileRanks.set(item,assessProfileAffixes(item,profile,itemDefense(item,details,catalog)).rank);return profileRanks.get(item);};
 const generalRank=item=>{if(!generalRanks.has(item))generalRanks.set(item,assessAffixes(item).rank);return generalRanks.get(item);};
 return [...results].sort((a,b)=>{
  if(order==='best'){
   return (profile?.tattoo?profileRank(b)-profileRank(a):0)||generalRank(b)-generalRank(a)||a.steps-b.steps;
  }
  if(order==='most')return b.steps-a.steps;
  return a.steps-b.steps;
 });
}
