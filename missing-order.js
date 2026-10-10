import {ingredients} from './engine.js';

// Count only purchases, including repeated copies; tiers are not market prices.
export function missingPlanStats(plan,data){
 const missing=ingredients(plan).filter(item=>item.missing);
 let sum=0,highest=0;
 for(const item of missing){
  const category=data.categories.find(c=>c.id===item.category);
  for(const axis of ['prefix','suffix']){
   const tier=item[axis]?(category?.axes[axis]?.values.indexOf(item[axis])??-1)+1:0;
   sum+=tier;highest=Math.max(highest,tier);
  }
 }
 return {sum,highest,count:missing.length,steps:plan.steps};
}

export function sortMissingPlans(plans,stats,order='tiers'){
 return [...plans].sort((a,b)=>{
  const x=stats.get(a),y=stats.get(b);
  const owned=Number(x.count>0)-Number(y.count>0);
  const tiers=x.sum-y.sum||x.highest-y.highest;
  if(order==='missing')return owned||x.count-y.count||tiers||x.steps-y.steps;
  if(order==='steps')return owned||x.steps-y.steps||x.count-y.count||tiers;
  return owned||tiers||x.count-y.count||x.steps-y.steps;
 });
}
