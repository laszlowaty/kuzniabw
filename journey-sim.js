// Journey odds: route encounters are rolled, boss fights are solved exactly (expectimax over random slots).
import {freshFight,fightOptions,specialPrice,specialOutcomes,offeredFight} from './journey-fight.js';
export const SIMULATIONS=100;

export function mulberry32(seed){
 let a=seed>>>0;
 return()=>{a=a+0x6D2B79F5>>>0;let t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};
}
export function stageCost(data,act,level,type){
 const a=data.costs.acts[act],{min,max}=data.costs.levels;
 if(!a)throw new RangeError(`Nieznany akt: ${act}`);
 // An act can set its own boss rate (Act II: +100%). The final boss costs at least bossAfterMini on levels where a
 // mini boss stands on the route.
 const rates=data.costs.type,boss=a.boss??rates.boss;
 const rate=type!=='boss'?rates[type]:data.routes?.[level]?.miniAfter!=null?Math.max(boss,rates.bossAfterMini??boss):boss;
 return Math.round((a.base+a.perLevel*Math.min(Math.max(level,min),max))*rate);
}
export function comboCost(data,cost){return Math.round(cost*data.costs.combo);}
// Floored (with float slack, 0.57 is 57%), so a near-certain chance never reads as 100%.
const percent=v=>Math.floor(v*100+1e-9);
export function chanceLabel(v){
 if(v===1)return '100%';
 const p=percent(v);
 return v>0&&p===0?'<1%':`${Math.min(p,99)}%`;
}
export function chanceTone(v){return v===1?'certain':percent(v)>=30?'possible':'unlikely';}

const compiled=new WeakMap();
function compile(data){
 if(compiled.has(data))return compiled.get(data);
 const index=new Map(data.params.map((p,i)=>[p.id,i]));
 const at=id=>{const i=index.get(id);if(i===undefined)throw new RangeError(`Nieznany parametr: ${id}`);return i;};
 const rounds=b=>b.rounds.map(r=>r.combo?{combo:r.combo.map(at),single:at(r.single)}:{fixed:at(r.fixed),random:r.random.map(at)});
 const out={at,blood:data.params.length,bosses:new Map(data.bosses.map(b=>[b.id,{name:b.name,rounds:rounds(b),specials:(b.specials??[]).map(s=>({...s,at:at(s.param)}))}])),encounters:data.encounters.map(e=>({type:e.type,fixed:at(e.fixed)}))};
 compiled.set(data,out);return out;
}
// Route layout of a level, the same for every location: route nodes, and the mini boss after `miniAfter` of them.
export function routeLayout(data,level){
 const route=data.routes[level];
 if(!route)throw new RangeError(`Brak układu trasy dla poziomu ${level}`);
 return {nodes:route.nodes,miniAfter:route.miniAfter??null};
}
function normalize(data,input){
 const whole=(v,label,min=0,max=Number.MAX_SAFE_INTEGER)=>{if(!Number.isSafeInteger(v)||v<min||v>max)throw new RangeError(`Nieprawidłowa wartość: ${label}`);return v;};
 const {min,max}=data.costs.levels,level=whole(input.level,'Poziom trudności',min,max),layout=routeLayout(data,level);
 return {
  stats:data.params.map(p=>whole(input.stats?.[p.id]??0,p.label)),
  base:data.params.map(p=>whole(input.baseStats?.[p.id]??input.stats?.[p.id]??0,p.label)),
  blood:whole(input.blood??0,'Punkty krwi'),
  level,routeLength:layout.nodes,miniAfter:layout.miniAfter,
  waitTimed:input.waitTimed!==false,
  simulations:whole(input.simulations??SIMULATIONS,'Liczba symulacji',1),
  seed:input.seed??1
 };
}

// Encounter draw is uniform unless the data gives an optional weight.
export function rollRoute(data,length,rng){
 const list=data.encounters,weights=list.map(e=>e.weight??1),total=weights.reduce((a,b)=>a+b,0);
 return Array.from({length},()=>{
  let x=rng()*total,i=0;
  while(i<list.length-1&&(x-=weights[i])>=0)i++;
  const e=list[i];
  return {encounter:i,shown:e.type==='enemy'?e.random[Math.floor(rng()*e.random.length)]:null};
 });
}

