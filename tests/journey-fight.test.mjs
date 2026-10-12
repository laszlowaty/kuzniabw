import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {freshFight,specialOutcomes,fightOptions,evaluateFight,offeredFight} from '../journey-fight.js';
import {routeChance,liveAdvice,planJourneys,chanceEvaluator} from '../journey-sim.js';
import {SPECIAL_RULES} from '../journey-specials.js';
const data=JSON.parse(fs.readFileSync(new URL('../journey-data.json',import.meta.url)));
const ids=data.params.map(p=>p.id),at=id=>ids.indexOf(id);
const vector=stats=>Float64Array.from([...ids.map(id=>stats[id]??0),0]);
const sp=(id,param)=>({id,param,at:at(param),effect:id});
const fight=(special,base={},rounds)=>({ids,base:vector(base),specials:[special],rounds:rounds??Array.from({length:3},()=>({fixed:0,random:[0]})),stat:10,combo:8,bloodMult:5,bloodAt:9,final:true});
const leaf=()=>[1,1,0];
test('one optional discount can rescue the fight and is charged in its own stat',()=>{
 const special=sp('calm','wyglad'),f=fight(special,{wyglad:40,sila:24}),s=vector({wyglad:40,sila:24});
 assert.equal(evaluateFight(s,f,leaf)[0],0);
 assert.equal(evaluateFight(s,f,leaf,freshFight(),special)[0],1);
 const [b]=specialOutcomes(s,f,freshFight(),special);
 assert.equal(b.stats[at('wyglad')],30);
 assert.deepEqual(b.state.factors,[0.8,0.8,0.8]);
 assert.deepEqual(specialOutcomes(b.stats,f,b.state,special),[],'cannot use it twice');
 assert.equal(s[at('wyglad')],40,'does not mutate caller state');
});
test('one failed skip spends the cost but does not advance or get a second attempt',()=>{
 const special=sp('ignore','odpornosc'),f=fight(special,{odpornosc:8}),s=vector({sila:20,odpornosc:8});
 assert.equal(evaluateFight(s,f,leaf,freshFight(),special)[0],0.2);
 const outcomes=specialOutcomes(s,f,freshFight(),special);
 assert.deepEqual(outcomes.map(b=>[b.probability,b.state.round,b.stats[2]]),[[0.2,1,7],[0.8,0,7]]);
 assert.ok(outcomes.every(b=>b.state.used));
 assert.equal(evaluateFight(outcomes[1].stats,f,leaf,outcomes[1].state,special)[0],0);
});
test('next-round discounts and counter costs expire after that round',()=>{
 for(const [id,param,factors]of [['scout','spostrzegawczosc',[1,0.6,1]],['counter','odpornosc',[1.2,0.5,1]]]){
  const special=sp(id,param),f=fight(special,{[param]:40}),[b]=specialOutcomes(vector({[param]:40}),f,freshFight(),special);
  assert.deepEqual(b.state.factors,factors);
  assert.deepEqual([0,1,2].map(round=>fightOptions(b.stats,f,{...b.state,round},0)[0].costs[0][1]),factors.map(v=>Math.round(10*v)));
 }
});
test('regeneration uses unboosted initial stats; doubling uses current perception',()=>{
 const special=sp('persuade','charyzma'),f=fight(special,{sila:100,charyzma:100,wiedza:50}),s=vector({sila:5,charyzma:80,wiedza:70});s[9]=500;
 const [b]=specialOutcomes(s,f,freshFight(),special);
 assert.equal(b.stats[0],25);assert.equal(b.stats[4],55);assert.equal(b.stats[8],80);assert.equal(b.stats[9],500);
 const double=sp('brainwash','wiedza'),g=fight(double,{wiedza:100,spostrzegawczosc:100});
 const [d]=specialOutcomes(vector({wiedza:30,spostrzegawczosc:15}),g,freshFight(),double);
 assert.equal(d.stats[6],30);assert.equal(d.stats[8],10);
});
test('restoration excludes strength and chooses the largest absolute expenditure',()=>{
 const special=sp('restore','sila'),f=fight(special,{sila:1000,wyglad:100,wiedza:200});
 const [b]=specialOutcomes(vector({sila:300,wyglad:10,wiedza:100}),f,freshFight(),special);
 assert.equal(b.stats[0],50);assert.equal(b.stats[3],10);assert.equal(b.stats[8],200);
});
test('Scorpion branches into 84 distinct triples with no blood and charges before boosting',()=>{
 const special=sp('disorient','spostrzegawczosc'),base=Object.fromEntries(ids.map(id=>[id,100])),f=fight(special,base);
 const outcomes=specialOutcomes(vector(base),f,freshFight(),special);
 assert.equal(outcomes.length,84);assert.equal(new Set(outcomes.map(b=>b.result.params.join())).size,84);
 assert.ok(Math.abs(outcomes.reduce((n,b)=>n+b.probability,0)-1)<1e-12);
 assert.ok(outcomes.every(b=>b.result.params.length===3&&b.stats[9]===0));
 assert.equal(outcomes.find(b=>b.result.params.includes('spostrzegawczosc')).stats[6],112);
});
test('extra stat effects target the current or next round only',()=>{
 for(const [id,param,targetRound,target]of [['highest','spostrzegawczosc',0,'wiedza'],['provoke','inteligencja',1,'wiedza'],['agility','zwinnosc',1,'zwinnosc']]){
  const special=sp(id,param),base={[param]:40,wiedza:100},f=fight(special,base),[b]=specialOutcomes(vector(base),f,freshFight(),special);
  assert.ok(fightOptions(b.stats,f,{...b.state,round:targetRound},0).some(o=>o.pay===target));
  assert.ok(!fightOptions(b.stats,f,{...b.state,round:2},0).some(o=>o.pay===target));
 }
});
test('random extra stat is averaged rather than picked by the player',()=>{
 const special=sp('underestimate','inteligencja'),f=fight(special,{inteligencja:8},[{fixed:0,random:[0]}]);
 const s=vector({inteligencja:8,wiedza:10});
 assert.equal(evaluateFight(s,f,leaf,freshFight(),special)[0],1/9);
 const good=sp('calm','wyglad'),bad=sp('counter','odpornosc'),g=fight(good,{wyglad:40,odpornosc:8});
 g.specials=[good,bad];assert.equal(offeredFight(vector({sila:24,wyglad:40}),g,leaf)[0],0.5,'average offers, never best-of catalog');
});
const fixture=()=>{
 const d=structuredClone(data);d.costs={acts:{1:{base:10,perLevel:0}},levels:{min:1,max:1},type:{monster:1,miniboss:1,boss:1},blood:5,combo:0.75};d.routes={1:{nodes:0,miniAfter:0}};
 d.bosses=['main','mini'].map(id=>({id,name:id,rounds:[{fixed:'sila',random:['sila']},{fixed:'sila',random:['sila']},{combo:['sila','sila'],single:'sila'}],specials:[{id:'calm',param:'wyglad',effect:'Obniżka 20%'}]}));
 d.locations=d.bosses.map(b=>({id:b.id,name:b.name,act:1,boss:b.id}));return d;
};
test('mini and final boss each get one special, with fresh effects and independent live logs',()=>{
 const d=fixture(),run={stats:{sila:48,wyglad:80},level:1,locationId:'main',log:[{type:'mini',boss:'mini'}]};
 assert.equal(routeChance(d,run,'main',[]).chance,1);
 for(const phase of ['mini','main']){
  let a=liveAdvice(d,run,{shown:'sila'});assert.equal(a.phase,phase);assert.equal(a.specialUsed,false);
  run.log.push({type:'offer',special:'calm'});
  a=liveAdvice(d,run,{shown:'sila'});assert.equal(a.special.cost,20);assert.equal(a.special.affordable,true);
  run.log.push({type:'special',shown:'sila',result:{}});
  a=liveAdvice(d,run);assert.equal(a.round,0);assert.equal(a.specialUsed,true);assert.equal(a.options.find(o=>o.pay==='sila').costs[0].amount,8);
  const invalid=liveAdvice(d,{...run,log:[...run.log,{type:'special',shown:'sila',result:{}}]});assert.equal(invalid.valid,false);
  run.log.push({type:'round',shown:'sila',pay:'sila'},{type:'round',shown:'sila',pay:'sila'},{type:'round',pay:'sila'});
 }
 const end=liveAdvice(d,run);assert.equal(end.phase,'done');assert.equal(end.stats.sila,0);assert.equal(end.stats.wyglad,40);
 const undo=liveAdvice(d,{...run,log:run.log.slice(0,-4)});assert.equal(undo.specialUsed,false);assert.equal(undo.stats.wyglad,60);
});
test('live skip records the observed success/failure, including round three and replay',()=>{
 const d=fixture();delete d.routes[1].miniAfter;d.bosses[0].specials=[{id:'ignore',param:'odpornosc',effect:'20%'}];
 const run={stats:{sila:20,odpornosc:8},level:1,locationId:'main',log:[{type:'offer',special:'ignore'},{type:'round',shown:'sila',pay:'sila'},{type:'round',shown:'sila',pay:'sila'}]};
 const a=liveAdvice(d,run);assert.equal(a.special.chance,0.2);assert.equal(a.recommended,'special');
 const append=result=>liveAdvice(d,{...run,log:[...run.log,{type:'special',result}]});
 assert.equal(append({success:true}).phase,'done');
 const fail=append({success:false});assert.equal(fail.round,2);assert.equal(fail.specialUsed,true);assert.equal(fail.stats.odpornosc,7);assert.equal(fail.chance,0);
 assert.equal(append({success:'true'}).valid,false);
});
test('equipment evaluator recomputes special base costs for each proposed set',()=>{
 const d=fixture();delete d.routes[1].miniAfter;const evaluate=chanceEvaluator(d,{level:1,simulations:1},'main');
 for(const stats of [{sila:24,wyglad:40},{sila:30,wyglad:4}])assert.equal(evaluate(ids.map(id=>stats[id]??0)),planJourneys(d,{stats,level:1,simulations:1})[0].completion);
});
test('live base values and explicit game costs are independent of the boosted pool',()=>{
 const d=fixture();delete d.routes[1].miniAfter;
 const run={stats:{sila:24,wyglad:80},baseStats:{wyglad:40},level:1,locationId:'main',log:[{type:'offer',special:'calm'}]};
 assert.equal(liveAdvice(d,run,{shown:'sila'}).special.cost,10);
 const overridden={...run,log:[{type:'offer',special:'calm',cost:17},{type:'special',shown:'sila',result:{}}]};
 assert.equal(liveAdvice(d,overridden).stats.wyglad,63);
 const rerolled=liveAdvice(d,{...overridden,log:[...overridden.log,{type:'round',shown:'wiedza',pay:'sila'}]});
 assert.equal(rerolled.valid,false);
 const bad=liveAdvice(d,{...run,log:[{type:'offer',special:'calm',cost:-1}]});assert.equal(bad.valid,false);
});
test('blood never pays for an unaffordable special',()=>{
 const special=sp('calm','wyglad'),f=fight(special,{wyglad:100}),s=vector({wyglad:24});s[9]=10000;
 assert.deepEqual(specialOutcomes(s,f,freshFight(),special),[]);
});

