import {itemClass,itemName,merge,resultKey,ingredients,explore} from './engine.js';

const signature=n=>`${resultKey(n)}|${itemClass(n)}`;
const sameName=(a,b)=>resultKey(a)===resultKey(b);
const matchesTarget=(item,target)=>item.category===target.category&&item.rarity===target.rarity&&(!target.base||item.base===target.base)&&item.prefix===target.prefix&&item.suffix===target.suffix;

export function createGoalTarget(data,categoryId,base,prefix='',suffix=''){
 const category=data.categories.find(c=>c.id===categoryId);
 if(!category||base&&!category.axes.base.values.includes(base)||prefix&&!category.axes.prefix?.values.includes(prefix)||suffix&&!category.axes.suffix?.values.includes(suffix))throw new Error('Wybierz kategorię oraz przedmiot i afiksy z tej samej kategorii.');
 const target={category:categoryId,base,prefix,suffix,rarity:'normal'};
 return {...target,original:itemName(target)};
}

// Lazily invert each known ingredient row once per search. The index retains
// only table strings, never candidate items or recipe trees, and is bounded by
// the size of the category tables (not the number of search attempts).
function createComplements(category,pulse){
 const axes=new Map();
 function* axisComplements(target,known,axis){
  const table=category.axes[axis];
  if(!table){if(!target[axis]&&!known[axis])yield '';return;}
  if(axis!=='base'&&!target[axis]){yield '';return;}
  if(axis!=='base'&&!known[axis])return;
  let index=axes.get(axis);
  if(!index){index={order:new Map(table.values.map((value,i)=>[value,i])),blocked:new Set(table.blocked),rows:new Map()};axes.set(axis,index);}
  let row=index.rows.get(known[axis]);
  if(!row){
   row={byResult:new Map(),any:[]};
   for(const value of table.values){
    if(pulse())return;
    const pair=index.order.get(known[axis])<=index.order.get(value)?`${known[axis]}|${value}`:`${value}|${known[axis]}`;
    const result=table.table[`${known[axis]}|${value}`];
    if(!result||index.blocked.has(pair))continue;
    if(!row.byResult.has(result))row.byResult.set(result,[]);
    row.byResult.get(result).push(value);row.any.push(value);
   }
   index.rows.set(known[axis],row);
  }
  const values=axis==='base'&&!target[axis]?row.any:row.byResult.get(target[axis])||[];
  for(const value of values){if(pulse())return;yield value;}
 }
 return function* complements(target,known){
  for(const base of axisComplements(target,known,'base'))
   for(const prefix of axisComplements(target,known,'prefix'))
    for(const suffix of axisComplements(target,known,'suffix')){
     if(pulse())return;
     yield {category:category.id,rarity:known.rarity,base,prefix,suffix};
    }
 };
}

function newIngredient(shape,id){
 const n={...shape,id,missing:true};
 return {...n,original:`${itemName(n)} (+1)`};
}

function diversePlans(plans,limit){
 if(!plans.length||limit<=1)return plans.slice(0,limit);
 const priority=plan=>{const leaves=ingredients(plan),missing=leaves.filter(item=>item.missing);return `${missing.length}|${leaves.length-missing.length}|${plan.steps}`;};
 const bestPriority=priority(plans[0]),remaining=plans.filter(plan=>priority(plan)===bestPriority),otherPlans=plans.filter(plan=>priority(plan)!==bestPriority),selected=[],diverseLimit=Math.min(limit,20),seen={base:new Set(),prefix:new Set(),suffix:new Set(),pair:new Set(),item:new Set()};
 while(remaining.length&&selected.length<diverseLimit){
  let bestIndex=0,bestScore=-1;
  for(let index=0;index<remaining.length;index++){
   const missing=ingredients(remaining[index]).filter(item=>item.missing);
   const values={base:new Set(missing.map(item=>item.base)),prefix:new Set(missing.map(item=>item.prefix).filter(Boolean)),suffix:new Set(missing.map(item=>item.suffix).filter(Boolean)),pair:new Set(missing.map(item=>`${item.prefix}|${item.suffix}`))};
   const score=[...values.prefix].filter(value=>!seen.prefix.has(value)).length*12+
    [...values.suffix].filter(value=>!seen.suffix.has(value)).length*12+
    [...values.pair].filter(value=>!seen.pair.has(value)).length*5+
    [...values.base].filter(value=>!seen.base.has(value)).length*2+
    missing.filter(item=>!seen.item.has(signature(item))).length*8;
   if(score>bestScore){bestScore=score;bestIndex=index;}
  }
  const [plan]=remaining.splice(bestIndex,1);selected.push(plan);
  const missing=ingredients(plan).filter(item=>item.missing);
  for(const item of missing){seen.base.add(item.base);if(item.prefix)seen.prefix.add(item.prefix);if(item.suffix)seen.suffix.add(item.suffix);seen.pair.add(`${item.prefix}|${item.suffix}`);seen.item.add(signature(item));}
 }
 return [...selected,...remaining,...otherPlans].slice(0,limit);
}