// Main boss: exact win chance, best choice per round, random slots averaged.
function win(s,f,round){
 if(f.specials?.length)return offeredFight(s,f,()=>[1,1,0],{...freshFight(),round})[0];
 if(round===f.rounds.length)return 1;
 const r=f.rounds[round];
 if(r.combo){
  let v=winCombo(s,f,round,r.combo,f.combo);if(v===1)return 1;
  v=Math.max(v,winPay(s,f,round,r.single,f.stat));if(v===1)return 1;
  return Math.max(v,winPay(s,f,round,f.bloodAt,f.blood),0);
 }
 let shared=winPay(s,f,round,r.fixed,f.stat);if(shared===1)return 1;
 shared=Math.max(shared,winPay(s,f,round,f.bloodAt,f.blood),0);if(shared===1)return 1;
 let total=0;
 for(const i of r.random)total+=i===r.fixed?shared:Math.max(shared,winPay(s,f,round,i,f.stat));
 return total/r.random.length;
}
function winPay(s,f,round,i,n){
 if(s[i]<n)return -1;
 s[i]-=n;const v=win(s,f,round+1);s[i]+=n;return v;
}
function winCombo(s,f,round,[a,b],n){
 s[a]-=n;s[b]-=n;
 const v=s[a]>=0&&s[b]>=0?win(s,f,round+1):-1;
 s[a]+=n;s[b]+=n;return v;
}

// Mini boss: same search, but values are [journey chance, mini boss killed, route nodes passed after it].
const FAIL=[0,0,0];
const better=(a,b)=>!b||(a[0]!==b[0]?a[0]>b[0]:a[1]!==b[1]?a[1]>b[1]:a[2]>b[2]);
function solve(s,f,leaf,round){
 if(f.specials?.length)return offeredFight(s,f,leaf,{...freshFight(),round});
 if(round===f.rounds.length)return leaf(s);
 const r=f.rounds[round];
 const pick=(...values)=>values.reduce((best,v)=>v&&better(v,best)?v:best,null);
 if(r.combo)return pick(solveCombo(s,f,leaf,round,r.combo,f.combo),solvePay(s,f,leaf,round,r.single,f.stat),solvePay(s,f,leaf,round,f.bloodAt,f.blood))??FAIL;
 const shared=pick(solvePay(s,f,leaf,round,r.fixed,f.stat),solvePay(s,f,leaf,round,f.bloodAt,f.blood));
 const total=[0,0,0];
 for(const i of r.random){
  const v=(i===r.fixed?shared:pick(shared,solvePay(s,f,leaf,round,i,f.stat)))??FAIL;
  for(let k=0;k<3;k++)total[k]+=v[k];
 }
 return total.map(v=>v/r.random.length);
}
function solvePay(s,f,leaf,round,i,n){
 if(s[i]<n)return null;
 s[i]-=n;const v=solve(s,f,leaf,round+1);s[i]+=n;return v;
}
function solveCombo(s,f,leaf,round,[a,b],n){
 s[a]-=n;s[b]-=n;
 const v=s[a]>=0&&s[b]>=0?solve(s,f,leaf,round+1):null;
 s[a]+=n;s[b]+=n;return v;
}

// Route node: keep the best main boss chance; on ties spend the stat with most left, blood only if strictly better.
function step(s,node,ctx){
 const cost=ctx.monster;
 if(node.type==='timed'){if(!ctx.waitTimed&&s[node.fixed]>=cost)s[node.fixed]-=cost;return true;}
 let best=null;
 for(const i of node.shown===node.fixed?[node.fixed]:[node.fixed,node.shown]){
  if(s[i]<cost)continue;
  s[i]-=cost;const v=ctx.main(s),left=s[i];s[i]+=cost;
  if(!best||v>best.v||v===best.v&&left>best.left)best={i,n:cost,v,left};
 }
 const blood=cost*ctx.bloodMult;
 if(s[ctx.bloodAt]>=blood){s[ctx.bloodAt]-=blood;const v=ctx.main(s);s[ctx.bloodAt]+=blood;if(!best||v>best.v)best={i:ctx.bloodAt,n:blood,v};}
 if(!best)return false;
 s[best.i]-=best.n;return true;
}

