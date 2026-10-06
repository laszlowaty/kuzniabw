import fs from 'node:fs';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseInventory} from '../engine.js';
import {assessProfileAffixes,itemDefense,possibleForTattoo,possibleForSex,requiredSex,tattoos,races} from '../profile-affixes.js';
import {affixContent,detailContent} from '../item-popover.js';

const data=JSON.parse(fs.readFileSync(new URL('../data.json',import.meta.url)));
const catalog=JSON.parse(fs.readFileSync(new URL('../item-catalog.json',import.meta.url)));
const details={components:{}};
for(const category of data.categories)details.components[category.id]=JSON.parse(fs.readFileSync(new URL(`../item-components/${category.id}.json`,import.meta.url)));
const item=name=>{const result=parseInventory(name,data);assert.deepEqual(result.errors,[]);return result.items[0];};

test('profile models cover all Moria paths and races',()=>{
 assert.equal(Object.keys(tattoos).length,10);
 assert.equal(Object.keys(races).length,5);
 assert.deepEqual(tattoos.lowca_skarbow.weapons,['gun1','ranged']);
 assert.deepEqual(tattoos.zabojca.weapons,['melee1','gun2']);
});

test('sex restrictions come from the official base, including composed variants',()=>{
 for(const category of data.categories)for(const base of category.axes.base.values)assert.ok(['any','female','male'].includes(requiredSex({category:category.id,base},details,catalog)),`${category.id}: ${base}`);
 for(const [name,sex] of [
  ['Dobra Runiczna Bandana Prekognicji (+5)','male'],
  ['Opaska Prekognicji','female'],
  ['Smoking Siłacza','male'],
  ['Gorset','female'],
  ['Spódnica','female'],
  ['Kilt','male'],
  ['Sygnet','male'],
  ['Naszyjnik','female'],
  ['Czapka Prekognicji','any']
 ])assert.equal(requiredSex(item(name),details,catalog),sex,name);
 const bandana=item('Dobra Runiczna Bandana Prekognicji (+5)');
 assert.equal(possibleForSex(bandana,'female',details,catalog),false);
 assert.equal(possibleForSex(bandana,'male',details,catalog),true);
 assert.equal(possibleForSex(bandana,'',details,catalog),true);
 assert.equal(possibleForSex(bandana,'female',{},catalog),true);
 assert.equal(assessProfileAffixes(bandana,{race:'kultysta',sex:'female'},details,catalog).compatible,false);
 assert.match(detailContent(bandana,details,catalog,{sex:'female'}),/nie pasuje do wybranej płci/);
});

test('tattoo excludes incompatible weapon and armour but accepts the actual zero-defence variant',()=>{
 const cap=item('Dobra Tygrysia Czapka Adrenaliny (+5)');
 const helmet=item('Dobry Tygrysi Hełm Adrenaliny (+5)');
 assert.equal(itemDefense(cap,details,catalog),0);
 assert.ok(itemDefense(helmet,details,catalog)>0);
 assert.equal(possibleForTattoo(cap,'mnich',details,catalog),true);
 assert.equal(possibleForTattoo(helmet,'mnich',details,catalog),false);
 assert.equal(assessProfileAffixes(cap,{tattoo:'mnich'},details,catalog).rank,3);
 assert.equal(assessProfileAffixes(helmet,{tattoo:'mnich'},details,catalog).rank,0);
 assert.equal(possibleForTattoo(item('Dobry Shuriken Reakcji (+5)'),'mnich',details,catalog),false);
 assert.equal(itemDefense(cap,{},catalog),null);
});

test('race changes marginal stat valuation without assigning a fixed tattoo pair',()=>{
 const cap=item('Dobra Tygrysia Czapka Adrenaliny (+5)');
 const base=assessProfileAffixes(cap,{tattoo:'mnich'},details,catalog);
 const beast=assessProfileAffixes(cap,{tattoo:'mnich',race:'wladca'},details,catalog);
 assert.ok(base.rank>0&&beast.rank>0);
 const runic=item('Dobra Runiczna Bandana Prekognicji (+5)');
 assert.notEqual(assessProfileAffixes(runic,{race:'kultysta'},details,catalog).score,assessProfileAffixes(runic,{race:'lapacz'},details,catalog).score);
 assert.ok(assessProfileAffixes(cap,{race:'wladca'},details,catalog).rank>0);
});

test('popover explains measured benefit and unknown character requirements',()=>{
 const cap=item('Dobra Tygrysia Czapka Adrenaliny (+5)');
 const content=affixContent(cap,{tattoo:'mnich'},details,catalog);
 assert.match(content,/Dobra para/);
 assert.match(content,/Przyrost względem przedmiotu/);
 assert.match(content,/Dla Mnich/);
 assert.doesNotMatch(content,/forum|Przykład z forum/i);
});
