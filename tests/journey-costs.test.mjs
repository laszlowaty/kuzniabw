import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {stageCost,liveAdvice,planJourneys} from '../journey-sim.js';

const data=JSON.parse(fs.readFileSync(new URL('../journey-data.json',import.meta.url)));
// Moria final-boss table, including level 8 Act I = 80 (2 × 40).
const costs={1:[24,32,40,48,56,64,72,80,88],2:[72,84,96,108,120,132,144,156,168],3:[144,162,180,198,216,234,252,270,288]};

test('all 81 final bosses charge the documented stat, combo and blood costs in live play',()=>{
 const bossOnly={...data,routes:Object.fromEntries(Array.from({length:9},(_,i)=>[i+1,{nodes:0}]))};
 for(const location of data.locations)for(let level=1;level<=9;level++){
  const cost=costs[location.act][level-1],boss=data.bosses.find(b=>b.id===location.boss);
  const run={locationId:location.id,level,stats:{},blood:cost*15,log:[]};
  assert.equal(stageCost(data,location.act,level,'boss'),cost,`${location.id} ${level}`);
  const first=liveAdvice(bossOnly,run,{shown:boss.rounds[0].random[0]});
  assert.equal(first.options.find(o=>o.pay===boss.rounds[0].fixed).costs[0].amount,cost);
  assert.equal(first.options.find(o=>o.pay==='blood').costs[0].amount,cost*5);
  run.log=boss.rounds.slice(0,2).map(r=>({type:'round',shown:r.random[0],pay:'blood'}));
  const last=liveAdvice(bossOnly,run);
  assert.equal(last.valid,true);
  assert.equal(last.blood,cost*5);
  assert.deepEqual(last.options.find(o=>o.pay==='combo').costs.map(c=>c.amount),[Math.ceil(cost*0.75),Math.ceil(cost*0.75)]);
  assert.equal(last.options.find(o=>o.pay===boss.rounds[2].single).costs[0].amount,cost);
  assert.equal(last.options.find(o=>o.pay==='blood').costs[0].amount,cost*5);
 }
});

test('Troll King level 5 no longer reports certainty with the previously underpriced budget',()=>{
 const input={level:5,blood:140,stats:{sila:93,zwinnosc:53,odpornosc:91,wyglad:91,charyzma:58,wplywy:84,spostrzegawczosc:96,inteligencja:46,wiedza:65}};
 const d={...data,locations:data.locations.filter(l=>l.id==='kanaly')};
 const [result]=planJourneys(d,input);
 assert.equal(result.bossCost,56);
 assert.equal(result.allCertain,false);
 assert.ok(result.completion>0.58&&result.completion<0.59);
 const old={...d,costs:{...d.costs,type:{...d.costs.type,boss:1.5}}};
 assert.equal(planJourneys(old,input)[0].completion,1,'the old rate reproduced the false 100%');
});