// The same stat vectors reach the main boss again and again (routes and mini boss paths converge).
function memoMain(fight){
 const cache=new Map();
 return s=>{
  const key=s.join();
  let v=cache.get(key);
  if(v===undefined){v=win(s,fight,0);if(cache.size>200000)cache.clear();cache.set(key,v);}
  return v;
 };
}
function prepare(data,opts,location){
 const c=compile(data),boss=c.bosses.get(location.boss);
 if(!boss)throw new RangeError(`Nieznany boss: ${location.boss}`);
 const fight=(b,stat)=>({rounds:b.rounds,specials:b.specials,base:opts.base,ids:data.params.map(p=>p.id),stat,combo:comboCost(data,stat),blood:stat*data.costs.blood,bloodMult:data.costs.blood,bloodAt:c.blood});
 const bossCost=stageCost(data,location.act,opts.level,'boss'),miniCost=stageCost(data,location.act,opts.level,'miniboss');
 const mainFight=fight(boss,bossCost),mini=opts.miniAfter!=null;
 mainFight.final=true;
 // Mini boss is the boss of one of the other locations.
 const miniIds=mini?data.locations.filter(l=>l.boss!==location.boss).map(l=>l.boss):[];
 return {
  start:Float64Array.from([...opts.stats,opts.blood]),bloodAt:c.blood,bloodMult:data.costs.blood,waitTimed:opts.waitTimed,
  monster:stageCost(data,location.act,opts.level,'monster'),bossCost,miniCost,bossName:boss.name,
  mainFight,main:memoMain(mainFight),mini,afterNode:opts.miniAfter,
  miniIds,minis:miniIds.map(id=>fight(c.bosses.get(id),miniCost))
 };
}
function compileRoute(data,route){
 const c=compile(data);
 return route.map(n=>{const e=c.encounters[n.encounter];if(!e)throw new RangeError(`Nieznane starcie: ${n.encounter}`);return {type:e.type,fixed:e.fixed,shown:n.shown==null?e.fixed:c.at(n.shown)};});
}
// `miniAt` = route nodes before the mini boss, counted from `start`; null when no mini boss is ahead.
function chanceFor(ctx,route,start=ctx.start,miniAt=ctx.mini?ctx.afterNode??route.length:null){
 const s=Float64Array.from(start);
 const after=miniAt==null?route.length:Math.min(Math.max(miniAt,0),route.length);
 for(let k=0;k<after;k++)if(!step(s,route[k],ctx))return {chance:0,nodes:k,miniKill:0,bossKill:0};
 if(miniAt==null){const p=ctx.main(s);return {chance:p,nodes:route.length,miniKill:null,bossKill:p};}
 const rest=state=>{
  const t=Float64Array.from(state);
  for(let k=after;k<route.length;k++)if(!step(t,route[k],ctx))return [0,1,k-after];
  return [ctx.main(t),1,route.length-after];
 };
 const sum=[0,0,0];
 const minis=route.miniDraw==null||!ctx.minis.some(f=>f.specials.length)?ctx.minis:[ctx.minis[Math.floor(route.miniDraw*ctx.minis.length)]];
 for(let f of minis){
  if(route.specialDraw!=null&&f.specials.length){
   let draw=route.specialDraw*f.specials.reduce((n,sp)=>n+(sp.weight??1),0),chosen=f.specials.at(-1);
   for(const sp of f.specials){draw-=sp.weight??1;if(draw<0){chosen=sp;break;}}
   f={...f,specials:[chosen]};
  }
  const v=solve(s,f,rest,0);for(let k=0;k<3;k++)sum[k]+=v[k];
 }
 const n=minis.length||1;
 return {chance:sum[0]/n,nodes:after+sum[2]/n,miniKill:sum[1]/n,bossKill:sum[0]/n};
}

export function routeChance(data,input,locationId,route){
 const location=data.locations.find(l=>l.id===locationId);
 if(!location)throw new RangeError(`Nieznana lokacja: ${locationId}`);
 return chanceFor(prepare(data,normalize(data,input),location),compileRoute(data,route));
}

