import fs from 'node:fs';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {parseInventory,merge,explore,itemName} from '../engine.js';
import {importInventory} from '../inventory-import.js';
import {itemClass,officialUrl,lookupItem,fusionCost,fullItemName} from '../item-details.js';
import {parsedRecord} from '../item-compose.js';
import {resolveRequirements} from '../item-requirements.js';
import {costKey,totalCosts} from '../costs.js';
import {detailContent} from '../item-popover.js';
import {isStrongCombo} from '../strong-combos.js';

const read=path=>JSON.parse(fs.readFileSync(new URL(path,import.meta.url)));
const data=read('../data.json'),catalog=read('../item-catalog.json');
const details={...read('../item-details.json'),catalog,components:{}};
const requirements=read('../item-requirements.json');
for(const id of Object.keys(catalog)){
 const group=read(`../item-components/${id}.json`);group.requirementModels=requirements.models[id];details.components[id]=group;
}
const item=name=>{const parsed=parseInventory(name,data);assert.deepEqual(parsed.errors,[]);assert.equal(parsed.items.length,1);return parsed.items[0];};
const canonical=map=>Object.fromEntries(Object.entries(map).filter(([,v])=>v!==0).sort(([a],[b])=>a.localeCompare(b)));

test('measured pair needs two strong components at the same quality',()=>{
 const cap=item('Dobra Tygrysia Czapka Adrenaliny (+5)');
 assert.equal(isStrongCombo(cap,details),true);
 assert.equal(isStrongCombo({...cap,suffix:''},details),false);
 assert.equal(isStrongCombo({...cap,prefix:''},details),false);
 assert.equal(isStrongCombo({...cap,category:'gun1'},details),false);
});

test('Doskonałości is a suffix, not item quality (including legendary names)',()=>{
 for(const [name,q]of [['Kusza Doskonałości',0],['Kusza Doskonałości (+1)',1],['Dobra Kusza Doskonałości',6],['Legendarny Dobry Łuk Doskonałości (+3)',9],['Doskonała Kusza Doskonałości (+4)',16],['Epicka Kusza Doskonałości',18],['Starożytna Kusza Doskonałości (+5)',29]]){
  const n=item(name);assert.equal(itemClass(n),q);assert.equal(new URL(officialUrl(n,catalog)).searchParams.get('class'),String(q));
 }
 const row=lookupItem(item('Dobra Kusza Doskonałości'),details);
 assert.equal(row.mana,908);assert.equal(row.nanites,276);
 assert.equal(lookupItem(item('Kusza Doskonałości (+1)'),details).nanites,36);
});

test('prefix-only official component names survive inventory import with their quality',()=>{
 let count=0;
 for(const [category,group]of Object.entries(details.components))for(const [key,row]of Object.entries(group.rows)){
  const [q,,axis,prefix]=key.split('|');if(axis!=='prefix')continue;
  const parsed=importInventory(row.name,data);
  assert.equal(parsed.error,null,row.name);assert.equal(parsed.items.length,1,row.name);
  const n=parsed.items[0];assert.equal(n.category,category);assert.equal(n.prefix,prefix);assert.equal(n.suffix,'');assert.equal(itemClass(n),Number(q));
  assert.ok(lookupItem(n,details),row.name);count++;
 }
 assert.ok(count>8000);
});

test('quality adjectives agree with the official grammatical gender of every base',()=>{
 for(const [category,group]of Object.entries(details.components))for(const base of Object.keys(catalog[category].base)){
  const row=group.rows[`6|0|base|${base}`];
  assert.equal(fullItemName(item(row.name)).split(' ')[0],row.name.split(' ')[0],row.name);
 }
});

test('all component names preserve Polish letters from the official catalogue',()=>{
 for(const group of Object.values(details.components))for(const [key,row]of Object.entries(group.rows))if(key.startsWith('0|0|'))assert.equal(itemName(item(row.name)).toLowerCase(),row.name.toLowerCase());
});

