import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {SIMULATIONS,stageCost,comboCost,routeLayout,chanceLabel,chanceTone,rollRoute,routeChance,planJourneys,hardestCertain,liveAdvice,mulberry32} from '../journey-sim.js';

const data=JSON.parse(fs.readFileSync(new URL('../journey-data.json',import.meta.url)));
const allStats=v=>Object.fromEntries(data.params.map(p=>[p.id,v]));
// Same stat in every slot: R1, R2 and the single R3 path each cost one boss payment.
const only=(id,name=id)=>({id,name,rounds:[{fixed:id,random:[id]},{fixed:id,random:[id]},{combo:[id,id],single:id}],specials:[]});
// X=10 on every level: monster 10, mini boss 15, boss 20, boss combo 15, boss blood 100.
// Route nodes per level: 1 → 2 nodes, 2 → 1 node, 5 → none, 6 → mini boss only.
const ROUTES={1:{nodes:2},2:{nodes:1},5:{nodes:0},6:{nodes:0,miniAfter:0}};
const fixture=(bosses,locations,routes=ROUTES)=>({
 params:['a','b','c','d'].map(id=>({id,label:id.toUpperCase()})),
 costs:{acts:{1:{base:10,perLevel:0}},levels:{min:1,max:9},type:{monster:1,miniboss:1.5,boss:2},blood:5,combo:0.75},
 routes,
 encounters:[{name:'Wróg',type:'enemy',fixed:'a',random:['b','c']},{name:'Burza',type:'timed',fixed:'a',waitMinutes:5}],
 bosses,locations:locations??[{id:'home',name:'Dom',act:1,boss:bosses[0].id}]
});
const enemy={encounter:0,shown:'b'},storm={encounter:1,shown:null};

test('cost per encounter follows act and difficulty; mini boss +50%, final boss +50% or +100% with a mini boss on the route',()=>{
 const levels=[1,2,3,4,5,6,7,8,9];
 assert.deepEqual(levels.map(l=>stageCost(data,1,l,'monster')),[12,16,20,24,28,32,36,40,44]);
 assert.deepEqual(levels.map(l=>stageCost(data,2,l,'monster')),[36,42,48,54,60,66,72,78,84],'Szklana Pustynia, levels 1–9');
 assert.equal(stageCost(data,3,6,'monster'),117);
 assert.equal(stageCost(data,3,9,'monster'),144);
 assert.equal(stageCost(data,3,6,'miniboss'),176,'117 × 1.5 = 175.5, rounded up');
 assert.equal(stageCost(data,3,6,'boss'),234,'mini boss on the route: final boss × 2');
 assert.equal(stageCost(data,3,5,'boss'),162,'no mini boss: final boss × 1.5');
 assert.deepEqual(levels.map(l=>stageCost(data,2,l,'boss')),[54,63,72,81,90,132,144,156,168]);
 assert.equal(stageCost(data,2,8,'boss'),156,'Szklana Pustynia, level 8');
 assert.equal(comboCost(data,234),176);
 assert.equal(comboCost(data,stageCost(data,1,6,'boss')),48);
});

test('route layout per level is the same for every location: nodes, then the mini boss after node 3 from level 6',()=>{
 assert.deepEqual([1,2,3,4,5,6,7,8,9].map(l=>routeLayout(data,l)),[
  {nodes:3,miniAfter:null},{nodes:4,miniAfter:null},{nodes:4,miniAfter:null},{nodes:5,miniAfter:null},{nodes:5,miniAfter:null},
  {nodes:5,miniAfter:3},{nodes:6,miniAfter:3},{nodes:6,miniAfter:3},{nodes:7,miniAfter:3}]);
 const rows=planJourneys(data,{stats:allStats(0),level:6});
 assert.ok(rows.every(r=>r.routeLength===5&&r.miniBossPresent));
});

test('round 3 single stat costs the normal boss cost (Skarbiec, level 5: 162)',()=>{
 const bossOnly={...data,routes:{...data.routes,5:{nodes:0}}};
 const stats={...allStats(0),wplywy:162,spostrzegawczosc:162,odpornosc:162};
 assert.equal(routeChance(bossOnly,{stats,level:5},'skarbiec',[]).chance,1);
 assert.equal(routeChance(bossOnly,{stats:{...stats,odpornosc:161},level:5},'skarbiec',[]).chance,0);
});