// The same rolled routes are used for every location and level, so rows differ only by bosses and costs.
function rolledRoutes(data,opts){
 const rng=mulberry32(opts.seed),bossRng=mulberry32((opts.seed>>>0)^0x51ec1a1);
 return Array.from({length:opts.simulations},()=>Object.assign(compileRoute(data,rollRoute(data,opts.routeLength,rng)),{miniDraw:bossRng(),specialDraw:bossRng()}));
}
function summary(data,opts,location,routes){
 const ctx=prepare(data,opts,location),runs=routes.map(r=>chanceFor(ctx,r));
 const avg=key=>runs.reduce((t,r)=>t+r[key],0)/runs.length;
 return {
  locationId:location.id,name:location.name,act:location.act,boss:ctx.bossName,level:opts.level,
  monsterCost:ctx.monster,miniBossCost:ctx.mini?ctx.miniCost:null,bossCost:ctx.bossCost,
  completion:avg('chance'),allCertain:runs.every(r=>r.chance===1),avgNodes:avg('nodes'),routeLength:opts.routeLength,
  miniBossPresent:ctx.mini,miniBossKillChance:ctx.mini?avg('miniKill'):null,bossKillChance:avg('bossKill'),simulations:runs.length
 };
}

export function planJourneys(data,input){
 const opts=normalize(data,input),routes=rolledRoutes(data,opts);
 return data.locations.map(location=>summary(data,opts,location,routes));
}

// One location at fixed settings: planJourneys' completion for any stats (array in data.params order), routes rolled once.
export function chanceEvaluator(data,input,locationId){
 const location=data.locations.find(l=>l.id===locationId);
 if(!location)throw new RangeError(`Nieznana lokacja: ${locationId}`);
 const opts=normalize(data,{...input,stats:{}}),routes=rolledRoutes(data,opts);
 const evaluate=stats=>{
  const base=stats.map(v=>Math.max(0,Math.round(v)));
  // Costs and regeneration depend on the starting equipment too.
  const ctx=prepare(data,{...opts,stats:base,base},location);
  return routes.reduce((t,r)=>t+chanceFor(ctx,r).chance,0)/routes.length;
 };
 // The most-spent/highest-stat effects can change targets with equipment.
 evaluate.monotone=!data.bosses.some(b=>b.specials?.length);
 return evaluate;
}

// Highest level with a certain finish on every rolled route, checked from the top down; input.level is ignored.
export function hardestCertain(data,input){
 const {min,max}=data.costs.levels,levels=new Map();
 // Each level has its own layout; rolled routes depend only on seed and length, so they match planJourneys.
 const atLevel=level=>{
  if(!levels.has(level)){const opts=normalize(data,{...input,level});levels.set(level,{opts,routes:rolledRoutes(data,opts)});}
  return levels.get(level);
 };
 atLevel(max);
 return data.locations.map(location=>{
  let level=max;
  for(;level>=min;level--){
   const {opts,routes}=atLevel(level),ctx=prepare(data,opts,location);
   if(routes.every(r=>chanceFor(ctx,r).chance===1))break;
  }
  const found=level>=min?level:null,at=found&&prepare(data,atLevel(found).opts,location);
  // The level to aim for next: one above the certain one, or the easiest when none is certain.
  const nextLevel=found===max?null:found?found+1:min;
  const next=nextLevel&&summary(data,atLevel(nextLevel).opts,location,atLevel(nextLevel).routes);
  return {
   locationId:location.id,name:location.name,act:location.act,boss:compile(data).bosses.get(location.boss).name,level:found,
   monsterCost:at?at.monster:null,miniBossCost:at&&at.mini?at.miniCost:null,bossCost:at?at.bossCost:null,
   next:next&&{level:next.level,completion:next.completion},routeLength:found?atLevel(found).opts.routeLength:null,simulations:atLevel(max).routes.length
  };
 });
}

