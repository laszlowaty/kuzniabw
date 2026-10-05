import {assessAffixes} from './strong-combos.js';
import {assessProfileAffixes} from './profile-affixes.js';

export function sortResults(results,order,profile,details,catalog,inventory=[]){
 const profileRanks=new Map(),generalRanks=new Map();
 const profileAssessment=item=>{if(!profileRanks.has(item))profileRanks.set(item,assessProfileAffixes(item,profile,details,catalog,inventory));return profileRanks.get(item);};
 const generalAssessment=item=>{if(!generalRanks.has(item))generalRanks.set(item,assessAffixes(item,details,{},inventory));return generalRanks.get(item);};
 return [...results].sort((a,b)=>{
  if(order==='best'){
   return (profile?.tattoo||profile?.race?profileAssessment(b).rank-profileAssessment(a).rank||Number(profileAssessment(b).compatible)-Number(profileAssessment(a).compatible)||profileAssessment(b).totalScore-profileAssessment(a).totalScore:0)||generalAssessment(b).rank-generalAssessment(a).rank||generalAssessment(b).totalScore-generalAssessment(a).totalScore||a.steps-b.steps;
  }
  if(order==='most')return b.steps-a.steps;
  return a.steps-b.steps;
 });
}