test('optimized final boss agrees with general mini boss search for every special and round',()=>{
 let seed=47213,cases=0;const random=n=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed%n;};
 const catalog=[...new Map(data.bosses.flatMap(b=>b.specials).map(s=>[s.id,s])).values()];
 assert.equal(catalog.length,Object.keys(SPECIAL_RULES).length);
 for(const special of catalog)for(let round=0;round<3;round++)for(let sample=0;sample<12;sample++){
  const base=Object.fromEntries(ids.map(id=>[id,24+random(30)])),s=vector(Object.fromEntries(ids.map(id=>[id,random(19)])));s[9]=random(60);
  const rounds=[{fixed:0,random:[1,4,7]},{fixed:3,random:[2,6,8]},{combo:[0,1],single:5}];
  const f=fight({...special,at:at(special.param)},base,rounds),state={...freshFight(),round},before=Array.from(s);
  const fast=evaluateFight(s,f,leaf,state,f.specials[0])[0],general=evaluateFight(s,{...f,final:false},leaf,state,f.specials[0])[0];
  assert.ok(Math.abs(fast-general)<1e-12,`${special.id}, round ${round+1}: ${fast} vs ${general}`);
  assert.deepEqual(Array.from(s),before,'search must preserve input');cases++;
 }
 assert.equal(cases,540);
});