// Live journey: the log of what happened in game is replayed from the starting stats.
// Log entries: {type:'node',encounter,shown,pay} | {type:'mini',boss} | {type:'round',shown,pay};
// pay is a param id, 'blood', 'wait' (timed obstacle) or 'combo' (round 3).
function liveContext(data,run){
 const location=data.locations.find(l=>l.id===run.locationId);
 if(!location)throw new RangeError(`Nieznana lokacja: ${run.locationId}`);
 const opts=normalize(data,run),ctx=prepare(data,opts,location),N=opts.routeLength;
 const miniAt=ctx.mini?Math.min(Math.max(ctx.afterNode??N,0),N):null,stages=[];
 for(let k=0;k<=N;k++){if(miniAt===k)stages.push({type:'mini'});if(k<N)stages.push({type:'node',index:k});}
 stages.push({type:'boss'});
 const routes=new Map();
 // Unknown nodes still ahead are rolled the same way as in the planner (same seed, same count).
 const routesOf=len=>{
  if(!routes.has(len))routes.set(len,rolledRoutes(data,{...opts,routeLength:len}));
  return routes.get(len);
 };
 return {data,c:compile(data),location,opts,ctx,N,miniAt,stages,routesOf};
}
function livePhase(lc,pos){
 if(pos.finished)return 'done';
 if(!pos.miniDone&&pos.done===lc.miniAt)return pos.miniBoss?'mini':'miniPick';
 return pos.done<lc.N?'node':'main';
}
// Validate saved settings without calculating any journey odds on the UI thread.
export function validateJourneyRun(data,run){liveContext(data,run);}
function stageOf(lc,pos){
 const phase=livePhase(lc,pos);
 if(phase==='done')return null;
 if(phase==='main')return lc.stages.length-1;
 if(phase!=='node')return lc.stages.findIndex(s=>s.type==='mini');
 return lc.stages.findIndex(s=>s.type==='node'&&s.index===pos.done);
}
function currentFight(lc,pos){return livePhase(lc,pos)==='mini'?lc.ctx.minis[lc.ctx.miniIds.indexOf(pos.miniBoss)]:lc.ctx.mainFight;}
function currentState(pos){return {...(pos.fightState??freshFight()),round:pos.round};}
function liveOptions(lc,pos,entry){
 const {c,ctx,data}=lc,phase=livePhase(lc,pos),stat=(id,n)=>({pay:id,costs:[[c.at(id),n]]});
 const blood=n=>({pay:'blood',costs:[[c.blood,n*data.costs.blood]]});
 if(phase==='node'){
  const e=data.encounters[entry.encounter];
  if(!e)throw new RangeError(`Nieznane spotkanie: ${entry.encounter}`);
  if(e.type==='timed')return [{pay:'wait',costs:[]},stat(e.fixed,ctx.monster)];
  if(!e.random.includes(entry.shown))throw new RangeError(`Nieprawidłowy drugi parametr: ${entry.shown}`);
  return [stat(e.fixed,ctx.monster),...(entry.shown!==e.fixed?[stat(entry.shown,ctx.monster)]:[]),blood(ctx.monster)];
 }
 const f=currentFight(lc,pos),round=f.rounds[pos.round],shown=entry.shown??pos.shown;
 if(pos.shown!=null&&shown!==pos.shown)throw new RangeError('Drugi parametr tej rundy został już zapisany');
 if(!round.combo&&!round.random.includes(c.at(shown)))throw new RangeError(`Nieprawidłowy drugi parametr: ${shown}`);
 return fightOptions(entry.stats??lc.ctx.start,f,currentState(pos),round.combo?null:c.at(shown));
}
function payWith(s,costs){
 const t=Float64Array.from(s);
 for(const [i,n]of costs)t[i]-=n;
 return t.every(v=>v>=0)?t:null;
}
function advance(lc,pos,entry){
 const phase=livePhase(lc,pos),next={...pos};
 if(phase==='node')next.done++;
 else if(phase==='miniPick'){next.miniBoss=entry.boss;next.round=0;}
 else if(++next.round===3){next.round=0;next.fightState=freshFight();delete next.offer;delete next.specialCost;delete next.shown;if(phase==='mini')next.miniDone=true;else next.finished=true;}
 else delete next.shown;
 return next;
}
function liveReplay(lc,log){
 let s=Float64Array.from(lc.ctx.start),pos={done:0,miniDone:lc.miniAt==null,miniBoss:null,round:0,finished:false};
 const entryStage=[];
 for(const entry of log){
  const phase=livePhase(lc,pos);
  if((phase==='mini'||phase==='main')&&(entry?.type==='offer'||entry?.type==='special')){
   const f=currentFight(lc,pos);
   if(entry.type==='offer'){
    if(pos.offer!==undefined||pos.fightState?.used)break;
    if(entry.special!==null&&!f.specials.some(s=>s.id===entry.special))break;
    try{if(entry.special!==null)specialPrice(f,f.specials.find(s=>s.id===entry.special),entry.cost);}catch{break;}
    entryStage.push(stageOf(lc,pos));pos={...pos,offer:entry.special,specialCost:entry.cost};continue;
   }
   const special=f.specials.find(x=>x.id===pos.offer);
   if(!special||pos.fightState?.used)break;
   const r=f.rounds[pos.round];
   if(!r.combo&&!r.random.some(i=>f.ids[i]===entry.shown))break;
   const outcomes=specialOutcomes(s,f,currentState(pos),special,pos.specialCost);
   const result=entry.result??{};
   const branch=outcomes.find(b=>JSON.stringify(b.result)===JSON.stringify(result));
   if(!branch)break;
   entryStage.push(stageOf(lc,pos));s=branch.stats;
   const oldRound=pos.round;pos={...pos,round:branch.state.round,fightState:branch.state,shown:branch.state.round===oldRound?entry.shown:undefined};
   if(pos.round===3){pos={...pos,round:0,fightState:freshFight(),offer:undefined,specialCost:undefined,shown:undefined};if(phase==='mini')pos.miniDone=true;else pos.finished=true;}
   continue;
  }
  if(phase==='done'||entry?.type!==(phase==='node'?'node':phase==='miniPick'?'mini':'round'))break;
  if(phase==='miniPick'){if(!lc.ctx.miniIds.includes(entry.boss))break;}
  else{
   let option;
   try{option=liveOptions(lc,pos,{...entry,stats:s}).find(o=>o.pay===entry.pay);}catch{break;}
   const t=option&&payWith(s,option.costs);
   if(!t)break;
   s=t;
  }
  entryStage.push(stageOf(lc,pos));pos=advance(lc,pos,entry);
 }
 return {s,pos,entryStage};
}
// Route nodes left after the mini boss, then the main boss.
function afterMini(lc,pos){
 lc.afterMiniCache??=new Map();
 if(lc.afterMiniCache.has(pos.done))return lc.afterMiniCache.get(pos.done);
 const left=lc.N-pos.done;
 if(!left)return s=>[lc.ctx.main(s),1,0];
 // Bounded look-ahead for interactive mini-boss decisions; the planner still
 // samples 100 complete scenarios. Share the same prefix across every option.
 const routes=lc.routesOf(left).slice(0,12);
 const cache=new Map();
 const leaf=s=>{
  const key=s.join(),cached=cache.get(key);if(cached)return cached;
  let p=0,nodes=0;
  for(const r of routes){const v=chanceFor(lc.ctx,r,s,null);p+=v.chance;nodes+=v.nodes;}
  const value=[p/routes.length,1,nodes/routes.length];cache.set(key,value);return value;
 };
 lc.afterMiniCache.set(pos.done,leaf);return leaf;
}
function liveChance(lc,s,pos){
 const phase=livePhase(lc,pos),{ctx}=lc;
 if(phase==='done')return 1;
 if(phase==='main'||phase==='mini')return offeredFight(s,currentFight(lc,pos),phase==='main'?()=>[1,1,0]:afterMini(lc,pos),currentState(pos),pos.offer,pos.shown==null?null:lc.c.at(pos.shown),pos.specialCost)[0];
 const routes=lc.routesOf(lc.N-pos.done),miniAt=pos.miniDone?null:lc.miniAt-pos.done;
 return routes.reduce((t,r)=>t+chanceFor(ctx,r,s,miniAt).chance,0)/routes.length;
}
// Best chance first; on a tie wait (if preferred), then the stat with most left, blood last.
function recommend(options,waitTimed){
 const group=o=>o.pay==='blood'?3:o.pay==='wait'?(waitTimed?0:2):1;
 return options.filter(o=>o.affordable).sort((a,b)=>Math.abs(a.chance-b.chance)>1e-12?b.chance-a.chance:group(a)-group(b)||b.left-a.left)[0]??null;
}

