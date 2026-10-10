import assert from 'node:assert/strict';
import {test} from 'node:test';
import {missingPlanStats,sortMissingPlans} from '../missing-order.js';

const data={categories:[{id:'head',axes:{prefix:{values:['p1','p2','p3','p4']},suffix:{values:['s1','s2','s3','s4']}}}]};
const item=(prefix='',suffix='',missing=true)=>({category:'head',prefix,suffix,missing});
const plan=(left,right,steps=1)=>({left,right,steps});
const ordered=(plans,order)=>sortMissingPlans(plans,new Map(plans.map(p=>[p,missingPlanStats(p,data)])),order);

test('tiers count each purchased copy, but exclude owned and intermediate affixes',()=>{
 const missing=item('p2','s3');
 const p=plan({...plan(missing,missing),prefix:'p4',suffix:'s4'},item('p4','s4',false),2);
 assert.deepEqual(missingPlanStats(p,data),{sum:10,highest:3,count:2,steps:2});
 assert.equal(missingPlanStats(plan(item(),item('', '',false)),data).sum,0);
});

test('tier ordering allows two cheap purchases before one high tier purchase; owned plans always lead',()=>{
 const expensive=plan(item('p4','s4'),item('','',false));
 const cheap=plan(item('p1'),item('','s1'),2);
 const owned=plan(item('p4','s4',false),item('p4','s4',false),5);
 const plans=[expensive,cheap,owned];
 assert.deepEqual(ordered(plans,'tiers'),[owned,cheap,expensive]);
 assert.deepEqual(ordered(plans,'missing'),[owned,expensive,cheap]);
 assert.deepEqual(ordered(plans,'steps'),[owned,expensive,cheap]);
 assert.deepEqual(plans,[expensive,cheap,owned]);
});

test('equal sums prefer lower peak tier, then fewer purchases, then fewer fusions; ties stay stable',()=>{
 const peak=plan(item('p4'),item('','',false));
 const two=plan(item('p2'),item('','s2'),2);
 const slow=plan(item('p2','s2'),item('','',false),3);
 const fast=plan(item('p2','s2'),item('','',false));
 const tie={...fast};
 assert.deepEqual(ordered([peak,two,slow,fast,tie],'tiers'),[fast,tie,slow,two,peak]);
});
