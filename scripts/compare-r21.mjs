import fs from 'node:fs';
import {lookupItem} from '../item-details.js';
import {parsedRecord} from '../item-compose.js';
const read=path=>JSON.parse(fs.readFileSync(new URL(path,import.meta.url)));
const catalog=read('../item-catalog.json'),details={catalog,items:{},components:{}};
const models=read('../item-requirements.json').models;
for(const id of Object.keys(catalog)){details.components[id]=read(`../item-components/${id}.json`);details.components[id].requirementModels=models[id];}
let differences=0;
const validationFile=new URL('../tests/fixtures/validation-r21.json',import.meta.url);
const samples=[...read('../tests/fixtures/official-r21.json'),...(fs.existsSync(validationFile)?JSON.parse(fs.readFileSync(validationFile)):[])];
for(const fixture of samples){
 const actual=lookupItem(fixture.node,details);
 if(!actual){console.log('MISSING',fixture.name);differences++;continue;}
 const a=parsedRecord(actual),b=parsedRecord(fixture),diff={};
 for(const field of ['features','requirements','armor','damage','mana','nanites','price','sale']){
  const left=['mana','nanites'].includes(field)?actual[field]:a[field];
  const right=['mana','nanites'].includes(field)?fixture[field]:b[field];
  if(field==='requirements'&&process.argv.includes('--costs-and-features'))continue;
  const canonical=value=>value&&typeof value==='object'&&!Array.isArray(value)?Object.fromEntries(Object.entries(value).filter(([,v])=>v!==0).sort(([x],[y])=>x.localeCompare(y))):value;
  if(JSON.stringify(canonical(left))!==JSON.stringify(canonical(right)))diff[field]={actual:left,expected:right};
 }
 if(Object.keys(diff).length){differences++;console.log(fixture.name,JSON.stringify(diff));}
}
console.log(`${samples.length} official samples checked (${process.argv.includes('--costs-and-features')?'costs, damage, armour and features only':'all numerical fields'}); ${differences} variants differ.`);
process.exitCode=differences?1:0;