test('blood pays the whole cost or nothing; it never tops up a stat',()=>{
 const d=fixture([only('d')]),run=(stats,blood)=>routeChance(d,{stats,blood,level:1},'home',[enemy]);
 assert.deepEqual(run({a:9,b:9,d:60},49),{chance:0,nodes:0,miniKill:0,bossKill:0});
 assert.equal(run({a:9,d:60},0).nodes,0);
 assert.deepEqual(run({a:9,b:9,d:60},50),{chance:1,nodes:1,miniKill:null,bossKill:1});
});

test('timed obstacles are waited out for free or paid when the toggle says so',()=>{
 const d=fixture([only('a')]),run=(a,waitTimed)=>routeChance(d,{stats:{a},level:1,waitTimed},'home',[storm]);
 assert.equal(run(60,true).chance,1);
 assert.equal(run(60,false).chance,0,'paying 10 leaves 50 for a boss that needs 60');
 assert.deepEqual(run(0,false),{chance:0,nodes:1,miniKill:null,bossKill:0},'cannot pay, so it waits and continues');
});

test('boss choices are planned ahead: paying with the random slot keeps the round 3 stat',()=>{
 // Greedy fixed-first pays a, then b, and has nothing left for round 3.
 const boss={id:'smart',name:'Smart',rounds:[{fixed:'a',random:['b']},{fixed:'b',random:['c']},{combo:['b','c'],single:'a'}],specials:[]};
 assert.equal(routeChance(fixture([boss]),{stats:{a:20,b:20,c:20},level:1},'home',[]).chance,1);
});

test('random boss slots are averaged exactly, not sampled',()=>{
 // Round 1 shows b (payable) or c (only blood); blood covers exactly two of the three rounds.
 const boss={id:'half',name:'Half',rounds:[{fixed:'a',random:['b','c']},{fixed:'c',random:['c']},{combo:['c','c'],single:'c'}],specials:[]};
 assert.equal(routeChance(fixture([boss]),{stats:{b:20},blood:200,level:1},'home',[]).chance,0.5);
});

test('mini boss comes from the other locations only and its identity is averaged exactly',()=>{
 const d=fixture([only('d','Own'),only('c','Easy'),only('b','Hard')],[
  {id:'home',name:'Dom',act:1,boss:'d'},{id:'easy',name:'Łatwa',act:1,boss:'c'},{id:'hard',name:'Trudna',act:1,boss:'b'}]);
 // The own boss as a mini boss would also cost 45 d and add a third, failing candidate.
 const r=routeChance(d,{stats:{c:45,d:60},level:6},'home',[]);
 assert.deepEqual(r,{chance:0.5,nodes:0,miniKill:0.5,bossKill:0.5});
 assert.equal(routeChance(d,{stats:{c:45,d:60},level:5},'home',[]).chance,1,'no mini boss below level 6');
});

test('mini boss position comes from the route layout: after the given number of nodes',()=>{
 const locations=[{id:'home',name:'Dom',act:1,boss:'d'},{id:'other',name:'Inna',act:1,boss:'a'}],input={stats:{a:45,d:60},level:6};
 const late=fixture([only('d','Own'),only('a','Mini')],locations,{6:{nodes:1,miniAfter:1}});
 assert.deepEqual(routeChance(late,input,'home',[enemy]),{chance:0,nodes:1,miniKill:0,bossKill:0});
 const early=fixture([only('d','Own'),only('a','Mini')],locations,{6:{nodes:1,miniAfter:0}});
 assert.deepEqual(routeChance(early,input,'home',[enemy]),{chance:0,nodes:0,miniKill:1,bossKill:0});
});

test('100 seeded routes per location give the same numbers for the same input',()=>{
 const input={stats:allStats(300),blood:500,level:7};
 const a=planJourneys(data,input),b=planJourneys(data,input);
 assert.deepEqual(a,b);
 assert.equal(SIMULATIONS,100);
 assert.ok(a.every(r=>r.simulations===100&&r.routeLength===6));
 const roll=seed=>JSON.stringify(rollRoute(data,6,mulberry32(seed)));
 assert.equal(roll(1),roll(1));
 assert.notEqual(roll(1),roll(2));
});

test('huge stats finish everything; no stats finish nothing',()=>{
 for(const r of planJourneys(data,{stats:allStats(1e6),level:9})){
  assert.equal(r.completion,1);assert.equal(r.allCertain,true);assert.equal(r.avgNodes,7);
  assert.equal(r.miniBossPresent,true);assert.equal(r.miniBossKillChance,1);assert.equal(r.bossKillChance,1);
 }
 for(const r of planJourneys(data,{stats:allStats(0),level:3,waitTimed:false})){
  assert.equal(r.completion,0);assert.equal(r.allCertain,false);assert.equal(r.miniBossPresent,false);
  assert.equal(r.miniBossKillChance,null);assert.ok(r.avgNodes<4,'only timed obstacles can be passed');
 }
});

