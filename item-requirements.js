// The catalogue stores ceil(raw * 0.8), which cannot always be inverted to one
// integer. Calibrated domains retain all possibilities instead of guessing.
export function resolveRequirements(node,quality,spec){
 if(!spec)return null;
 const variables=[`base|${node.base}`,...(node.prefix?[`prefix|${node.prefix}`]:[]),...(node.suffix?[`suffix|${node.suffix}`]:[])];
 const requirements={};
 const reduce=n=>Math.max(0,Math.ceil(4*n/5));
 for(const [field,model]of Object.entries(spec.fields)){
  const constraints=model.constraints.filter(c=>c.variables.every(v=>variables.includes(v)));
  const possible=new Set();
  function visit(index,values){
   if(index===variables.length){
    if(constraints.every(c=>reduce(c.variables.reduce((sum,v)=>sum+values[variables.indexOf(v)],0))===c.value))possible.add(reduce(values.reduce((a,b)=>a+b,0)));
    return;
   }
   const domain=model.values[variables[index]]??0;
   for(const value of Array.isArray(domain)?domain:[domain])visit(index+1,[...values,value]);
  }
  visit(0,[]);
  // Never replace an explicit gap with an arbitrary rounding choice.
  if(possible.size!==1)return null;
  const value=[...possible][0];if(value>0)requirements[field]=value;
 }
 requirements['Postać musi być w akcie']=quality>=24?4:3;
 return requirements;
}