test('fusion charges both inputs, not the result; multi-step totals count each fusion once',()=>{
 const left={...item('Kusza Doskonałości (+1)'),id:1},right={...item('Kusza Doskonałości (+1)'),id:2};
 const step={...merge(left,right,data),left,right};
 assert.equal(itemClass(step),2);
 assert.deepEqual(fusionCost(step,details),{mana:216,nanites:72});
 const other={...item('Dobra Kusza Doskonałości'),id:3},next={...merge(step,other,data),left:step,right:other};
 const intermediate=lookupItem(step,details),cost=fusionCost(next,details);
 assert.deepEqual(cost,{mana:intermediate.mana+908,nanites:intermediate.nanites+276});
 const total=totalCosts([step,next],new Map([[costKey(step),fusionCost(step,details)],[costKey(next),cost]]));
 assert.equal(total.nanites.total,72+intermediate.nanites+276);assert.equal(total.nanites.complete,true);
 assert.equal(fusionCost({left:item('Epicka Kusza'),right:other},details),null);
 assert.equal(fusionCost({left:item('Kusza'),right:other},details),null);
});

test('calibrated requirements retain uncertainty instead of choosing an arbitrary integer',()=>{
 const n={base:'test',prefix:'p',suffix:''};
 assert.equal(resolveRequirements(n,18,{fields:{'SIŁA':{values:{'base|test':[4,5],'prefix|p':1},constraints:[]}}}),null);
 assert.deepEqual(resolveRequirements(n,24,{fields:{'SIŁA':{values:{'base|test':[4,5],'prefix|p':1},constraints:[{variables:['base|test','prefix|p'],value:4}]}}}),{'SIŁA':4,'Postać musi być w akcie':4});
});

test('planner does not offer recipes whose quality or cost rules are unsupported',()=>{
 for(const names of [['Kusza','Kusza (+1)'],['Epicka Czapka','Epicki Kask'],['Doskonała Czapka (+5)','Doskonały Kask (+5)']]){
  const inventory=names.map((name,id)=>({...item(name),id}));
  assert.equal(explore(inventory,data,2).results.length,0,names.join(' + '));
 }
 const inventory=['Kusza (+1)','Kusza (+1)'].map((name,id)=>({...item(name),id}));
 const result=explore(inventory,data,2).results;
 assert.equal(result.length,1);assert.equal(itemClass(result[0]),2);
});

test('ordinary +0 items are imported and described but cannot be fused before upgrading',()=>{
 const parsed=importInventory('Kusza\nKusza (+1)',data);
 assert.equal(parsed.error,null);
 assert.deepEqual(parsed.ignored,[]);
 assert.deepEqual(parsed.items.map(itemClass),[0,1]);
 assert.equal(parsed.items[0].prefix,'');
 assert.equal(parsed.items[0].suffix,'');
 assert.ok(lookupItem(parsed.items[0],details));
 assert.equal(merge(parsed.items[0],parsed.items[1],data),null);
 assert.deepEqual(explore(parsed.items,data,1).results,[]);
 const upgraded=importInventory('Kusza (+1)\nKusza (+1)',data).items;
 assert.equal(itemClass(explore(upgraded,data,1).results[0]),2);
 const good=importInventory('Dobra Kusza\nDobra Kusza',data).items;
 assert.deepEqual(good.map(itemClass),[6,6]);
 assert.equal(itemClass(explore(good,data,1).results[0]),7);
});

test('a deeper intermediate of a different quality can enable a valid final fusion',()=>{
 const table={};for(const [a,b,result]of [['one','one','two'],['one','two','three'],['two','two','four'],['one','three','four'],['four','last','final']]){table[`${a}|${b}`]=result;table[`${b}|${a}`]=result;}
 const toy={categories:[{id:'toy',label:'Toy',axes:{base:{values:['b'],table:{'b|b':'b'},blocked:[],refs:{}},prefix:{values:['one','two','three','four','last','final'],table,blocked:[],refs:{}}}}]};
 const inventory=Array.from({length:5},(_,id)=>({id,category:'toy',base:'b',prefix:id===4?'last':'one',suffix:'',rarity:'normal',original:`Doskonały B (+${id===4?5:3})`}));
 const target=explore(inventory,toy,4).results.find(n=>n.prefix==='final');
 // Balanced four-input tree has q17 and cannot fuse with the last q17 item.
 // The deeper four-input tree has q16 and must not be discarded as the same name.
 assert.ok(target);assert.equal(target.steps,4);assert.equal(target.depth,4);assert.equal(itemClass(target),17);
});

