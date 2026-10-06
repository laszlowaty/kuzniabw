import {itemClass,itemName,merge,resultKey,ingredients} from './engine.js';

const signature=n=>`${resultKey(n)}|${itemClass(n)}`;
const sameName=(a,b)=>resultKey(a)===resultKey(b);

// Invert each table axis, then let merge() verify the whole recipe and quality.
function complements(target,known,category){
 const axes={};
 for(const axis of ['base','prefix','suffix']){
  const table=category.axes[axis];
  if(!table){if(target[axis]||known[axis])return [];axes[axis]=[''];continue;}
  if(axis!=='base'&&!target[axis]){axes[axis]=[''];continue;}
  if(axis!=='base'&&!known[axis])return [];
  axes[axis]=table.values.filter(value=>!table.blocked.includes([known[axis],value].sort((a,b)=>table.values.indexOf(a)-table.values.indexOf(b)).join('|'))&&table.table[`${known[axis]}|${value}`]===target[axis]);
  if(!axes[axis].length)return [];
 }
 return axes.base.flatMap(base=>axes.prefix.flatMap(prefix=>axes.suffix.map(suffix=>({category:category.id,rarity:known.rarity,base,prefix,suffix}))));
}

function newIngredient(shape,id){
 const n={...shape,id,missing:true};
 return {...n,original:`${itemName(n)} (+1)`};
}

function firstCandidates(known,target,category){
 const prefixes=known.prefix&&target.prefix?(category.axes.prefix?.values||[]):[''];
 const suffixes=known.suffix&&target.suffix?(category.axes.suffix?.values||[]):[''];
 return category.axes.base.values.flatMap(base=>prefixes.flatMap(prefix=>suffixes.map(suffix=>({category:category.id,rarity:known.rarity,base,prefix,suffix}))));
}

export function findMissingPlans(items,target,data,{maxSteps=2,timeMs=5000,limit=5}={}){
 const category=data.categories.find(c=>c.id===target.category);
 if(!category)throw new Error('Nie rozpoznano rodzaju przedmiotu.');
 const owned=items.filter(i=>i.category===target.category&&i.rarity===target.rarity&&itemClass(i)!==null&&itemClass(i)<18);
 const deadline=performance.now()+timeMs,found=new Map();let partial=false,attempts=0;
 const consider=(left,right)=>{
  if(++attempts%256===0&&performance.now()>deadline){partial=true;return null;}
  const merged=merge(left,right,data);return merged?{...merged,left,right}:null;
 };
 const accept=node=>{
  if(!node||!sameName(node,target)||node.steps>maxSteps)return;
  const leaves=ingredients(node),missing=leaves.filter(i=>i.missing);
  if(missing.length>2)return;
  const key=`${missing.map(signature).sort().join(';')}|${leaves.filter(i=>!i.missing).map(i=>i.id).sort().join(';')}|${node.steps}`;
  const previous=found.get(key);
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
 if(ready.length)return {plans:ready.slice(0,limit),partial,attempts};
 // One purchased ingredient: direct fusion or either position in a two-fusion tree.
 for(const a of owned){
  if(partial)break;
  for(const shape of complements(target,a,category))accept(build(a,newIngredient(shape,items.length)));
 }
 if(maxSteps>=2){
  for(const mid of ownedPairs){
   if(partial)break;
   for(const shape of complements(target,mid,category))accept(build(mid,newIngredient(shape,items.length)));
  }
  for(const final of owned){
   if(partial)break;
   for(const desired of complements(target,final,category)){
    if(partial)break;
    for(const first of owned){
     if(first.id===final.id)continue;
     for(const shape of complements(desired,first,category)){
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
    for(const shape of complements(target,first,category))accept(build(first,newIngredient(shape,items.length+1)));
    if(partial)break;
   }
  }
 }
 // If needed, use one owned item with two purchased ingredients in two fusions.
 if(maxSteps>=2)for(const ownedItem of owned){
  if(partial)break;
  for(const shape of firstCandidates(ownedItem,target,category)){
   const mid=build(ownedItem,newIngredient(shape,items.length));
   if(!mid)continue;
   for(const finalShape of complements(target,mid,category))accept(build(mid,newIngredient(finalShape,items.length+1)));
   if(partial)break;
  }
 }
 const plans=[...found.values()].sort((a,b)=>a.missingCount-b.missingCount||(ingredients(b).length-b.missingCount)-(ingredients(a).length-a.missingCount)||a.steps-b.steps||ingredients(a).filter(i=>i.missing).map(itemName).join('|').localeCompare(ingredients(b).filter(i=>i.missing).map(itemName).join('|'),'pl'));
 return {plans:plans.slice(0,limit),partial,attempts};
}