function* firstCandidates(known,target,category,pulse){
 const prefixes=known.prefix&&target.prefix?(category.axes.prefix?.values||[]):[''];
 const suffixes=known.suffix&&target.suffix?(category.axes.suffix?.values||[]):[''];
 for(const base of category.axes.base.values)for(const prefix of prefixes)for(const suffix of suffixes){
  if(pulse())return;
  yield {category:category.id,rarity:known.rarity,base,prefix,suffix};
 }
}

// Bound retained recipe trees independently of the time and display limits.
export const MAX_MISSING_PLANS=30000;
export function findMissingPlans(items,target,data,{maxSteps=2,timeMs=5000,limit=5,maxPlans=MAX_MISSING_PLANS,onProgress=()=>{}}={}){
 if(!Number.isInteger(maxSteps)||maxSteps<1||maxSteps>25)throw new Error('Liczba spawów musi wynosić od 1 do 25.');
 if(items.length>100)throw new Error('Maksymalnie 100 przedmiotów na analizę.');
 if(!Number.isInteger(maxPlans)||maxPlans<1||maxPlans>MAX_MISSING_PLANS)throw new Error('Nieprawidłowy limit planów.');
 const category=data.categories.find(c=>c.id===target.category);
 if(!category)throw new Error('Nie rozpoznano rodzaju przedmiotu.');
 const owned=items.filter(i=>i.category===target.category&&i.rarity===target.rarity&&itemClass(i)!==null&&itemClass(i)<18);
 const started=performance.now(),deadline=started+timeMs,found=new Map();let partial=false,stopReason=null,attempts=0,work=0,bestMissing=Infinity,lastProgress=started;
 const pulse=()=>{
  work++;
  if(work%128!==0)return partial;
  const now=performance.now();
  if(now>=deadline){partial=true;stopReason??='time';return true;}
  if(now-lastProgress>=180){lastProgress=now;onProgress({attempts:work,states:found.size,elapsedMs:now-started,phase:'składniki'});}
  return partial;
 };
 const timedOut=()=>{if(performance.now()>=deadline){partial=true;stopReason??='time';return true;}return false;};
 const complements=createComplements(category,pulse);
 const consider=(left,right)=>{
  attempts++;if(pulse())return null;
  const merged=merge(left,right,data);return merged?{...merged,left,right}:null;
 };
 const accept=node=>{
  if(!node||!matchesTarget(node,target)||node.steps>maxSteps)return;
  const leaves=ingredients(node),missing=leaves.filter(i=>i.missing);
  if(missing.length>2)return;
  bestMissing=Math.min(bestMissing,missing.length);
  const key=`${missing.map(signature).sort().join(';')}|${leaves.filter(i=>!i.missing).map(i=>i.id).sort().join(';')}|${node.steps}`;
  const previous=found.get(key);
  if(!previous&&found.size>=maxPlans){partial=true;stopReason='memory';return;}
  if(!previous||node.steps<previous.steps)found.set(key,{...node,missingCount:missing.length});
 };
 const build=(left,right)=>{const node=consider(left,right);if(node)node.steps=(left.steps||0)+(right.steps||0)+1;return node;};
 // Existing inventory takes priority over recommendations to acquire anything.
 const ownedPairs=[];
 for(let x=0;x<owned.length&&!partial;x++)for(let y=x+1;y<owned.length&&!partial;y++){
  const mid=build(owned[x],owned[y]);if(!mid)continue;
  ownedPairs.push(mid);accept(mid);
 }
 if(maxSteps>=2)for(const mid of ownedPairs){
  if(partial)break;
  for(const final of owned){
   if(final.id===mid.left.id||final.id===mid.right.id)continue;
   accept(build(mid,final));
  }
 }
 const ready=[...found.values()].filter(n=>n.missingCount===0).sort((a,b)=>a.steps-b.steps);
 if(ready.length&&maxSteps<=2)return {plans:ready.slice(0,limit),partial,stopReason,attempts};
 // Try direct purchases before exploring larger recipe trees.
 for(const a of owned){
  if(partial)break;
  for(const shape of complements(target,a))accept(build(a,newIngredient(shape,items.length)));
 }
 // One purchased ingredient can also complete a two-fusion tree.
 if(maxSteps>=2){
  for(const mid of ownedPairs){
   if(partial)break;
   for(const shape of complements(target,mid))accept(build(mid,newIngredient(shape,items.length)));
  }
  for(const final of owned){
   if(partial)break;
   for(const desired of complements(target,final)){
    if(partial)break;
    for(const first of owned){
     if(first.id===final.id)continue;
     for(const shape of complements(desired,first)){
      const mid=build(first,newIngredient(shape,items.length));
      if(mid&&sameName(mid,desired))accept(build(mid,final));
      if(partial)break;
     }
    }
   }
  }
 }
 // Two purchased ingredients can make the target directly even if nothing owned helps.
 for(const base of category.axes.base.values){
  if(partial)break;
  for(const prefix of target.prefix?(category.axes.prefix?.values||[]):['']){
   if(partial)break;
   for(const suffix of target.suffix?(category.axes.suffix?.values||[]):['']){
    const first=newIngredient({category:category.id,rarity:target.rarity,base,prefix,suffix},items.length);
    for(const shape of complements(target,first))accept(build(first,newIngredient(shape,items.length+1)));
    if(partial)break;
   }
  }
 }
 // If needed, use one owned item with two purchased ingredients in two fusions.
 if(maxSteps>=2)for(const ownedItem of owned){
  if(partial)break;
  for(const shape of firstCandidates(ownedItem,target,category,pulse)){
   const mid=build(ownedItem,newIngredient(shape,items.length));
   if(!mid)continue;
   for(const finalShape of complements(target,mid))accept(build(mid,newIngredient(finalShape,items.length+1)));
  }
 }
 // The short-plan inversion above finds missing ingredients quickly. For a larger
 // limit, also enumerate valid recipes made entirely from the owned inventory.
 if(maxSteps>2&&!partial&&!timedOut()&&owned.length>=2){
  const remaining=Math.max(1,deadline-performance.now());
  const extended=explore(owned,{categories:[category]},Math.min(25,maxSteps),progress=>onProgress({...progress,attempts:work+progress.attempts,states:found.size+progress.states,phase:'spawy'}),{timeMs:remaining,maxSteps,attempts:Infinity,collectRecipes:false});
  attempts+=extended.attempts;
  partial ||= extended.truncated;
  stopReason??=extended.stopReason;
  for(const node of extended.results){
   if(node.steps>maxSteps)continue;
   accept(node);
   if(partial)continue;
   if(node.steps>=maxSteps)continue;
   for(const shape of complements(target,node)){
    if(timedOut())break;
    accept(build(node,newIngredient(shape,items.length)));
   }
   if(node.steps+2>maxSteps||bestMissing<2)continue;
   for(const shape of firstCandidates(node,target,category,pulse)){
    if(timedOut())break;
    const mid=build(node,newIngredient(shape,items.length));
    if(!mid)continue;
    for(const finalShape of complements(target,mid)){
     if(timedOut())break;
     accept(build(mid,newIngredient(finalShape,items.length+1)));
    }
   }
  }
 }
 const plans=[...found.values()].sort((a,b)=>a.missingCount-b.missingCount||(ingredients(b).length-b.missingCount)-(ingredients(a).length-a.missingCount)||a.steps-b.steps||ingredients(a).filter(i=>i.missing).map(itemName).join('|').localeCompare(ingredients(b).filter(i=>i.missing).map(itemName).join('|'),'pl'));
 onProgress({attempts:work,states:found.size,elapsedMs:performance.now()-started,done:true});
 return {plans:diversePlans(plans,limit),partial,stopReason,attempts};
}
