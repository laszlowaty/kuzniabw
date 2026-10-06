import fs from 'node:fs';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {assessAffixes,isStrongCombo} from '../strong-combos.js';
import {sortResults} from '../result-sort.js';
import {affixContent} from '../item-popover.js';
import {parseInventory} from '../engine.js';

const data=JSON.parse(fs.readFileSync(new URL('../data.json',import.meta.url)));
const details={components:{}};
for(const category of data.categories)details.components[category.id]=JSON.parse(fs.readFileSync(new URL(`../item-components/${category.id}.json`,import.meta.url)));
const item=name=>{const result=parseInventory(name,data);assert.deepEqual(result.errors,[]);return result.items[0];};

test('affixes are ranked by active R21 stat deltas, not by historical lists',()=>{
 const pair=item('Dobra Tygrysia Czapka Adrenaliny (+5)');
 const plain=item('Dobra Czapka (+5)');
 const single=item('Dobra Szybka Pięść Niebios (+5)');
 assert.equal(assessAffixes(pair,details).rank,3);
 assert.equal(assessAffixes(plain,details).rank,0);
 assert.equal(assessAffixes(single,details).rank,1);
 assert.match(affixContent(pair,{},details),/zwinność/);
 assert.doesNotMatch(affixContent(pair,{},details),/forum|Źródło/i);
});

test('the same prefix and suffix keep their labels across quality and upgrade levels',()=>{
 const variants=[
  item('Śmiercionośna Czapka Prekognicji (+2)'),
  item('Dobra Śmiercionośna Czapka Prekognicji (+2)'),
  item('Dobra Śmiercionośna Czapka Prekognicji (+5)'),
  item('Doskonała Śmiercionośna Czapka Prekognicji (+2)')
 ];
 const assessments=variants.map(value=>assessAffixes(value,details,{tattoo:'rewolwerowiec'}));
 assert.ok(assessments.every(value=>value.pair));
 assert.deepEqual(assessments.map(value=>value.rank),[3,3,3,3]);
 assert.deepEqual(assessments.map(value=>[value.prefix[0].good,value.suffix[0].good]),
  [[true,true],[true,true],[true,true],[true,true]]);
});

test('incomplete set bonuses are not counted on one item; other parts give only potential',()=>{
 const complete=parseInventory('Dobry Słoneczny Pierścień Mądrości (+5)\nDobry Słoneczny Krawat Koncentracji (+5)\nDobry Słoneczny Sygnet Koncentracji (+5)',data);
 assert.deepEqual(complete.errors,[]);
 const [ring]=complete.items;
 const alone=assessAffixes(ring,details);
 const together=assessAffixes(ring,details,{},complete.items);
 assert.ok(together.score>=alone.score);
 assert.match(together.prefix[0]?.reason||'',/mogą utworzyć zestaw/);
});

test('recommendations need component data, a known quality and the correct category',()=>{
 const cap=item('Dobra Tygrysia Czapka Adrenaliny (+5)');
 assert.equal(assessAffixes(cap).rank,0);
 assert.equal(assessAffixes({...cap,category:'gun1'},details).rank,0);
 assert.equal(isStrongCombo({...cap,suffix:''},details),false);
 assert.equal(assessAffixes(null,details).rank,0);
});

test('best sort uses measured pair rank before fusion count',()=>{
 const pair={...item('Dobra Tygrysia Czapka Adrenaliny (+5)'),steps:5};
 const plain={...item('Dobra Czapka (+5)'),steps:1};
 assert.deepEqual(sortResults([plain,pair],'best',undefined,details),[pair,plain]);
 assert.deepEqual(sortResults([plain,pair],'fewest',undefined,details),[plain,pair]);
});
