import {merge} from './engine.js';

// Tiers are positions in the source tables, not combat or market valuations.
export function estimateTiers(items,data){
 const pairs=[],useful=new Set(),mixed=new Set(),available=new Set();
 for(let i=0;i<items.length;i++)for(let j=i+1;j<items.length;j++){
  const left=items[i],right=items[j],result=merge(left,right,data);
  if(!result)continue;
  const category=data.categories.find(c=>c.id===left.category),axes={};
  for(const axis of ['prefix','suffix']){
   const values=category.axes[axis]?.values;
   if(!values)continue;
   const tier=value=>value?values.indexOf(value)+1:0;
   const a=tier(left[axis]),b=tier(right[axis]),out=tier(result[axis]);
   axes[axis]={left:a,right:b,result:out,delta:out-Math.max(a,b)};
  }
  if(!Object.keys(axes).length)continue;
  const deltas=Object.values(axes).map(a=>a.delta),gain=deltas.reduce((a,b)=>a+b,0);
  const up=deltas.some(d=>d>0),down=deltas.some(d=>d<0);
  const kind=up?(down?'mixed':'gain'):(down?'loss':'neutral');
  available.add(left.id);available.add(right.id);
  if(kind==='gain'){useful.add(left.id);useful.add(right.id);}
  if(kind==='mixed'){mixed.add(left.id);mixed.add(right.id);}
  pairs.push({node:{...result,left,right,steps:1,depth:1},axes,gain,kind});
 }
 const order={gain:0,mixed:1,neutral:2,loss:3};
 pairs.sort((a,b)=>order[a.kind]-order[b.kind]||b.gain-a.gain||a.node.left.id-b.node.left.id||a.node.right.id-b.node.right.id);
 return {pairs,items:items.map(item=>({item,status:useful.has(item.id)?'gain':mixed.has(item.id)?'mixed':available.has(item.id)?'none':'unavailable'}))};
}
