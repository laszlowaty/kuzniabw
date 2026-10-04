import fs from 'node:fs';
import {RequirementModel} from './requirement-model.mjs';
import {itemClass} from '../item-details.js';
import {writeJson} from './write-json.mjs';
const read=path=>JSON.parse(fs.readFileSync(new URL(path,import.meta.url)));
const catalog=read('../item-catalog.json'),samples=read('../tests/fixtures/official-r21.json');
const output={source:'https://r21.bloodwars.pl/test_items.php',playerLevel:80,checkedAt:samples.map(s=>s.checkedAt).sort().at(-1),models:{}};
for(const [category,ids]of Object.entries(catalog)){
 if(['ranged','gun1','gun2'].includes(category))continue;
 const group=read(`../item-components/${category}.json`);output.models[category]={};
 for(let q=18;q<30;q++){
  const model=new RequirementModel(group,q,ids);
  for(const row of samples.filter(s=>s.node.category===category&&itemClass(s.node)===q))model.observe(row.node,row);
  const fields={};
  for(const [field,m]of Object.entries(model.models)){
   const constraints=m.constraints.filter(c=>{
    let excludes=false;
    function walk(index,total){
     if(index===c.variables.length){if(Math.max(0,Math.ceil(4*total/5))!==c.value)excludes=true;return;}
     for(const n of m.domains[c.variables[index]])walk(index+1,total+n);
    }
    walk(0,0);return excludes;
   });
   fields[field]={values:Object.fromEntries(Object.entries(m.domains).filter(([,v])=>v.length!==1||v[0]!==0).map(([k,v])=>[k,v.length===1?v[0]:v])),constraints};
  }
  output.models[category][q]={fields};
 }
}
writeJson(new URL('../item-requirements.json',import.meta.url),output,0);
console.log('Built calibrated requirements from',samples.length,'official samples (offline).');
