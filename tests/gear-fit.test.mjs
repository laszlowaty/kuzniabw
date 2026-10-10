import fs from 'node:fs';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseInventory} from '../engine.js';
import {mulberry32,chanceEvaluator,planJourneys} from '../journey-sim.js';
import {MAX_EASE,lowered,upgradeItem,itemStats,gearCandidates,reachableItems,bestGear,bossParams,fitLocations,searchItem,parseCharacterText,hardestLevel,firstMiniLevel} from '../gear-fit.js';

const data=JSON.parse(fs.readFileSync(new URL('../data.json',import.meta.url)));
const journey=JSON.parse(fs.readFileSync(new URL('../journey-data.json',import.meta.url)));
const details={items:{},components:{}};
for(const category of data.categories)details.components[category.id]=JSON.parse(fs.readFileSync(new URL(`../item-components/${category.id}.json`,import.meta.url)));
const params=journey.params.map(p=>p.id);
const item=name=>{const result=parseInventory(name,data);assert.deepEqual(result.errors,[]);return {...result.items[0],id:0};};

// Synthetic items over three stats a, b, c; ids double as physical items unless `src` says otherwise.
function kit(){
 let id=0;
 return (slot,{bonus=[0,0,0],need=[0,0,0],level=0,ease=0,hands=slot==='hands'?1:0,src,up=0}={})=>{const n=id++;return {id:n,src:src??n,slot,hands,up,bonus,need,level,ease};};
}
const char=(stats,level=10,ease=0)=>({stats,level,ease});
const fit=(items,character,target=[0])=>bestGear(reachableItems(items,character).items,character,target);

test('łatwość lowers requirements, rounded up and capped at 50%',()=>{
 assert.equal(lowered(49,10),45,'44.1 rounds up');
 assert.equal(lowered(10,0),10);
 assert.equal(lowered(100,MAX_EASE),50);
 assert.equal(lowered(100,80),50,'more than 50% still halves');
 assert.equal(lowered(0,30),0);
});

test('requirements count bonuses of items worn earlier, never the item itself nor a cycle',()=>{
 const make=kit(),helm=make('head',{bonus:[8,0,0],need:[0,20,0]}),amulet=make('neck',{bonus:[2,10,0]});
 assert.deepEqual(fit([helm,amulet],char([10,10,10])).items,[helm.id,amulet.id]);
 assert.equal(fit([helm],char([10,10,10])).score,0,'Zwinność 10 < 20 without the amulet');
 const own=kit()('head',{bonus:[5,15,0],need:[0,20,0]});
 assert.equal(fit([own],char([10,10,10])).score,0,'its own +15 does not count');
 const loop=kit(),x=loop('head',{bonus:[3,10,0],need:[0,0,15]}),y=loop('neck',{bonus:[3,0,10],need:[0,15,0]});
 assert.equal(fit([x,y],char([10,10,10])).score,0,'each needs the other to be worn first');
});

test('item łatwość helps the rest of the set, level included',()=>{
 const make=kit(),helm=make('head',{bonus:[9,0,0],level:20}),ring=make('rings',{ease:20});
 assert.deepEqual(fit([helm,ring],char([0,0,0],16)).items,[helm.id,ring.id],'20 × 0.8 = 16');
 assert.equal(fit([helm,ring],char([0,0,0],15)).score,0);
 const capped=kit(),boots=capped('legs',{bonus:[4,0,0],level:20}),rings=[capped('rings',{ease:40}),capped('rings',{ease:40})];
 assert.equal(fit([boots,...rings],char([0,0,0],10,0)).score,4,'50% cap: 20 → 10');
 assert.equal(fit([boots,...rings],char([0,0,0],9,0)).score,0);
});

