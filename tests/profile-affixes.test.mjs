import {test} from 'node:test';
import assert from 'node:assert/strict';
import {assessProfileAffixes,tattoos,races} from '../profile-affixes.js';
import {sortResults} from '../result-sort.js';
import {affixContent} from '../item-popover.js';

test('all wiki Moria paths and races are available',()=>{
 assert.equal(Object.keys(tattoos).length,10);
 assert.equal(Object.keys(races).length,5);
 assert.deepEqual(tattoos.lowca_skarbow.weapons,['gun1','ranged']);
 assert.deepEqual(tattoos.zabojca.weapons,['melee1','gun2']);
});

test('tattoo changes matching without treating separate affixes as a pair',()=>{
 const ranged={category:'ranged',base:'kusza',suffix:'driady',steps:1};
 const melee={category:'melee1',base:'noz',prefix:'szybki',suffix:'samobojcy',steps:2};
 const twoAffixes={category:'head',prefix:'runiczny',suffix:'kary'};
 assert.equal(assessProfileAffixes(ranged,{tattoo:'lowca'}).rank,1);
 assert.equal(assessProfileAffixes(ranged,{tattoo:'mnich'}).rank,0);
 assert.equal(assessProfileAffixes(melee,{tattoo:'mnich'}).rank,3);
 assert.equal(assessProfileAffixes(melee,{tattoo:'lowca'}).rank,0);
 assert.equal(assessProfileAffixes(twoAffixes,{tattoo:'lowca_skarbow'}).rank,2);
 assert.equal(assessProfileAffixes(twoAffixes,{tattoo:'lowca_skarbow'}).pair,null);
 assert.deepEqual(sortResults([melee,ranged],'best',{tattoo:'lowca'}),[ranged,melee]);
});

test('race adds affinity but does not lock a tattoo path',()=>{
 const melee={category:'melee1',prefix:'szybki',suffix:'samobojcy'};
 assert.equal(assessProfileAffixes(melee,{race:'wladca',tattoo:'mnich'}).raceAffinity,true);
 assert.equal(assessProfileAffixes(melee,{race:'lapacz',tattoo:'mnich'}).raceAffinity,false);
 assert.equal(assessProfileAffixes(melee,{race:'wladca',tattoo:'lowca'}).rank,0);
});

test('choosing a tattoo preserves general affix advice and explains the profile match',()=>{
 const item={category:'head',prefix:'smiercionosny',suffix:'adrenaliny'};
 const hunter=affixContent(item,{race:'lapacz',tattoo:'lowca'});
 assert.match(hunter,/Dobry prefiks: śmiercionośny/);
 assert.match(hunter,/Dobry sufiks: adrenaliny/);
 assert.match(hunter,/Dopasowanie do ścieżki Łowca: prefiks/);
 const monk=affixContent(item,{race:'wladca',tattoo:'mnich'});
 assert.match(monk,/Dobry prefiks/);
 assert.match(monk,/Dobry sufiks/);
 assert.match(monk,/nie mamy potwierdzonego zastosowania/);
 assert.match(affixContent({category:'head',prefix:'tygrysi',suffix:'adrenaliny'},{tattoo:'lowca'}),/Dobra para/);
});
