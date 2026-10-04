import fs from 'node:fs';
import assert from 'node:assert/strict';
import {parseInventory} from '../engine.js';
import {fullItemName,itemClass,lookupItem,officialUrl} from '../item-details.js';
const read=path=>JSON.parse(fs.readFileSync(new URL(path,import.meta.url)));
const data=read('../data.json'),catalog=read('../item-catalog.json');
const details={...read('../item-details.json'),catalog,components:{}};
const models=read('../item-requirements.json').models;
const counts=[];
for(const category of data.categories){
 const id=category.id,group=read(`../item-components/${id}.json`);
 group.requirementModels=models[id];
 details.components[id]=group;
 const countsForCategory={category:id,storedRows:Object.keys(group.rows).length,variants:0,prefixOnly:0,partialRequirements:0};
 // Audit all input components, not just the fact that lookup returns something.
 for(const [key,row] of Object.entries(group.rows)){
  const [q,legendary,axis,value]=key.split('|');
  assert.equal(itemClass({original:row.name}),Number(q),`${id}/${key}: quality`);
  assert.equal(Number(new URL(row.url).searchParams.get('class')),Number(q),`${id}/${key}: source quality`);
  const expected=catalog[id][axis][value];
  assert.notEqual(expected,undefined,`${id}/${key}: source ID`);
  assert.equal(new URL(row.url).searchParams.get({base:'baseType',prefix:'prefix',suffix:'sufix'}[axis]),String(expected),`${id}/${key}: wrong source`);
  const imported=parseInventory(row.name,data);
  assert.equal(imported.errors.length,0,`${id}/${key}: import`);
  assert.equal(imported.items[0].category,id,`${id}/${key}: category`);
  for(const resource of ['mana','nanites'])assert.ok(Number.isSafeInteger(row[resource])&&row[resource]>=0,`${id}/${key}: ${resource}`);
 }
 for(let q=0;q<30;q++)for(const rarity of q<18?['normal','legendary']:['normal']){
  for(const base of category.axes.base.values){
   for(const prefix of ['',...(category.axes.prefix?.values||[])])for(const suffix of ['',...(category.axes.suffix?.values||[])]){
    const node={category:id,base,prefix,suffix,rarity,original:`${rarity==='legendary'?'Legendarny ':''}${['','Dobry ','Doskonały ','Epicki ','Starożytny '][Math.floor(q/6)]}Przedmiot (+${q%6})`};
    node.original=fullItemName(node);
    assert.equal(itemClass(node),q,`${node.original}: parsed quality`);
    assert.ok(officialUrl(node,catalog),`${node.original}: no source mapping`);
    const row=lookupItem(node,details);
    assert.ok(row,`${node.original}: no stats`);
    for(const resource of ['mana','nanites'])assert.ok(Number.isSafeInteger(row[resource])&&row[resource]>=0,`${node.original}: ${resource}`);
    assert.ok(row.lines.every(line=>!/(?:NaN|undefined|Infinity)/.test(line)),`${node.original}: broken description`);
    countsForCategory.variants++;
    if(prefix&&!suffix)countsForCategory.prefixOnly++;
    if(row.partialRequirements)countsForCategory.partialRequirements++;
   }
  }
  // Production caches only hovered items; the exhaustive QA must bound its memory.
  group.composed?.clear();
 }
 counts.push(countsForCategory);
 console.log(JSON.stringify(countsForCategory));
}
const totals=Object.fromEntries(['storedRows','variants','prefixOnly','partialRequirements'].map(k=>[k,counts.reduce((sum,c)=>sum+c[k],0)]));
console.log('TOTAL',JSON.stringify(totals));
if(!process.argv.includes('--allow-partial'))assert.equal(totals.partialRequirements,0,'Incomplete requirements remain in the local catalogue.');
console.log('Structural coverage is exhaustive; numerical correctness is additionally checked against official source samples.');
