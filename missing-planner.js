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

// Invert each table axis lazily so large affix tables can be stopped on time.
function* axisComplements(target,known,category,axis,pulse){
 const table=category.axes[axis];
 if(!table){if(!target[axis]&&!known[axis])yield '';return;}
 if(axis!=='base'&&!target[axis]){yield '';return;}
 if(axis!=='base'&&!known[axis])return;
 const order=new Map(table.values.map((value,index)=>[value,index])),blocked=new Set(table.blocked);
 for(const value of table.values){
  if(pulse())return;
  const pair=[known[axis],value].sort((a,b)=>order.get(a)-order.get(b)).join('|');
  const result=table.table[`${known[axis]}|${value}`];
  if(!blocked.has(pair)&&(axis==='base'&&!target[axis]?!!result:result===target[axis]))yield value;
 }
}
function* complements(target,known,category,pulse){
 for(const base of axisComplements(target,known,category,'base',pulse))
  for(const prefix of axisComplements(target,known,category,'prefix',pulse))
   for(const suffix of axisComplements(target,known,category,'suffix',pulse)){
    if(pulse())return;
    yield {category:category.id,rarity:known.rarity,base,prefix,suffix};
   }
}

function newIngredient(shape,id){
 const n={...shape,id,missing:true};
 return {...n,original:`${itemName(n)} (+1)`};
}

function diversePlans(plans,limit){
 const remaining=[...plans],selected=[],diverseLimit=Math.min(limit,20),bestMissing=plans[0]?.missingCount,minTierSlots=Math.ceil(diverseLimit*.6),seen={base:new Set(),prefix:new Set(),suffix:new Set(),pair:new Set(),item:new Set()};
 while(remaining.length&&selected.length<diverseLimit){
  let bestIndex=0,bestScore=-1;
  for(let index=0;index<remaining.length;index++){
   if(selected.length<minTierSlots&&remaining[index].missingCount!==bestMissing)continue;
   const missing=ingredients(remaining[index]).filter(item=>item.missing);
   const values={base:new Set(missing.map(item=>item.base)),prefix:new Set(missing.map(item=>item.prefix).filter(Boolean)),suffix:new Set(missing.map(item=>item.suffix).filter(Boolean)),pair:new Set(missing.map(item=>`${item.prefix}|${item.suffix}`))};
   const score=[...values.prefix].filter(value=>!seen.prefix.has(value)).length*12+
    [...values.suffix].filter(value=>!seen.suffix.has(value)).length*12+
    [...values.pair].filter(value=>!seen.pair.has(value)).length*5+
    [...values.base].filter(value=>!seen.base.has(value)).length*2+
    missing.filter(item=>!seen.item.has(signature(item))).length*8-
    remaining[index].missingCount*7-remaining[index].steps/100;
   if(score>bestScore){bestScore=score;bestIndex=index;}
  }
  const [plan]=remaining.splice(bestIndex,1);selected.push(plan);
  const missing=ingredients(plan).filter(item=>item.missing);
  for(const item of missing){seen.base.add(item.base);if(item.prefix)seen.prefix.add(item.prefix);if(item.suffix)seen.suffix.add(item.suffix);seen.pair.add(`${item.prefix}|${item.suffix}`);seen.item.add(signature(item));}
 }
 return [...selected,...remaining].slice(0,limit);
}

function* firstCandidates(known,target,category,pulse){
 const prefixes=known.prefix&&target.prefix?(category.axes.prefix?.values||[]):[''];
 const suffixes=known.suffix&&target.suffix?(category.axes.suffix?.values||[]):[''];
 for(const base of category.axes.base.values)for(const prefix of prefixes)for(const suffix of suffixes){
  if(pulse())return;
  yield {category:category.id,rarity:known.rarity,base,prefix,suffix};
 }
}

