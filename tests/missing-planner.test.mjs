import fs from 'node:fs';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {parseInventory,ingredients,merge,resultKey,itemClass} from '../engine.js';
import {createGoalTarget,findMissingPlans} from '../missing-planner.js';

const data=JSON.parse(fs.readFileSync(new URL('../data.json',import.meta.url)));
const parse=text=>{const result=parseInventory(text,data);assert.deepEqual(result.errors,[]);return result.items;};
const target=parse('Czapka Prekognicji')[0];

test('target selection accepts independent base, prefix and suffix from one category',()=>{
 const selected=createGoalTarget(data,'head','czapka','runiczny','prekognicji');
 assert.equal(selected.category,'head');
 assert.equal(selected.base,'czapka');
 assert.equal(selected.prefix,'runiczny');
 assert.equal(selected.suffix,'prekognicji');
 assert.equal(selected.rarity,'normal');
 assert.equal(resultKey(selected),resultKey(parse('Runiczna Czapka Prekognicji')[0]));
 assert.throws(()=>createGoalTarget(data,'head','czapka','nieistniejacy','prekognicji'));
 assert.throws(()=>createGoalTarget(data,'head','czapka','','nieistniejacy'));
 assert.throws(()=>createGoalTarget(data,'gun1','czapka','',''));
 const gunBase=data.categories.find(category=>category.id==='gun1').axes.base.values[0];
 assert.equal(createGoalTarget(data,'gun1',gunBase).base,gunBase);
 assert.throws(()=>createGoalTarget(data,'gun1',gunBase,'runiczny'));
});

test('a missing ingredient is derived from the actual fusion table',()=>{
 const owned=parse('Czapka Gladiatora (+1)');
 const result=findMissingPlans(owned,target,data,{maxSteps:2});
 assert.equal(result.partial,false);
 assert.equal(result.plans[0].missingCount,1);
 assert.equal(result.plans[0].steps,1);
 const leaves=ingredients(result.plans[0]);
 assert.equal(leaves.filter(i=>!i.missing).length,1);
 assert.equal(resultKey(merge(leaves[0],leaves[1],data)),resultKey(target));
});

test('when inventory cannot help, two purchased ingredients are shown without claiming they are owned',()=>{
 const result=findMissingPlans(parse('Czapka'),target,data,{maxSteps:2});
 assert.equal(result.plans[0].missingCount,2);
 assert.equal(result.plans[0].steps,1);
 assert.equal(ingredients(result.plans[0]).filter(i=>!i.missing).length,0);
});

test('existing two-item recipe takes priority over purchase suggestions',()=>{
 const owned=parse('Czapka Gladiatora (+1)\nCzapka Magii (+1)');
 const result=findMissingPlans(owned,target,data,{maxSteps:2});
 assert.equal(result.plans[0].missingCount,0);
 assert.equal(result.plans[0].steps,1);
});

test('two fusions can use one owned item and two missing items',()=>{
 const values=['a','b','x','c','goal'],table={'a|b':'x','b|a':'x','x|c':'goal','c|x':'goal'};
 const toy={categories:[{id:'toy',label:'Toy',axes:{base:{values,table,blocked:[],refs:{}}}}]};
 const owned=[{id:0,category:'toy',rarity:'normal',base:'a',prefix:'',suffix:'',original:'A (+1)'}];
 const goal={category:'toy',rarity:'normal',base:'goal',prefix:'',suffix:'',original:'Goal'};
 const result=findMissingPlans(owned,goal,toy,{maxSteps:2});
 assert.equal(result.plans[0].missingCount,2);
 assert.equal(result.plans[0].steps,2);
 assert.deepEqual(ingredients(result.plans[0]).filter(i=>i.missing).map(i=>i.base),['b','c']);
 assert.equal(resultKey(result.plans[0]),resultKey(goal));
 assert.equal(itemClass(result.plans[0]),1);
});