test('time budget is shared across active categories instead of divided per category',()=>{
 const axis={values:['b'],table:{'b|b':'b'},blocked:[],refs:{}};
 const toy={categories:['busy','other'].map(id=>({id,label:id,axes:{base:axis}}))};
 const inventory=[...Array.from({length:18},(_,id)=>({id,category:'busy',base:'b',prefix:'',suffix:'',rarity:'normal',original:'B (+1)'})),{id:18,category:'other',base:'b',prefix:'',suffix:'',rarity:'normal',original:'B (+1)'}];
 const timeMs=120;
 const run=explore(inventory,toy,25,()=>{},{timeMs,states:Infinity,attempts:Infinity});
 assert.equal(run.truncated,true);
 assert.equal(run.stopReason,'time');
 assert.ok(run.elapsedMs>=timeMs*0.75,`Search stopped after ${run.elapsedMs.toFixed(1)} ms of a ${timeMs} ms budget`);
});

test('busy categories both contribute results before the shared time limit',()=>{
 const axis={values:['b'],table:{'b|b':'b'},blocked:[],refs:{}};
 const toy={categories:['first','second'].map(id=>({id,label:id,axes:{base:axis}}))};
 const inventory=toy.categories.flatMap((category,index)=>Array.from({length:18},(_,offset)=>({id:index*18+offset,category:category.id,base:'b',prefix:'',suffix:'',rarity:'normal',original:'B (+1)'})));
 const run=explore(inventory,toy,25,()=>{},{timeMs:250,states:Infinity,attempts:Infinity});
 assert.equal(run.truncated,true);
 assert.equal(run.stopReason,'time');
 assert.deepEqual(new Set(run.results.map(result=>result.category)),new Set(['first','second']));
});

test('official R21 samples agree on features, requirements, damage, armour, mana and nanites',()=>{
 for(const source of read('./fixtures/official-r21.json')){
  const actual=lookupItem(source.node,details);assert.ok(actual,source.name);
  const a=parsedRecord(actual),b=parsedRecord(source);
  for(const key of ['features','requirements'])assert.deepEqual(canonical(a[key]),canonical(b[key]),`${source.name}: ${key}`);
  for(const key of ['armor','damage','price','sale'])assert.deepEqual(a[key],b[key],`${source.name}: ${key}`);
  for(const key of ['mana','nanites'])assert.equal(actual[key],source[key],`${source.name}: ${key}`);
 }
});

test('independent source samples were not used for calibration and agree numerically',()=>{
 const fitted=new Set(read('./fixtures/official-r21.json').map(s=>s.url));
 const samples=read('./fixtures/validation-r21.json');assert.ok(samples.length>=70);
 for(const source of samples){
  assert.equal(fitted.has(source.url),false,`Holdout leaked into calibration: ${source.name}`);
  const actual=lookupItem(source.node,details),a=parsedRecord(actual),b=parsedRecord(source);
  for(const key of ['features','requirements'])assert.deepEqual(canonical(a[key]),canonical(b[key]),`${source.name}: ${key}`);
  for(const key of ['armor','damage','price','sale'])assert.deepEqual(a[key],b[key],`${source.name}: ${key}`);
  for(const key of ['mana','nanites'])assert.equal(actual[key],source[key],`${source.name}: ${key}`);
 }
});

test('prefix-only popup and sourced ancient combination have complete requirements',()=>{
 for(const name of ['Epicka Władcza Kurtka','Starożytna Władcza Kurtka','Epicka Bojowa Korona']){
  const html=detailContent(item(name),details,catalog);
  assert.match(html,/Wymagania: POZIOM:/,name);assert.doesNotMatch(html,/brak jednoznacznych|sprawdź dokładne|\bNaN\b|undefined/i,name);
 }
 const req=parsedRecord(lookupItem(item('Starożytna Władcza Kurtka Narkomana'),details)).requirements;
 assert.equal(req.POZIOM,159);assert.equal(req['SIŁA'],164);
});