test('two one-handed weapons win ties against a two-handed one; a stronger two-handed wins',()=>{
 const make=kit(),a=make('hands',{bonus:[5,0,0]}),b=make('hands',{bonus:[5,0,0]}),big=make('hands',{bonus:[10,0,0],hands:2});
 assert.deepEqual(fit([big,a,b],char([0,0,0])).items,[a.id,b.id]);
 const more=kit(),c=more('hands',{bonus:[5,0,0]}),d=more('hands',{bonus:[5,0,0]}),huge=more('hands',{bonus:[11,0,0],hands:2});
 assert.deepEqual(fit([c,d,huge],char([0,0,0])).items,[huge.id]);
});

test('without simulation all stats count, boss stats 20% more; items with nothing stay off',()=>{
 const make=kit(),boss=make('head',{bonus:[6,0,0]}),wide=make('head',{bonus:[5,9,9]}),filler=make('neck',{bonus:[0,3,0]}),useless=make('chest',{bonus:[0,-2,0]});
 const r=fit([boss,wide,filler,useless],char([0,0,0]));
 assert.deepEqual(r.items,[wide.id,filler.id]);
 assert.deepEqual([r.score,r.total,r.bonus],[5,26,[5,12,9]]);
 const tie=kit(),own=tie('head',{bonus:[0,6,0]}),bossStat=tie('head',{bonus:[6,0,0]});
 assert.deepEqual(fit([own,bossStat],char([0,0,0])).items,[bossStat.id],'6 boss points beat 6 other points');
});

test('the chance evaluator returns the table completion for one location',()=>{
 const stats=allStats=>Object.fromEntries(journey.params.map((p,k)=>[p.id,allStats[k]]));
 for(const [level,values]of [[1,[60,40,30,50,45,20,35,40,55]],[6,[200,150,190,210,170,160,150,190,200]],[9,[400,380,390,420,410,390,370,400,405]]]){
  const rows=planJourneys(journey,{stats:stats(values),level,blood:30,waitTimed:false});
  for(const location of journey.locations)assert.equal(chanceEvaluator(journey,{level,blood:30,waitTimed:false},location.id)(values),rows.find(r=>r.locationId===location.id).completion,`${location.id}, level ${level}`);
 }
});

test('levels are tried from the first mini boss: up from the top when it is certain, otherwise down',()=>{
 const levels={min:1,max:9,pivot:firstMiniLevel(journey)};
 assert.equal(levels.pivot,6);
 const trace=limit=>{const calls=[];const level=hardestLevel(l=>{calls.push(l);return l<=limit;},levels);return {level,calls};};
 assert.deepEqual(trace(7),{level:7,calls:[6,9,8,7]});
 assert.deepEqual(trace(9),{level:9,calls:[6,9]});
 assert.deepEqual(trace(6),{level:6,calls:[6,9,8,7]});
 assert.deepEqual(trace(3),{level:3,calls:[6,5,4,3]});
 assert.deepEqual(trace(0),{level:null,calls:[6,5,4,3,2,1]});
});

// Synthetic journey: level l is certain with stat a ≥ 10·l; below that the chance is a/(10·l).
const reach=level=>stats=>Math.min(1,stats[0]/(10*level));
const levels={min:1,max:9,pivot:6};
test('with simulation the set clearing the hardest level wins over more stats',()=>{
 const make=kit(),strong=make('head',{bonus:[30,0,0]}),wide=make('head',{bonus:[0,40,40]});
 const character=char([20,0,0]);
 assert.deepEqual(fit([strong,wide],character).items,[wide.id],'more stats without simulation');
 const r=bestGear([strong,wide],character,[0],{chance:reach,levels});
 assert.deepEqual(r.items,[strong.id]);
 assert.deepEqual([r.level,r.goal],[5,6]);
 assert.ok(Math.abs(r.chance-50/60)<1e-12);
 const none=bestGear([wide],char([5,0,0]),[0],{chance:reach,levels});
 assert.deepEqual([none.level,none.goal,none.chance],[null,1,0.5],'no certain level: the chance at level 1');
 const top=bestGear([make('head',{bonus:[90,0,0]}),make('neck',{bonus:[5,5,5]})],character,[0],{chance:reach,levels});
 assert.deepEqual([top.level,top.goal,top.chance,top.items.length],[9,null,null,2],'level 9: extra stats still count');
});

