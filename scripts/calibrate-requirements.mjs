// Adaptive calibration, not a Cartesian download. Each request must discriminate
// between possible integer requirements; the explicit budget bounds remote work.
import fs from 'node:fs';
import {setTimeout as delay} from 'node:timers/promises';
import {RequirementModel} from './requirement-model.mjs';
import {fullItemName,itemClass,officialUrl} from '../item-details.js';
import {parseInventory} from '../engine.js';
import {writeJson} from './write-json.mjs';
const [category,qualityText,budgetText='20']=process.argv.slice(2),quality=Number(qualityText),budget=Number(budgetText);
const read=path=>JSON.parse(fs.readFileSync(new URL(path,import.meta.url)));
const catalog=read('../item-catalog.json'),data=read('../data.json');
if(!catalog[category]||quality<18||quality>29||!Number.isInteger(quality)||!Number.isInteger(budget)||budget<0||budget>100)throw new Error('Usage: category quality(18–29) request-budget(0–100)');
const group=read(`../item-components/${category}.json`),model=new RequirementModel(group,quality,catalog[category]);
const file=new URL('../tests/fixtures/official-r21.json',import.meta.url),samples=read('../tests/fixtures/official-r21.json');
const observed=new Set();
for(const row of samples.filter(s=>s.node.category===category&&itemClass(s.node)===quality)){
 model.observe(row.node,row);observed.add(officialUrl(row.node,catalog));
}
const nodes=[];
for(const base of Object.keys(catalog[category].base))for(const prefix of ['',...Object.keys(catalog[category].prefix||{})])for(const suffix of ['',...Object.keys(catalog[category].suffix||{})]){
 if(!prefix&&!suffix||base===group.reference&&(!prefix||!suffix))continue;
 const node={category,base,prefix,suffix,rarity:'normal',original:`${quality<24?'Epicki':'Starożytny'} Przedmiot (+${quality%6})`};
 node.original=fullItemName(node);
 nodes.push(node);
}
const reduced=n=>Math.max(0,Math.ceil(4*n/5));
function score(node){
 let result=0;
 const vars=model.variables(node);
 for(const m of Object.values(model.models)){
  const outputs=new Map();let count=0;
  model.tuples(m,vars,values=>{
   const value=reduced(values.reduce((a,b)=>a+b,0));
   if(!outputs.has(value))outputs.set(value,{count:0,sets:vars.map(()=>new Set())});
   const output=outputs.get(value);output.count++;count++;values.forEach((v,i)=>output.sets[i].add(v));
  });
  if(outputs.size<2)continue;
  for(const o of outputs.values())vars.forEach((v,i)=>{result+=(m.domains[v].length-o.sets[i].size)*o.count/count*(v===`base|${group.reference}`?10:1);});
 }
 return result;
}
const text=html=>html.replace(/<[^>]*>/g,'').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/\s+/g,' ').trim();
console.log(category,quality,'start unresolved',model.unresolved());
let requests=0;
while(requests<budget){
 let candidate=null,best=0;
 for(const node of nodes){
  if(observed.has(officialUrl(node,catalog)))continue;
  const value=score(node);if(value>best){best=value;candidate=node;}
 }
 if(!candidate)break;
 const url=officialUrl(candidate,catalog);
 await delay(2500);
 const response=await fetch(url,{signal:AbortSignal.timeout(20000)});
 if(!response.ok)throw new Error(`HTTP ${response.status}; stopped without retry.`);
 const html=await response.text(),name=text(html.match(/Przedmiot:\s*<span[^>]*>(.*?)<\/span>/s)?.[1]||'');
 const body=html.match(/<div style="float: left; width: 70%; margin-left: 10px;">([\s\S]*?)<b>STREFA/)?.[1];
 if(!name||!body)throw new Error('Unexpected official page; stopped.');
 const lines=body.split(/<br\s*\/?\s*>/i).map(text).filter(Boolean),money=lines.find(s=>s.startsWith('Cena:'));
 const mana=Number(money?.match(/Mana:\s*(\d+)/)?.[1]),nanites=Number(money?.match(/Nanity:\s*(\d+)/)?.[1]);
 const parsed=parseInventory(name,data);
 if(parsed.errors.length||itemClass(parsed.items[0])!==quality||!Number.isSafeInteger(mana)||!Number.isSafeInteger(nanites))throw new Error('Invalid official record; stopped.');
 for(const field of ['category','base','prefix','suffix','rarity'])if(parsed.items[0][field]!==candidate[field])throw new Error(`Official ${field} differs from the requested item.`);
 const row={node:parsed.items[0],name,lines,mana,nanites,url,checkedAt:new Date().toISOString().slice(0,10)};
 samples.push(row);observed.add(url);requests++;
 writeJson(file,samples);
 model.observe(row.node,row);
 console.log(requests,name,'remaining',model.unresolved(),'score',best.toFixed(2));
}
let unresolvedVariants=0;
for(const node of nodes)if(!observed.has(officialUrl(node,catalog))&&Object.values(model.predict(node)).some(v=>v.length>1))unresolvedVariants++;
console.log('RESULT',category,quality,JSON.stringify({requests,unresolvedFields:model.unresolved(),unresolvedVariants}));
if(unresolvedVariants)process.exitCode=2;