export function findMissingPlans(items,target,data,{maxSteps=2,timeMs=5000,limit=5,onProgress=()=>{}}={}){
 if(!Number.isInteger(maxSteps)||maxSteps<1||maxSteps>25)throw new Error('Liczba spawów musi wynosić od 1 do 25.');
 const category=data.categories.find(c=>c.id===target.category);
 if(!category)throw new Error('Nie rozpoznano rodzaju przedmiotu.');
 const owned=items.filter(i=>i.category===target.category&&i.rarity===target.rarity&&itemClass(i)!==null&&itemClass(i)<18);
 const started=performance.now(),deadline=started+timeMs,found=new Map();let partial=false,attempts=0,work=0,bestMissing=Infinity,lastProgress=started;
 const pulse=()=>{
  work++;
  if(work%128!==0)return partial;
  const now=performance.now();
  if(now>=deadline){partial=true;return true;}
  if(work%1024===0||now-lastProgress>=180){lastProgress=now;onProgress({attempts:work,states:found.size,elapsedMs:now-started,phase:'składniki'});}
  return partial;
 };
 const timedOut=()=>{if(performance.now()>=deadline){partial=true;return true;}return false;};
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
  if(!previous||node.steps<previous.steps)found.set(key,{...node,missingCount:missing.length});
 };
 const build=(left,right)=>{const node=consider(left,right);if(node)node.steps=(left.steps||0)+(right.steps||0)+1;return node;};
 // Try a direct purchase before the larger inventory search, so a short time
 // budget can still return a useful partial result.
 for(const a of owned){
  if(partial)break;
  for(const shape of complements(target,a,category,pulse))accept(build(a,newIngredient(shape,items.length)));
 }
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
 if(ready.length&&maxSteps<=2)return {plans:ready.slice(0,limit),partial,attempts};
 // One purchased ingredient can also complete a two-fusion tree.
 if(maxSteps>=2){
  for(const mid of ownedPairs){
   if(partial)break;
   for(const shape of complements(target,mid,category,pulse))accept(build(mid,newIngredient(shape,items.length)));
  }
  for(const final of owned){
   if(partial)break;
   for(const desired of complements(target,final,category,pulse)){
    if(partial)break;
    for(const first of owned){
     if(first.id===final.id)continue;
     for(const shape of complements(desired,first,category,pulse)){
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
    for(const shape of complements(target,first,category,pulse))accept(build(first,newIngredient(shape,items.length+1)));
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
   for(const finalShape of complements(target,mid,category,pulse))accept(build(mid,newIngredient(finalShape,items.length+1)));
  }
 }
 // The short-plan inversion above finds missing ingredients quickly. For a larger
 // limit, also enumerate valid recipes made entirely from the owned inventory.
 if(maxSteps>2&&!timedOut()&&owned.length>=2){
  const remaining=Math.max(1,deadline-performance.now());
  const extended=explore(owned,{categories:[category]},Math.min(25,maxSteps),progress=>onProgress({...progress,attempts:work+progress.attempts,states:found.size+progress.states,phase:'spawy'}),{timeMs:remaining,maxSteps,states:Infinity,attempts:Infinity});
  attempts+=extended.attempts;
  partial ||= extended.truncated;
  for(const node of extended.results){
   if(node.steps>maxSteps)continue;
   accept(node);
   if(partial)continue;
   if(node.steps>=maxSteps)continue;
   for(const shape of complements(target,node,category,pulse)){
    if(timedOut())break;
    accept(build(node,newIngredient(shape,items.length)));
   }
   if(node.steps+2>maxSteps||bestMissing<2)continue;
   for(const shape of firstCandidates(node,target,category,pulse)){
    if(timedOut())break;
    const mid=build(node,newIngredient(shape,items.length));
    if(!mid)continue;
    for(const finalShape of complements(target,mid,category,pulse)){
     if(timedOut())break;
     accept(build(mid,newIngredient(finalShape,items.length+1)));
    }
   }
  }
 }
 const plans=[...found.values()].sort((a,b)=>a.missingCount-b.missingCount||(ingredients(b).length-b.missingCount)-(ingredients(a).length-a.missingCount)||a.steps-b.steps||ingredients(a).filter(i=>i.missing).map(itemName).join('|').localeCompare(ingredients(b).filter(i=>i.missing).map(itemName).join('|'),'pl'));
 onProgress({attempts:work,states:found.size,elapsedMs:performance.now()-started,done:true});
 return {plans:diversePlans(plans,limit),partial,attempts};
}