test('a slot is not left empty when an item only adds stats, even if the simulation rates it lower',()=>{
 // The route planner can score extra stats slightly lower; here any c on top of a costs 1 point below 100%.
 const quirk=level=>stats=>{const c=Math.min(1,stats[0]/(10*level));return c<1&&stats[2]>0?c-0.01:c;};
 const make=kit(),helmet=make('head',{bonus:[0,0,5]}),penalty=make('chest',{bonus:[-1,0,5]});
 const r=bestGear([helmet,penalty],char([45,0,0]),[0],{chance:quirk,levels});
 assert.deepEqual(r.items,[helmet.id],'the helmet goes on; the chest piece with a minus does not');
 assert.deepEqual([r.level,r.goal],[4,5]);
 assert.ok(Math.abs(r.chance-0.89)<1e-12,'the reported chance is what the simulation gives for the worn set');
});

test('simulated results are consistent: the level is certain and the next one is not',()=>{
 const slots=['hands','head','chest','legs','neck','rings'];
 for(let seed=1;seed<=60;seed++){
  const rng=mulberry32(seed),int=(a,b)=>a+Math.floor(rng()*(b-a+1)),items=[];
  for(let src=0,n=int(6,14);src<n;src++){const slot=slots[int(0,5)];items.push({id:items.length,src,slot,hands:slot==='hands'?int(1,2):0,up:0,bonus:[int(-2,25),int(0,20),int(0,20)],ease:0,level:int(0,20),need:[0,int(0,15),0]});}
  const character={level:int(5,30),stats:[int(0,30),int(0,20),int(0,20)],ease:0};
  const chance=level=>stats=>Math.min(1,(stats[0]+stats[1]/2)/(12*level));
  const r=bestGear(reachableItems(items,character).items,character,[0,1],{chance,levels,timeMs:5000});
  const stats=character.stats.map((v,k)=>Math.max(0,v+r.bonus[k]));
  if(r.level!==null)assert.equal(chance(r.level)(stats),1,`seed ${seed}`);
  if(r.goal!==null){assert.ok(r.chance<1,`seed ${seed}`);assert.equal(r.chance,chance(r.goal)(stats));}
  const weighted=fit(items,character,[0,1]),plain=character.stats.map((v,k)=>Math.max(0,v+weighted.bonus[k]));
  assert.ok((r.level??0)>=(hardestLevel(l=>chance(l)(plain)>=1,levels)??0),`seed ${seed}: never below the weighted set`);
 }
});

test('only one variant of a physical item is worn; +5 is suggested only when it helps',()=>{
 const make=kit(),now=make('rings',{bonus:[4,0,0],src:0}),up=make('rings',{bonus:[6,0,0],src:0,up:1});
 assert.deepEqual(fit([now,up],char([0,0,0])).items,[up.id],'one physical ring');
 const blocked=kit(),now2=blocked('rings',{bonus:[4,0,0],src:0}),up2=blocked('rings',{bonus:[6,0,0],level:50,src:0,up:1});
 assert.deepEqual(fit([now2,up2],char([0,0,0])).items,[now2.id],'the +5 requirements are out of reach');
 const tie=kit(),now3=tie('rings',{bonus:[4,0,0],src:0}),up3=tie('rings',{bonus:[4,0,0],src:0,up:1});
 assert.deepEqual(fit([up3,now3],char([0,0,0])).items,[now3.id],'no upgrade without a gain');
});

test('item stats come from the composed catalog row, without set bonuses',()=>{
 const bandana=item('Krwawa Bandana Prekognicji (+3)'),stats=itemStats(bandana,details,params),at=id=>params.indexOf(id);
 assert.equal(stats.bonus[at('spostrzegawczosc')],15,'1 + 14; the +11 set bonus is not active');
 assert.equal(stats.bonus[at('wyglad')],4);
 assert.equal(stats.level,49);
 assert.deepEqual([stats.need[at('sila')],stats.need[at('wyglad')],stats.need[at('odpornosc')]],[21,14,14]);
 const up=upgradeItem(bandana);
 assert.equal(up.original,'Krwawa Bandana Prekognicji (+5)');
 assert.equal(up.upgradedFrom,3);
 assert.ok(itemStats(up,details,params).bonus[at('spostrzegawczosc')]>15);
 const good=item('Dobra Runiczna Bandana Prekognicji (+1)');
 assert.equal(upgradeItem(good),good,'Dobry (+1) is already above Zwykły (+5)');
});

