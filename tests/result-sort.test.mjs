import assert from 'node:assert/strict';
import {test} from 'node:test';
import fs from 'node:fs';
import {parseInventory} from '../engine.js';
import {sortResults} from '../result-sort.js';

test('result order uses measured pairs, fewest fusions, and most fusions',()=>{
 const data=JSON.parse(fs.readFileSync(new URL('../data.json',import.meta.url)));
 const details={components:{head:JSON.parse(fs.readFileSync(new URL('../item-components/head.json',import.meta.url)))}};
 const parsed=name=>parseInventory(name,data).items[0];
 const short={...parsed('Dobra Czapka (+5)'),steps:1};
 const long={...parsed('Dobra Czapka (+5)'),steps:5};
 const strongLong={...parsed('Dobra Tygrysia Czapka Adrenaliny (+5)'),steps:4};
 const strongShort={...parsed('Dobra Tygrysia Czapka Adrenaliny (+5)'),steps:2};
 const results=[short,long,strongLong,strongShort];
 assert.deepEqual(sortResults(results,'best',undefined,details),[strongShort,strongLong,short,long]);
 assert.deepEqual(sortResults(results,'fewest'),[short,strongShort,strongLong,long]);
 assert.deepEqual(sortResults(results,'most'),[long,strongLong,strongShort,short]);
 assert.deepEqual(results,[short,long,strongLong,strongShort]);
});

test('tattoo sort keeps a compatible base ahead of an incompatible general pair',()=>{
 const data=JSON.parse(fs.readFileSync(new URL('../data.json',import.meta.url)));
 const details={components:{head:JSON.parse(fs.readFileSync(new URL('../item-components/head.json',import.meta.url)))}};
 const parsed=name=>parseInventory(name,data).items[0];
 const compatible={...parsed('Dobra Tygrysia Czapka (+5)'),steps:2};
 const incompatible={...parsed('Dobry Tygrysi Hełm Adrenaliny (+5)'),steps:1};
 assert.deepEqual(sortResults([incompatible,compatible],'best',{tattoo:'mnich'},details),[compatible,incompatible]);
});

test('tier sort uses output affix sum, ignores profile and quality, and breaks ties by steps',()=>{
 const data=JSON.parse(fs.readFileSync(new URL('../data.json',import.meta.url)));
 const {prefix,suffix}=data.categories.find(c=>c.id==='head').axes;
 const item=(p,s,steps,quality=0)=>({category:'head',base:'czapka',prefix:p,suffix:s,steps,class:quality});
 const empty=item('','',1),low=item(prefix.values[0],suffix.values[0],1,17);
 const prefixOnly=item(prefix.values[3],'',2),suffixOnly=item('',suffix.values[3],2);
 const highSlow=item(prefix.values[2],suffix.values[2],4);
 const highFast=item(prefix.values[2],suffix.values[2],2);
 const results=[empty,highSlow,low,prefixOnly,highFast,suffixOnly];
 const sorted=sortResults(results,'tiers',{tattoo:'mnich',race:'ssak'},undefined,undefined,[],data);
 assert.deepEqual(sorted,[highFast,highSlow,prefixOnly,suffixOnly,low,empty]);
 assert.deepEqual(results,[empty,highSlow,low,prefixOnly,highFast,suffixOnly]);
});
