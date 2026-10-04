import fs from 'node:fs';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {assessAffixes,isStrongCombo,recommendationSources} from '../strong-combos.js';
import {sortResults} from '../result-sort.js';
import {affixContent} from '../item-popover.js';
import {parseInventory} from '../engine.js';
const data=JSON.parse(fs.readFileSync(new URL('../data.json',import.meta.url)));

test('standalone and paired recommendations match actual imported Polish names',()=>{
 const {items,errors}=parseInventory('Śmiercionośna Bandana Prekognicji (+1)\nElfia Peleryna Siewcy Śmierci (+1)\nSłoneczny Sygnet Koncentracji (+1)\nTańczący Łańcuch Szczęścia (+1)\nJastrzębi Pierścień (+1)\nNóż do rzucania Driady (+1)\nMagnum (+1)',data);
 assert.deepEqual(errors,[]);
 assert.deepEqual(items.map(i=>assessAffixes(i).rank),[3,3,3,3,1,1,0]);
 assert.equal(assessAffixes(items[4]).suffix.length,0);
 assert.equal(assessAffixes(items[5]).prefix.length,0);
 assert.match(affixContent(items[3]),/Wyprawy/);
 assert.match(affixContent(items[5]),/Dobry sufiks: driady/);
 assert.equal(affixContent(items[6]),'');
});

test('two good affixes do not automatically create a recommended pair',()=>{
 const item={category:'head',prefix:'smiercionosny',suffix:'adrenaliny'};
 assert.equal(assessAffixes(item).rank,2);
 assert.equal(isStrongCombo(item),false);
 assert.match(affixContent(item),/Dobry prefiks/);
 assert.match(affixContent(item),/Dobry sufiks/);
 assert.doesNotMatch(affixContent(item),/<strong>Dobra para/);
 for(const item of [null,{}, {category:'gun1',prefix:'demoniczny',suffix:'samobojcy'}, {category:'chest',prefix:'elfie',suffix:'nocy'}])assert.equal(assessAffixes(item).rank,0);
});

test('every recommended affix has a reason and a known source, with no bare pairs',()=>{
 for(const c of data.categories){
  for(const axis of ['prefix','suffix'])for(const value of c.axes[axis]?.values||[]){
   const assessment=assessAffixes({category:c.id,[axis]:value});
   assert.equal(assessment.pair,null);
   for(const rule of assessment[axis]){
    assert.ok(rule.reason);
    assert.ok(recommendationSources[rule.source]?.url.startsWith('https://forum.bloodwars.pl/'));
   }
  }
 }
});

test('best order uses pairs, two affixes, one affix, then other items; steps break ties',()=>{
 const pair={category:'head',prefix:'tygrysi',suffix:'adrenaliny',steps:5};
 const both={category:'head',prefix:'smiercionosny',suffix:'adrenaliny',steps:4};
 const prefix={category:'neck',prefix:'jastrzebi',steps:3};
 const suffix={category:'ranged',suffix:'reakcji',steps:2};
 const plain={category:'gun1',steps:1};
 const items=[plain,prefix,both,suffix,pair];
 assert.deepEqual(sortResults(items,'best'),[pair,both,suffix,prefix,plain]);
 assert.deepEqual(sortResults(items,'fewest'),[plain,suffix,prefix,both,pair]);
 assert.deepEqual(sortResults(items,'most'),[pair,both,prefix,suffix,plain]);
 assert.deepEqual(items,[plain,prefix,both,suffix,pair]);
});
