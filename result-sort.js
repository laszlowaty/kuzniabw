import {assessAffixes} from './strong-combos.js';

export function sortResults(results,order){
 return [...results].sort((a,b)=>{
  if(order==='best')return assessAffixes(b).rank-assessAffixes(a).rank||a.steps-b.steps;
  if(order==='most')return b.steps-a.steps;
  return a.steps-b.steps;
 });
}