test('all catalog specials replay once in each boss role and each round; every random outcome is accepted',()=>{
 let offers=0,branches=0;
 for(const boss of data.bosses)for(const mini of [false,true])for(let round=0;round<3;round++)for(const special of boss.specials){
  const d=structuredClone(data);d.routes[1]={nodes:0,...(mini?{miniAfter:0}:{})};
  const location=d.locations.find(l=>mini?l.boss!==boss.id:l.boss===boss.id);
  const run={stats:Object.fromEntries(ids.map(id=>[id,10000])),blood:100000,level:1,locationId:location.id,simulations:1,
   log:[...(mini?[{type:'mini',boss:boss.id}]:[]),{type:'offer',special:special.id}]};
  for(let r=0;r<round;r++)run.log.push({type:'round',shown:boss.rounds[r].random[0],pay:'blood'});
  const shown=boss.rounds[round].random?.[0],before=liveAdvice(d,run,{shown});
  assert.equal(before.phase,mini?'mini':'main');assert.equal(before.specialUsed,false);
  const f=fight({...special,at:at(special.param)},run.stats),outcomes=specialOutcomes(vector(before.stats),f,{...freshFight(),round},f.specials[0]);
  for(const outcome of outcomes){
   const log=[...run.log,{type:'special',shown,result:outcome.result}],after=liveAdvice(d,{...run,log});
   assert.equal(after.valid,true,`${boss.id}/${mini}/${round}/${special.id}`);
   for(const id of ids)assert.equal(after.stats[id],outcome.stats[at(id)]);
   const advanced=outcome.state.round===3;
   if(!advanced){
    assert.equal(after.specialUsed,true);assert.equal(after.round,outcome.state.round);
    assert.equal(liveAdvice(d,{...run,log:[...log,{type:'special',shown,result:outcome.result}]}).valid,false);
   }else assert.equal(after.phase,mini?'main':'done');
   branches++;
  }
  offers++;
 }
 assert.equal(offers,378);assert.equal(branches,1368);
});

test('journey completion multiplies independent mini and final skip probabilities',()=>{
 const d=fixture();for(const boss of d.bosses)boss.specials=[{id:'ignore',param:'odpornosc',effect:'20%'}];
 const run={stats:{sila:40,odpornosc:16},level:1,locationId:'main'};
 // Six rounds cost 60 strength. With only 40, both independent skips must succeed.
 assert.ok(Math.abs(routeChance(d,run,'main',[]).chance-0.04)<1e-12);
 for(const boss of d.bosses){
  const noSpecial=structuredClone(d);noSpecial.bosses.find(b=>b.id===boss.id).specials=[];
  assert.equal(routeChance(noSpecial,run,'main',[]).chance,0);
 }
});
