import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {explore,parseInventory,resultKey,ingredients} from '../engine.js';

const axis=(values,triples)=>({values,blocked:[],refs:{},table:Object.fromEntries(triples.flatMap(([a,b,c])=>[[a+'|'+b,c],[b+'|'+a,c]]))});
const base=axis(['a','middle','target','dead'],[['a','a','middle'],['middle','a','target'],['dead','dead','dead']]);
const data={categories:['one','other'].map(id=>({id,label:id,axes:{base}}))};
const item=(id,base,category='one')=>({id,base,category,prefix:'',suffix:'',rarity:'normal',original:base+' (+1)'});
test('early base filtering preserves intermediate bases and drops irrelevant categories and ingredients',()=>{
 const items=[item(0,'a'),item(1,'a'),item(2,'a'),...Array.from({length:12},(_,i)=>item(i+3,'dead')),...Array.from({length:12},(_,i)=>item(i+15,'a','other'))];
 const out=explore(items,data,3,()=>{},{states:40,filters:{category:'one',base:'target'}});
 assert.equal(out.truncated,false);
 assert.equal(out.results.length,1);
 assert.equal(out.results[0].base,'target');
 assert.equal(out.results[0].steps,2);
 assert.deepEqual(ingredients(out.results[0]).map(i=>i.id).sort(),[0,1,2]);
 assert.ok(out.states<10);
 assert.equal(explore(items,data,3,()=>{},{states:40}).stopReason,'memory');
});
test('unreachable filters finish without filling the state budget',()=>{
 const out=explore(Array.from({length:20},(_,i)=>item(i,'dead')),data,12,()=>{},{states:30,filters:{base:'target'}});
 assert.equal(out.truncated,false);assert.equal(out.states,0);assert.deepEqual(out.results,[]);
});
test('sex-compatible target bases retain ingredients of other bases',()=>{
 const out=explore([item(0,'a'),item(1,'a'),item(2,'a')],data,3,()=>{},{filters:{allowedBases:{one:['target'],other:[]}}});
 assert.deepEqual(out.results.map(n=>n.base),['target']);
 assert.equal(out.results[0].steps,2);
});
test('real-table early filters agree with exhaustive search including alternative ingredient sets',()=>{
 const real=JSON.parse(fs.readFileSync(new URL('../data.json',import.meta.url)));
 const items=parseInventory('Tygrysia Czapka Adrenaliny (+1)\nTygrysia Czapka Adrenaliny (+1)\nHełm (+1)\nCzapka (+1)\nTygrysi Hełm Adrenaliny (+1)',real).items;
 const all=explore(items,real,4);assert.equal(all.truncated,false);
 const signatures=results=>results.map(n=>[resultKey(n),n.steps,n.depth,n.recipes.map(r=>ingredients(r).map(i=>i.id).sort((a,b)=>a-b).join(',')).sort()]).sort();
 for(const filters of [{prefix:'any'},{suffix:'none'},{prefix:'none',suffix:'none'},...all.results.map(n=>({base:n.base,prefix:n.prefix||'none',suffix:n.suffix||'none'}))]){
  const matches=n=>Object.entries(filters).every(([axis,value])=>value==='any'?Boolean(n[axis]):value==='none'?!n[axis]:n[axis]===value);
  const out=explore(items,real,4,()=>{},{filters});
  assert.equal(out.truncated,false);
  assert.deepEqual(signatures(out.results),signatures(all.results.filter(matches)),JSON.stringify(filters));
 }
});
