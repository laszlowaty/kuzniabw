import {isStrongCombo} from './strong-combos.js';

export function sortResults(results,order){
 return [...results].sort((a,b)=>{
  if(order==='best')return Number(isStrongCombo(b))-Number(isStrongCombo(a))||a.steps-b.steps;
  if(order==='most')return b.steps-a.steps;
  return a.steps-b.steps;
 });
}