test('candidates keep both variants with the upgrade option and skip items for the other sex',()=>{
 const inventory=[item('Krwawa Bandana Prekognicji (+3)'),{...item('Gorset'),id:1}];
 const plain=gearCandidates(inventory,details,{params});
 assert.equal(plain.items.length,2);
 const upgraded=gearCandidates(inventory,details,{params,upgrade:true});
 assert.deepEqual(upgraded.items.map(i=>[i.src,i.up]),[[0,0],[0,1],[1,0],[1,1]]);
 const male=gearCandidates(inventory,details,{params,canUse:i=>i.base!=='gorset'});
 assert.deepEqual(male.skipped.map(s=>s.source.base),['gorset']);
});

test('each location targets every stat its boss uses',()=>{
 const expected={
  'kanaly':['sila','zwinnosc','wyglad','inteligencja','wiedza'],
  'szlak-przemytnikow':['sila','zwinnosc','wplywy','spostrzegawczosc','inteligencja','wiedza'],
  'ochrona-karawany':['sila','zwinnosc','wyglad','charyzma','wplywy','wiedza'],
  'szklana-pustynia':['sila','odpornosc','wyglad','charyzma','wplywy','inteligencja','wiedza'],
  'zaginiona-oaza':['odpornosc','wyglad','charyzma','wplywy','spostrzegawczosc','inteligencja'],
  'bagna-przemienionych':['sila','odpornosc','wyglad','charyzma','wplywy','wiedza'],
  'ukryte-miasto':['zwinnosc','odpornosc','wyglad','charyzma','spostrzegawczosc','wiedza'],
  'starozytny-grobowiec':['sila','zwinnosc','odpornosc','spostrzegawczosc','inteligencja','wiedza'],
  'skarbiec':['zwinnosc','odpornosc','charyzma','wplywy','spostrzegawczosc','inteligencja','wiedza']
 };
 for(const location of journey.locations)assert.deepEqual(bossParams(journey,location),expected[location.id],location.id);
});

test('pasted character text fills level, łatwość and training stats',()=>{
 const text='Poziom: 45\nSIŁA: 40 (+12)\nZWINNOŚĆ\t35\nOdporność 20\nWYGLĄD: 18\nCHARYZMA: 9\nWPŁYWY: 7\nSPOSTRZEGAWCZOŚĆ: 31\nINTELIGENCJA: 12\nWIEDZA: 15\nŁatwość: 12%';
 assert.deepEqual(parseCharacterText(text,params),{level:45,ease:12,stats:{sila:40,zwinnosc:35,odpornosc:20,wyglad:18,charyzma:9,wplywy:7,spostrzegawczosc:31,inteligencja:12,wiedza:15}});
 assert.deepEqual(parseCharacterText('Siła woli 5, nic więcej',params),{level:null,ease:null,stats:{}});
});

test('a real inventory gets one valid set per location',()=>{
 const names=['Krwawa Bandana Prekognicji (+3)','Złoty Amulet Władzy (+5)','Rubinowy Amulet Twardej Skóry (+4)','Dobry Wzmocniony Smoking Siłacza (+1)','Magnum (+1)','Desert Eagle (+1)','AK-47 (+1)','Karabin snajperski (+1)','Sygnet (+2)','Pierścień (+1)'];
 const inventory=names.map((name,id)=>({...item(name),id}));
 const {items}=gearCandidates(inventory,details,{params,upgrade:true});
 const {results}=fitLocations(journey,items.map(searchItem),{level:80,stats:params.map(()=>200),ease:0});
 assert.equal(results.length,journey.locations.length);
 for(const r of results){
  const worn=r.items.map(id=>items[id]);
  assert.ok(r.complete);
  assert.equal(new Set(worn.map(i=>i.src)).size,worn.length,'a physical item is worn once');
  for(const slot of ['head','chest','legs','neck'])assert.ok(worn.filter(i=>i.slot===slot).length<=1);
  assert.ok(worn.filter(i=>i.slot==='rings').length<=2);
  const hands=worn.filter(i=>i.slot==='hands');
  assert.ok(hands.length<=2&&!(hands.length===2&&hands.some(i=>i.hands===2)));
  assert.equal(r.score,worn.reduce((s,i)=>s+r.target.reduce((t,k)=>t+i.bonus[k],0),0));
 }
});

