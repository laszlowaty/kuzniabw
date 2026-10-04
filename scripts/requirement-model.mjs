// Recover pre-legendary integer requirements from rounded catalogue observations.
// ceil(4*x/5) is not invertible at multiples of four: retain every candidate.
import {parsedRecord} from '../item-compose.js';
const act='Postać musi być w akcie';
const reduced=n=>Math.max(0,Math.ceil(4*n/5));
const inverse=n=>n>0?Array.from({length:Math.floor(5*n/4)-Math.floor(5*(n-1)/4)},(_,i)=>Math.floor(5*(n-1)/4)+1+i):[0];
export class RequirementModel{
 constructor(group,quality,catalog){
  this.group=group;this.quality=quality;this.catalog=catalog;this.models={};
  const req=(axis,name,q=quality)=>parsedRecord(group.rows[`${q}|0|${axis}|${name}`]).requirements;
  const keys=new Set();
  for(const [axis,names]of Object.entries(catalog))for(const name of Object.keys(names))for(const key of Object.keys(req(axis,name)))if(key!==act)keys.add(key);
  for(const key of Object.keys(group.requirementDeltas?.[`${quality}|prefix|elfi`]||{}))keys.add(key);
  for(const key of keys){
   const model={domains:{},constraints:[]},ref=req('base',group.reference)[key]||0;
   for(const name of Object.keys(catalog.base))model.domains[`base|${name}`]=inverse(req('base',name)[key]||0);
   for(const axis of ['prefix','suffix'])for(const name of Object.keys(catalog[axis]||{})){
    const value=req(axis,name)[key]||0;
    const correction=group.requirementDeltas?.[`${quality}|${axis}|${name}`]?.[key];
    // An affix only modifies attributes present in its requirement schema.
    const active=correction!==undefined||Array.from({length:30},(_,q)=>(req(axis,name,q)[key]||0)!==(req('base',group.reference,q)[key]||0)).some(Boolean);
    let candidates=[0];
    if(active){
     if(correction!==undefined&&value===0){
      candidates=[];
      for(let n=Math.floor(5*(correction-1)/4)+1;n<5*(correction+1)/4;n++)candidates.push(n);
     }else candidates=[...new Set(inverse(value).flatMap(v=>inverse(ref).map(r=>v-r)))];
    }
    model.domains[`${axis}|${name}`]=candidates;
    model.constraints.push({variables:[`base|${group.reference}`,`${axis}|${name}`],value});
   }
   this.models[key]=model;
  }
  this.propagate();
 }
 variables(node){return [`base|${node.base}`,...(node.prefix?[`prefix|${node.prefix}`]:[]),...(node.suffix?[`suffix|${node.suffix}`]:[])];}
 tuples(model,variables,visit,index=0,values=[],checks=model.constraints.filter(c=>c.variables.every(v=>variables.includes(v)))){
  if(index===variables.length){
   if(checks.every(c=>reduced(c.variables.reduce((sum,v)=>sum+values[variables.indexOf(v)],0))===c.value))visit(values);
   return;
  }
  for(const value of model.domains[variables[index]])this.tuples(model,variables,visit,index+1,[...values,value],checks);
 }
 propagate(){
  const reduce=(key,model)=>{
   let changed=true;
   while(changed){
    changed=false;
    for(const {variables,value}of model.constraints){
     const supported=variables.map(()=>new Set());
     this.tuples(model,variables,values=>{if(reduced(values.reduce((a,b)=>a+b,0))===value)values.forEach((v,i)=>supported[i].add(v));});
     variables.forEach((variable,i)=>{
      const before=model.domains[variable],after=before.filter(v=>supported[i].has(v));
      if(!after.length)throw new Error(`Contradictory requirements q=${this.quality} ${key} ${variable}: ${JSON.stringify({variables,value,before})}`);
      if(after.length<before.length){model.domains[variable]=after;changed=true;}
     });
    }
   }
  };
  for(const [key,model]of Object.entries(this.models)){
   reduce(key,model);
   // Conditioning on the reference removes correlations lost by plain arc
   // consistency (base+prefix and base+suffix share the same rounded base).
   const reference=`base|${this.group.reference}`;
   const branches=[];
   for(const value of model.domains[reference]){
    const branch={domains:Object.fromEntries(Object.entries(model.domains).map(([v,d])=>[v,[...d]])),constraints:model.constraints};
    branch.domains[reference]=[value];
    try{reduce(key,branch);branches.push(branch);}catch(error){if(!error.message.startsWith('Contradictory requirements'))throw error;}
   }
   if(!branches.length)throw new Error(`Contradictory reference q=${this.quality} ${key}`);
   for(const variable of Object.keys(model.domains))model.domains[variable]=[...new Set(branches.flatMap(b=>b.domains[variable]))];
   reduce(key,model);
  }
 }
 observe(node,row){
  const req=parsedRecord(row).requirements;
  for(const [key,model]of Object.entries(this.models))model.constraints.push({variables:this.variables(node),value:req[key]||0});
  this.propagate();
 }
 predict(node){
  const out={},variables=this.variables(node);
  for(const [key,model]of Object.entries(this.models)){
   const possible=new Set();this.tuples(model,variables,values=>possible.add(reduced(values.reduce((a,b)=>a+b,0))));
   out[key]=[...possible].sort((a,b)=>a-b);
  }
  return out;
 }
 unresolved(){return Object.values(this.models).reduce((sum,m)=>sum+Object.values(m.domains).filter(d=>d.length>1).length,0);}
}
