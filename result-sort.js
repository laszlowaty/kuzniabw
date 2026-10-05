import {assessAffixes} from './strong-combos.js';
import {assessProfileAffixes} from './profile-affixes.js';

export function sortResults(results,order,profile){
 return [...results].sort((a,b)=>{
  if(order==='best'){
   const assess=profile?.tattoo||profile?.race?item=>assessProfileAffixes(item,profile):assessAffixes;
   return assess(b).rank-assess(a).rank||assessAffixes(b).rank-assessAffixes(a).rank||Number(assess(b).raceAffinity)-Number(assess(a).raceAffinity)||a.steps-b.steps;
  }
  if(order==='most')return b.steps-a.steps;
  return a.steps-b.steps;
 });
}