test('hardest certain level is searched from the top and agrees with the planner at that level and one above',()=>{
 const input={stats:allStats(300),blood:1000,simulations:20};
 const rows=hardestCertain(data,input);
 assert.deepEqual(hardestCertain(data,{...input,level:2}),rows,'the slider level does not matter');
 assert.ok(rows.some(r=>r.level===9)&&rows.some(r=>r.level&&r.level<9),'sample covers both outcomes');
 for(const r of rows){
  const at=level=>planJourneys(data,{...input,level}).find(x=>x.locationId===r.locationId);
  if(r.level){assert.equal(at(r.level).allCertain,true,r.name);assert.equal(r.bossCost,at(r.level).bossCost,r.name);}
  if(!r.next){assert.equal(r.level,9,r.name);continue;}
  assert.equal(r.next.level,r.level?r.level+1:1,r.name);
  assert.equal(at(r.next.level).allCertain,false,r.name);
  assert.equal(at(r.next.level).completion,r.next.completion,r.name);
 }
});

test('hardest certain level: huge stats reach level 9 everywhere, no stats reach none',()=>{
 for(const r of hardestCertain(data,{stats:allStats(1e6),simulations:10})){
  assert.equal(r.level,9);assert.equal(r.next,null);assert.equal(r.bossCost,stageCost(data,r.act,9,'boss'));assert.equal(r.miniBossCost,stageCost(data,r.act,9,'miniboss'));
 }
 for(const r of hardestCertain(data,{stats:allStats(0),simulations:10})){
  assert.equal(r.level,null);assert.equal(r.bossCost,null);assert.deepEqual(r.next,{level:1,completion:0});
 }
});

test('live journey starts with the planner chance for the same location and level',()=>{
 const input={stats:allStats(300),blood:1000,level:6};
 const live=liveAdvice(data,{...input,locationId:'skarbiec',log:[]});
 assert.equal(live.phase,'node');
 assert.equal(live.chance,planJourneys(data,input).find(r=>r.locationId==='skarbiec').completion);
 assert.deepEqual(live.stages.map(s=>s.type),['node','node','node','mini','node','node','boss']);
 assert.equal(live.routeLength,5);
 assert.equal(live.options,null,'no advice before the enemy is chosen');
});

test('live advice changes when the same enemy comes back: the second time the spent stat is gone',()=>{
 const d=fixture([only('a')]),run={stats:{a:60,b:10},blood:50,level:1,locationId:'home',log:[]};
 const first=liveAdvice(d,run,{encounter:0,shown:'b'});
 assert.equal(first.recommended,'b','pay b and keep a for the boss');
 assert.deepEqual(first.options.map(o=>[o.pay,o.chance]),[['a',0],['b',1],['blood',first.options[2].chance]]);
 const log=[{type:'node',encounter:0,shown:'b',pay:'b'}];
 const second=liveAdvice(d,{...run,log},{encounter:0,shown:'b'});
 assert.equal(second.stats.b,0);
 assert.equal(second.options.find(o=>o.pay==='b').affordable,false);
 assert.equal(second.recommended,'blood','b is spent, a must stay for the boss');
 const after=liveAdvice(d,{...run,log:[...log,{type:'node',encounter:0,shown:'b',pay:'blood'}]});
 assert.deepEqual([after.phase,after.chance,after.blood],['main',1,0]);
});

test('live timed obstacle: waiting is preferred on a tie unless paying is chosen in the form',()=>{
 const d=fixture([only('d')]),run=waitTimed=>({stats:{a:100,d:60},level:2,waitTimed,locationId:'home',log:[]});
 assert.equal(liveAdvice(d,run(true),{encounter:1}).recommended,'wait');
 assert.equal(liveAdvice(d,run(false),{encounter:1}).recommended,'a');
});

