import fs from 'node:fs';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {assessProfileAffixes,itemDefense,tattooExamples,tattoos,races} from '../profile-affixes.js';
import {sortResults} from '../result-sort.js';
import {affixContent} from '../item-popover.js';

test('Moria paths and races follow the wiki; every tattoo example has a source',()=>{
 assert.equal(Object.keys(tattoos).length,10);
 assert.equal(Object.keys(races).length,5);
 assert.deepEqual(tattoos.lowca_skarbow.weapons,['gun1','ranged']);
 assert.deepEqual(tattoos.zabojca.weapons,['melee1','gun2']);
 assert.ok(tattooExamples.every(example=>tattoos[example.tattoo]&&example.url.startsWith('https://forum.bloodwars.pl/')));
 const data=JSON.parse(fs.readFileSync(new URL('../data.json',import.meta.url)));
 for(const example of tattooExamples){
  const category=data.categories.find(value=>value.id===example.category);
  assert.ok(category,JSON.stringify(example));
  for(const base of example.bases||[])assert.ok(category.axes.base.values.includes(base),JSON.stringify(example));
  for(const axis of ['prefix','suffix'])if(example[axis])assert.ok(category.axes[axis].values.includes(example[axis]),JSON.stringify(example));
 }
});

test('profile examples need the documented path, base, affixes and possible armour',()=>{
 const monkCap={category:'head',base:'czapka',prefix:'tygrysi',suffix:'adrenaliny'};
 assert.equal(assessProfileAffixes(monkCap,{tattoo:'mnich'},0).rank,3);
 assert.equal(assessProfileAffixes(monkCap,{tattoo:'mnich'},1).rank,0);
 assert.equal(assessProfileAffixes(monkCap,{tattoo:'mnich'}).rank,0);
 assert.equal(assessProfileAffixes({...monkCap,base:'helm'},{tattoo:'mnich'},0).rank,0);
 assert.equal(assessProfileAffixes(monkCap,{tattoo:'lowca_skarbow'},40).rank,0);

 const treasureChest={category:'chest',base:'peleryna',prefix:'elfi',suffix:'siewcy smierci'};
 assert.equal(assessProfileAffixes(treasureChest,{tattoo:'lowca_skarbow'},8).rank,3);
 assert.equal(assessProfileAffixes(treasureChest,{tattoo:'lowca_skarbow'},7).rank,0);
 assert.equal(assessProfileAffixes(treasureChest,{tattoo:'mnich'},0).rank,0);
 const shuriken={category:'ranged',base:'shurek',suffix:'reakcji',steps:1};
 assert.equal(assessProfileAffixes(shuriken,{tattoo:'lowca_skarbow'}).rank,1);
 assert.equal(assessProfileAffixes(shuriken,{tattoo:'mnich'}).rank,0);
 assert.equal(assessProfileAffixes({...shuriken,base:'kusza'},{tattoo:'lowca_skarbow'}).rank,0);
});

test('race alone cannot turn a forum example into a special affix match',()=>{
 const item={category:'melee1',base:'piesc niebios',prefix:'szybki',suffix:'samobojcy',steps:2};
 assert.deepEqual(assessProfileAffixes(item,{race:'wladca',tattoo:'mnich'}),assessProfileAffixes(item,{race:'lapacz',tattoo:'mnich'}));
 assert.equal(assessProfileAffixes(item,{race:'wladca'}).rank,0);
 const shuriken={category:'ranged',base:'shurek',suffix:'reakcji',steps:1};
 assert.deepEqual(sortResults([item,shuriken],'best',{tattoo:'lowca_skarbow'}),[shuriken,item]);
});

test('armour check reads the actual variant, including prefix defence changes',()=>{
 const details={components:{head:JSON.parse(fs.readFileSync(new URL('../item-components/head.json',import.meta.url)))}};
 const catalog=JSON.parse(fs.readFileSync(new URL('../item-catalog.json',import.meta.url)));
 const cap={category:'head',base:'czapka',prefix:'tygrysi',suffix:'adrenaliny',original:'Dobra Tygrysia Czapka Adrenaliny (+5)'};
 const helmet={...cap,base:'helm',original:'Dobry Tygrysi Hełm Adrenaliny (+5)'};
 assert.equal(itemDefense(cap,details,catalog),0);
 assert.ok(itemDefense(helmet,details,catalog)>0);
 assert.equal(itemDefense(cap,{},catalog),null);
});

test('popover keeps general advice but links only a verified path example',()=>{
 const cap={category:'head',base:'czapka',prefix:'tygrysi',suffix:'adrenaliny'};
 const matched=affixContent(cap,{tattoo:'mnich'},0);
 assert.match(matched,/Dobra para/);
 assert.match(matched,/Historyczny przykład dla ścieżki Mnich: para/);
 assert.match(matched,/Przykład z forum/);
 const unmatched=affixContent(cap,{tattoo:'mnich'},2);
 assert.match(unmatched,/Dobra para/);
 assert.doesNotMatch(unmatched,/Przykład z forum/);
 assert.match(unmatched,/Nie mamy źródłowego przykładu/);
 const gunner={category:'rings',base:'pierscien',prefix:'sloneczny',suffix:'madrosci'};
 assert.equal(assessProfileAffixes(gunner,{tattoo:'gangster'}).rank,3);
 assert.match(affixContent(gunner,{tattoo:'gangster'}),/Przykład z forum/);
});