export function liveAdvice(data,run,pending={}){
 const lc=liveContext(data,run),log=run.log??[],{s,pos,entryStage}=liveReplay(lc,log);
 const phase=livePhase(lc,pos),{c,ctx}=lc;
 pending={...pending,shown:pos.shown??pending.shown};
 const out={
  phase,valid:entryStage.length===log.length,applied:entryStage.length,entryStage,stages:lc.stages,current:stageOf(lc,pos),routeLength:lc.N,
  done:pos.done,round:pos.round,miniBoss:pos.miniBoss,
  offer:pos.offer,specialUsed:pos.fightState?.used??false,shown:pending.shown??null,shownLocked:pos.shown!=null,
  stats:Object.fromEntries(data.params.map((p,i)=>[p.id,s[i]])),blood:s[c.blood],
  costs:{monster:ctx.monster,miniBoss:ctx.mini?ctx.miniCost:null,boss:ctx.bossCost},
  chance:liveChance(lc,s,pos),candidates:null,options:null,recommended:null
 };
 if(phase==='miniPick'){
  const leaf=afterMini(lc,pos);
  out.candidates=ctx.miniIds.map((id,i)=>({boss:id,name:c.bosses.get(id).name,chance:ctx.minis[i].specials.length?null:solve(s,ctx.minis[i],leaf,0)[0]}));
 }
 const fight=phase==='mini'||phase==='main',needsShown=phase==='node'?data.encounters[pending.encounter]?.type==='enemy':fight&&pos.round<2;
 if((phase==='node'&&pending.encounter!=null||fight)&&(!needsShown||pending.shown)){
  const entry={type:phase==='node'?'node':'round',encounter:pending.encounter,shown:pending.shown??null},next=advance(lc,pos,entry);
  out.options=liveOptions(lc,pos,{...entry,stats:s}).map(o=>{
   const t=payWith(s,o.costs);
   return {pay:o.pay,costs:o.costs.map(([i,n])=>({param:i===c.blood?'blood':data.params[i].id,amount:n})),affordable:!!t,
    chance:t?liveChance(lc,t,next):null,left:t?Math.min(...o.costs.map(([i])=>t[i])):null};
  });
  out.recommended=recommend(out.options,lc.opts.waitTimed)?.pay??null;
 }
 if(fight){
  const f=currentFight(lc,pos),state=currentState(pos);
  out.specials=f.specials.map(sp=>({id:sp.id,effect:sp.effect,param:sp.param,cost:specialPrice(f,sp)}));
  const sp=f.specials.find(x=>x.id===pos.offer);
  if(sp&&!state.used){
   const cost=specialPrice(f,sp,pos.specialCost),branches=specialOutcomes(s,f,state,sp,pos.specialCost);
   const leaf=phase==='main'?()=>[1,1,0]:afterMini(lc,pos);
   const known=pos.round===2||!!pending.shown;
   const outcomeChance=b=>offeredFight(b.stats,f,leaf,b.state,pos.offer,b.state.round===pos.round&&pending.shown?c.at(pending.shown):null,pos.specialCost)[0];
   const chances=known?branches.map(outcomeChance):[];
   const chance=chances.length?(chances.every(v=>v===chances[0])?chances[0]:branches.reduce((p,b,i)=>p+b.probability*chances[i],0)):null;
   out.special={id:sp.id,effect:sp.effect,param:sp.param,cost,affordable:branches.length>0,chance,
    outcomes:known?branches.map(b=>({result:b.result,probability:b.probability})):[]};
   if(out.special.chance!=null&&out.special.chance>(out.options?.find(o=>o.pay===out.recommended)?.chance??-1)+1e-12)out.recommended='special';
  }
  if(out.options&&pos.offer!==undefined)out.chance=Math.max(0,...out.options.filter(o=>o.affordable).map(o=>o.chance),out.special?.chance??0);
 }
 return out;
}
