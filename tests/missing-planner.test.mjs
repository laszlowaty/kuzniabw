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

test('the selected fusion limit permits a three-step recipe from owned ingredients',()=>{
 const values=['a','b','x','c','y','d','goal'];
 const table={'a|b':'x','b|a':'x','x|c':'y','c|x':'y','y|d':'goal','d|y':'goal'};
 const toy={categories:[{id:'toy',label:'Toy',axes:{base:{values,table,blocked:[],refs:{}}}}]};
 const owned=['a','b','c','d'].map((base,id)=>({id,category:'toy',rarity:'normal',base,prefix:'',suffix:'',original:`${base} (+1)`}));
 const goal={category:'toy',rarity:'normal',base:'goal',prefix:'',suffix:'',original:'Goal'};
 assert.ok(findMissingPlans(owned,goal,toy,{maxSteps:2}).plans.every(plan=>plan.steps<=2));
 const result=findMissingPlans(owned,goal,toy,{maxSteps:3});
 assert.equal(result.partial,false);
 assert.equal(result.plans[0].steps,3);
 assert.equal(result.plans[0].missingCount,0);
 assert.deepEqual(ingredients(result.plans[0]).map(item=>item.base).sort(),['a','b','c','d']);
 assert.throws(()=>findMissingPlans(owned,goal,toy,{maxSteps:26}),/1 do 25/);
});

test('a longer recipe can identify two missing ingredients after owned fusions',()=>{
 const values=['a','b','x','c','y','d','z','e','goal'];
 const table={'a|b':'x','b|a':'x','x|c':'y','c|x':'y','y|d':'z','d|y':'z','z|e':'goal','e|z':'goal'};
 const toy={categories:[{id:'toy',label:'Toy',axes:{base:{values,table,blocked:[],refs:{}}}}]};
 const owned=['a','b','c'].map((base,id)=>({id,category:'toy',rarity:'normal',base,prefix:'',suffix:'',original:`${base} (+1)`}));
 const goal={category:'toy',rarity:'normal',base:'goal',prefix:'',suffix:'',original:'Goal'};
 const result=findMissingPlans(owned,goal,toy,{maxSteps:4});
 assert.equal(result.partial,false);
 assert.equal(result.plans[0].steps,4);
 assert.deepEqual(ingredients(result.plans[0]).filter(item=>item.missing).map(item=>item.base),['d','e']);
});
