import fs from 'node:fs';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {estimateTiers} from '../tier-estimate.js';
import {parseInventory,merge} from '../engine.js';
const data=JSON.parse(fs.readFileSync(new URL('../data.json',import.meta.url)));
const axis=(values,result)=>({values,blocked:[],refs:{},table:Object.fromEntries(values.flatMap(a=>values.map(b=>[a+'|'+b,result])))});
const fixture={categories:[{id:'test',axes:{base:axis(['base'],'base'),prefix:axis(['p1','p2','p3','p4'],'p4'),suffix:axis(['s1','s2','s3'],'s1')}}]};
const item=(id,prefix='p1',suffix='')=>({id,category:'test',base:'base',prefix,suffix,rarity:'normal',original:'Base (+1)'});
test('tier estimate measures each axis against the higher ingredient, including losses and missing affixes',()=>{
 const result=estimateTiers([item(0,'p1','s3'),item(1,'p2','s2')],fixture).pairs[0];
 assert.equal(result.kind,'mixed');assert.equal(result.axes.prefix.delta,2);assert.equal(result.axes.suffix.delta,-2);assert.equal(result.gain,0);
 const missing=estimateTiers([item(0,'p1','s3'),item(1)],fixture).pairs[0];
 assert.equal(missing.axes.suffix.result,0);assert.equal(missing.axes.suffix.delta,-3);
});
test('physical copies are separate and every pair is exactly one fusion',()=>{
 const result=estimateTiers([item(0),item(1),item(2)],fixture);
 assert.equal(result.pairs.length,3);assert.ok(result.pairs.every(p=>p.kind==='gain'&&p.gain===3&&p.node.steps===1&&!p.node.left.left));
 assert.ok(result.items.every(i=>i.status==='gain'));
 assert.equal(estimateTiers([item(0)],fixture).items[0].status,'unavailable');
});
test('mixed, neutral and loss shelf statuses remain distinct from unavailable',()=>{
 assert.equal(estimateTiers([item(0,'p1','s3'),item(1,'p2','s2')],fixture).items[0].status,'mixed');
 const neutral=estimateTiers([item(0,'p4','s1'),item(1,'p4','s1')],fixture);
 assert.equal(neutral.pairs[0].kind,'neutral');assert.equal(neutral.items[0].status,'none');
 const loss=estimateTiers([item(0,'p4','s3'),item(1,'p4','s3')],fixture);
 assert.equal(loss.pairs[0].kind,'loss');assert.equal(loss.items[0].status,'none');
});
test('real tables retain all permitted physical pairs and reject unsupported qualities and rarity',()=>{
 const {items}=parseInventory('Utwardzana Czapka Podróżnika (+1)\nWzmocniona Czapka Przezorności (+1)\nPomocna Czapka Ochrony (+1)\nEpicka Czapka\nLegendarny Hełm (+1)\nMagnum (+1)\nMagnum (+1)',data);
 const result=estimateTiers(items,data);
 const expected=[];for(let i=0;i<3;i++)for(let j=i+1;j<3;j++)if(merge(items[i],items[j],data))expected.push([i,j]);
 assert.deepEqual(result.pairs.map(p=>[p.node.left.id,p.node.right.id]).sort(),expected.sort());
 assert.ok(result.items.slice(3).every(i=>i.status==='unavailable'));
});
test('blocked table pairs stay excluded',()=>{
 const blocked=structuredClone(fixture);blocked.categories[0].axes.prefix.blocked=['p1|p2'];
 assert.equal(estimateTiers([item(0),item(1,'p2')],blocked).pairs.length,0);
});
