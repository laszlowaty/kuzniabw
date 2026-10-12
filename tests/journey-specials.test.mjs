import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {SPECIAL_RULES,specialCost} from '../journey-specials.js';

const data=JSON.parse(fs.readFileSync(new URL('../journey-data.json',import.meta.url)));
test('every catalog special has an explicit effect rule and a unique ID within its boss',()=>{
 for(const boss of data.bosses){
  assert.equal(new Set(boss.specials.map(s=>s.id)).size,boss.specials.length,boss.name);
  for(const s of boss.specials)assert.ok(SPECIAL_RULES[s.id],`${boss.name}: ${s.id}`);
 }
});
test('special costs use the initial stat, round up, and accept an observed cost',()=>{
 assert.equal(specialCost({id:'calm',param:'wyglad'},{wyglad:101}),26);
 assert.equal(specialCost({id:'weakness',param:'wiedza'},{wiedza:100}),34);
 assert.equal(specialCost({id:'restore',param:'sila'},{sila:100}),25);
 assert.equal(specialCost({id:'restore',param:'sila'},{sila:100},17),17);
 assert.throws(()=>specialCost({id:'calm',param:'wyglad'},{wyglad:100},-1));
});