test('live mini boss and boss: pick the mini boss, then round by round to the end',()=>{
 const d=fixture([only('d','Own'),only('c','Easy'),only('b','Hard')],[
  {id:'home',name:'Dom',act:1,boss:'d'},{id:'easy',name:'Łatwa',act:1,boss:'c'},{id:'hard',name:'Trudna',act:1,boss:'b'}]);
 const run={stats:{c:45,d:60},level:6,locationId:'home',log:[]};
 const pick=liveAdvice(d,run);
 assert.equal(pick.phase,'miniPick');
 assert.deepEqual(pick.candidates.map(c=>[c.boss,c.chance]),[['c',1],['b',0]]);
 assert.equal(pick.chance,0.5);
 const log=[{type:'mini',boss:'c'}];
 const r1=liveAdvice(d,{...run,log},{shown:'c'});
 assert.deepEqual([r1.phase,r1.round,r1.recommended],['mini',0,'c']);
 log.push({type:'round',shown:'c',pay:'c'},{type:'round',shown:'c',pay:'c'});
 const r3=liveAdvice(d,{...run,log});
 assert.deepEqual(r3.options.map(o=>[o.pay,o.costs.map(c=>c.amount).join('+')]),[['combo','11+11'],['c','15'],['blood','75']]);
 assert.equal(r3.recommended,'c');
 log.push({type:'round',pay:'c'},{type:'round',shown:'d',pay:'d'},{type:'round',shown:'d',pay:'d'},{type:'round',pay:'d'});
 const end=liveAdvice(d,{...run,log});
 assert.deepEqual([end.phase,end.chance,end.valid,end.current],['done',1,true,null]);
 assert.deepEqual(end.entryStage,[0,0,0,0,1,1,1]);
});

test('live log stops at the first entry that cannot be paid',()=>{
 const d=fixture([only('a')]),run={stats:{a:60,b:10},level:1,locationId:'home'};
 const r=liveAdvice(d,{...run,log:[{type:'node',encounter:0,shown:'b',pay:'b'},{type:'node',encounter:0,shown:'b',pay:'b'}]});
 assert.deepEqual([r.valid,r.applied,r.done],[false,1,1]);
});

test('chance labels never round up to 100% and colour bands split at 100% and 30%',()=>{
 assert.deepEqual([1,0.9999,0.57,0.5,0.3,0.2999,0.004,0].map(chanceLabel),['100%','99%','57%','50%','30%','29%','<1%','0%']);
 assert.deepEqual([1,0.9999,0.3,0.1+0.2-0.0000000000000001,0.2999,0].map(chanceTone),['certain','possible','possible','possible','unlikely','unlikely']);
});

test('invalid input is rejected with a Polish message',()=>{
 assert.throws(()=>planJourneys(data,{stats:allStats(1),level:0}),/Poziom trudności/);
 assert.throws(()=>planJourneys(data,{stats:{...allStats(1),sila:-1},level:1}),/Siła/);
 assert.throws(()=>planJourneys({...data,routes:{...data.routes,4:undefined}},{stats:allStats(1),level:4}),/Brak układu trasy/);
 assert.throws(()=>planJourneys(data,{stats:allStats(1),blood:1.5,level:1}),/Punkty krwi/);
});

test('journey data: 9 stats, 21 encounters, 9 bosses, 3 locations per act, every reference resolves',()=>{
 const params=new Set(data.params.map(p=>p.id)),bosses=new Set(data.bosses.map(b=>b.id));
 assert.equal(params.size,9);
 assert.equal(data.encounters.length,21);
 assert.equal(data.encounters.filter(e=>e.type==='timed').length,3);
 for(const e of data.encounters){
  assert.ok(params.has(e.fixed),e.name);
  if(e.type==='enemy'){assert.equal(e.random.length,3,e.name);assert.ok(e.random.every(p=>params.has(p)),e.name);}
 }
 assert.equal(bosses.size,9);
 for(const b of data.bosses){
  const [r1,r2,r3]=b.rounds;
  assert.equal(b.rounds.length,3,b.name);
  assert.equal(r1.random.length,3,b.name);assert.equal(r2.random.length,2,b.name);
  assert.equal(r3.combo.length,2,b.name);
  for(const p of [r1.fixed,...r1.random,r2.fixed,...r2.random,...r3.combo,r3.single,...b.specials.map(s=>s.param)])assert.ok(params.has(p),`${b.name}: ${p}`);
 }
 assert.deepEqual([1,2,3].map(act=>data.locations.filter(l=>l.act===act).length),[3,3,3]);
 assert.equal(new Set(data.locations.map(l=>l.boss)).size,9);
 assert.ok(data.locations.every(l=>bosses.has(l.boss)));
 for(let level=data.costs.levels.min;level<=data.costs.levels.max;level++){
  const r=data.routes[level];
  assert.ok(Number.isSafeInteger(r?.nodes)&&r.nodes>0,`route ${level}`);
  assert.ok(r.miniAfter==null||r.miniAfter>=0&&r.miniAfter<=r.nodes,`mini ${level}`);
 }
});
