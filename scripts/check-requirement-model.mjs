import fs from 'node:fs';
import {RequirementModel} from './requirement-model.mjs';
import {itemClass} from '../item-details.js';
const read=path=>JSON.parse(fs.readFileSync(new URL(path,import.meta.url)));
const catalog=read('../item-catalog.json'),samples=read('../tests/fixtures/official-r21.json');
let total=0;
for(const [id,ids]of Object.entries(catalog)){
 if(['ranged','gun1','gun2'].includes(id))continue;
 const group=read(`../item-components/${id}.json`);
 let before=0,after=0;
 for(let q=18;q<30;q++){
  const model=new RequirementModel(group,q,ids);before+=model.unresolved();
  for(const sample of samples.filter(s=>s.node.category===id&&itemClass(s.node)===q))model.observe(sample.node,sample);
  after+=model.unresolved();
 }
 console.log(id,before,'->',after,'ambiguous pre-rounding fields');total+=after;
}
console.log('TOTAL',total);
