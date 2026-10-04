import {resultKey} from './engine.js';

// Distinguish physical inputs, qualities and alternative fusion trees.
export function costKey(node){
 function tree(n){if(!n.left)return ['item',n.id,n.original];const children=[tree(n.left),tree(n.right)];children.sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));return [resultKey(n),...children];}
 return JSON.stringify(tree(node));
}
export function parseCost(raw){
 const value=String(raw??'').trim();
 if(value==='')return null;
 if(!/^\d+$/.test(value))return NaN;
 const n=Number(value);return Number.isSafeInteger(n)?n:NaN;
}
export function totalCosts(steps,costs){
 const out={};
 for(const resource of ['mana','nanites']){
  let total=0,known=0,invalid=0;
  for(const step of steps){const value=parseCost(costs.get(costKey(step))?.[resource]);if(value===null)continue;if(!Number.isFinite(value)){invalid++;continue;}known++;total+=value;}
  if(!Number.isSafeInteger(total))invalid++;
  out[resource]={total,known,invalid,complete:known===steps.length&&invalid===0};
 }
 return out;
}