// Independent check: every slot combination, every equip order.
function brute(items,character,target){
 const P=character.stats.length,slots=['hands','head','chest','legs','neck','rings'];
 const opts=slots.map(slot=>{
  const list=items.filter(i=>i.slot===slot),out=[[],...list.map(i=>[i])],pairs=slot==='rings'?list:slot==='hands'?list.filter(i=>i.hands===1):[];
  for(let a=0;a<pairs.length;a++)for(let b=a+1;b<pairs.length;b++)if(pairs[a].src!==pairs[b].src)out.push([pairs[a],pairs[b]]);
  return out;
 });
 const fits=(it,support,ease)=>lowered(it.level,ease)<=character.level&&it.need.every((n,k)=>!n||lowered(n,ease)<=support[k]);
 const anyOrder=(left,support,ease)=>!left.length||left.some(it=>fits(it,support,ease)&&anyOrder(left.filter(x=>x!==it),support.map((v,k)=>v+it.bonus[k]),ease+it.ease));
 const stays=set=>set.every(it=>{const others=set.filter(o=>o!==it);return fits(it,character.stats.map((v,k)=>v+others.reduce((s,o)=>s+o.bonus[k],0)),character.ease+others.reduce((s,o)=>s+o.ease,0));});
 let best=null;
 const weight=k=>target.includes(k)?6:5;
 const rank=set=>[set.reduce((s,i)=>s+i.bonus.reduce((t,v,k)=>t+v*weight(k),0),0),set.some(i=>i.hands===2)?0:1,-set.reduce((s,i)=>s+i.up,0)];
 const better=(a,b)=>{const i=a.findIndex((v,j)=>v!==b[j]);return i>=0&&a[i]>b[i];};
 const walk=(g,set)=>{
  if(g===slots.length){const r=rank(set);if((!best||better(r,best))&&stays(set)&&anyOrder(set,character.stats,character.ease))best=r;return;}
  for(const o of opts[g])walk(g+1,[...set,...o]);
 };
 walk(0,[]);return best;
}
test('the search matches an exhaustive check on random small inventories',()=>{
 const slots=['hands','head','chest','legs','neck','rings'];
 for(let seed=1;seed<=150;seed++){
  const rng=mulberry32(seed),int=(a,b)=>a+Math.floor(rng()*(b-a+1)),items=[];
  for(let src=0,n=int(6,11);src<n;src++){
   const slot=slots[int(0,5)],hands=slot==='hands'?int(1,2):0;
   for(const up of rng()<.4?[0,1]:[0])items.push({id:items.length,src,slot,hands,up,bonus:[0,1,2].map(()=>rng()<.5?0:int(-3,10)),ease:rng()<.25?int(1,30):0,level:int(0,30),need:[0,1,2].map(()=>rng()<.5?0:int(1,25))});
  }
  const character={level:int(10,34),stats:[int(0,19),int(0,19),int(0,19)],ease:int(0,59)},target=[0,1,2].filter(()=>rng()<.6);
  if(!target.length)target.push(0);
  const r=fit(items,character,target),worn=r.items.map(id=>items[id]);
  const rank=[r.weighted,worn.some(i=>i.hands===2)?0:1,-worn.reduce((s,i)=>s+i.up,0)];
  assert.deepEqual(rank,brute(items,character,target),`seed ${seed}`);
 }
});
