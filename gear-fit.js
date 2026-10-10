// Journey gear: the worn set that clears the hardest journey level of a location.
import {itemClass,normalize} from './engine.js';
import {lookupItem} from './item-details.js';
import {parsedRecord} from './item-compose.js';

export const MAX_EASE=50,MIN_ITEMS=8,SEARCH_BUDGET=600000;
const HAND1=new Set(['melee1','gun1']),HAND2=new Set(['melee2','gun2','ranged']);
const SLOTS={head:'head',chest:'chest',legs:'legs',neck:'neck',rings:'rings'};
export const SLOT_ORDER=['hands','head','chest','legs','neck','rings'];
export const slotOf=category=>SLOTS[category]??(HAND1.has(category)||HAND2.has(category)?'hands':null);
const EASE='łatwość {+} %';

// Anything below +5 is evaluated as the same item at +5; rarity and affixes stay.
export function upgradeItem(n){
 const c=itemClass(n);
 if(c===null||c>=5)return n;
 return {...n,original:`${n.original.replace(/\s*\(\+\d+\)\s*$/,'')} (+5)`,upgradedFrom:c};
}

// Active flat stats only: "(niekompletny)" set bonuses and percentages never match.
export function itemStats(n,details,params){
 const row=lookupItem(n,details);
 if(!row)return {error:'Brak tego wariantu w katalogu R21.'};
 if(row.partialRequirements)return {error:'Katalog nie zna dokładnych wymagań tego wariantu.'};
 const {features,requirements}=parsedRecord(row),at=new Map(params.map((id,i)=>[id,i]));
 const bonus=params.map(()=>0),need=params.map(()=>0);
 for(const [key,value]of Object.entries(features)){
  const m=key.match(/^(.+) \{\+\}$/),i=m?at.get(normalize(m[1])):undefined;
  if(i!==undefined)bonus[i]+=value;
 }
 for(const [key,value]of Object.entries(requirements)){const i=at.get(normalize(key));if(i!==undefined)need[i]=value;}
 // "Postać musi być w akcie" (legendary items) is assumed to be met.
 return {bonus,ease:features[EASE]||0,level:requirements.POZIOM||0,need};
}

export function gearCandidates(inventory,details,{params,upgrade=false,canUse=()=>true}){
 const items=[],skipped=[];
 for(const source of inventory){
  const slot=slotOf(source.category);
  if(!slot){skipped.push({source,reason:'Tego przedmiotu nie da się założyć.'});continue;}
  if(!canUse(source)){skipped.push({source,reason:'Nie pasuje do płci Twojej postaci.'});continue;}
  // With the upgrade option the +5 variant competes with the current one; at most one is worn.
  const hands=HAND2.has(source.category)?2:slot==='hands'?1:0,src=inventory.indexOf(source),up=upgrade?upgradeItem(source):source;
  const variants=[source,...(up!==source?[up]:[])].map(item=>({item,stats:itemStats(item,details,params)}));
  if(variants.every(v=>v.stats.error)){skipped.push({source,reason:variants[0].stats.error});continue;}
  for(const {item,stats}of variants)if(!stats.error)items.push({id:items.length,src,source,item,slot,hands,up:item===source?0:1,...stats});
 }
 return {items,skipped};
}

// Łatwość lowers every requirement, level included; the result is rounded up.
export const lowered=(req,ease)=>req>0?Math.ceil(req*(100-Math.min(MAX_EASE,Math.max(0,ease)))/100-1e-9):0;
function shortfall(it,support,ease,level){
 const lv=lowered(it.level,ease);
 if(lv>level)return {stat:'level',need:lv,have:level};
 for(let k=0;k<it.need.length;k++)if(it.need[k]){const n=lowered(it.need[k],ease);if(n>support[k])return {stat:k,need:n,have:support[k]};}
 return null;
}

// Upper bound of what the other slots can add: the best positive value per stat, per slot.
const topSum=(values,cap)=>values.filter(v=>v>0).sort((a,b)=>b-a).slice(0,cap).reduce((a,b)=>a+b,0);
function optimistic(items,P){
 const bonus=Array(P).fill(0);let ease=0;
 for(const slot of SLOT_ORDER){
  const list=items.filter(i=>i.slot===slot);if(!list.length)continue;
  const best=get=>slot==='hands'?Math.max(topSum(list.filter(i=>i.hands===1).map(get),2),topSum(list.filter(i=>i.hands===2).map(get),1)):topSum(list.map(get),slot==='rings'?2:1);
  for(let k=0;k<P;k++)bonus[k]+=best(i=>i.bonus[k]);
  ease+=best(i=>i.ease);
 }
 return {bonus,ease};
}
// Drops items whose requirements stay out of reach even with the best possible help from the rest.
export function reachableItems(items,character){
 const P=character.stats.length,dropped=new Map();
 let alive=items;
 for(;;){
  const opt=optimistic(alive,P),support=character.stats.map((v,k)=>v+opt.bonus[k]),ease=character.ease+opt.ease;
  const next=alive.filter(it=>{const why=shortfall(it,support,ease,character.level);if(why)dropped.set(it.id,why);return !why;});
  if(next.length===alive.length)return {items:next,dropped};
  alive=next;
 }
}

// Some equip order must exist where each item meets its requirements with the ones already worn.
function orderExists(chosen,character){
 const n=chosen.length,P=character.stats.length,failed=new Set();
 // Penalty-free items first is usually enough; a negative bonus can still block, so fall back to every order.
 const greedy=()=>{
  const support=character.stats.slice(),left=chosen.slice();let ease=character.ease;
  while(left.length){
   const fits=left.filter(it=>!shortfall(it,support,ease,character.level));
   if(!fits.length)return false;
   const it=fits.find(i=>i.ease>=0&&i.bonus.every(v=>v>=0))??fits[0];
   for(let k=0;k<P;k++)support[k]+=it.bonus[k];
   ease+=it.ease;left.splice(left.indexOf(it),1);
  }
  return true;
 };
 // Worn stats depend only on which items are on, so dead ends are remembered per subset.
 const go=(mask,support,ease)=>{
  if(mask===(1<<n)-1)return true;
  if(failed.has(mask))return false;
  for(let i=0;i<n;i++){
   const it=chosen[i];
   if(mask&1<<i||shortfall(it,support,ease,character.level))continue;
   if(go(mask|1<<i,support.map((v,k)=>v+it.bonus[k]),ease+it.ease))return true;
  }
  failed.add(mask);return false;
 };
 return greedy()||go(0,character.stats,character.ease);
}

export function bossParams(data,location){
 const boss=data.bosses.find(b=>b.id===location.boss),ids=new Set();
 for(const r of boss?.rounds??[])for(const id of [r.fixed,r.single,...(r.random??[]),...(r.combo??[])])if(id)ids.add(id);
 return data.params.map(p=>p.id).filter(id=>ids.has(id));
}

// Hardest level passing `certain`: the first mini boss level decides the direction, so levels are not all simulated.
export function hardestLevel(certain,{min,max,pivot}){
 if(pivot==null||pivot<min||pivot>max){for(let l=max;l>=min;l--)if(certain(l))return l;return null;}
 if(certain(pivot)){for(let l=max;l>pivot;l--)if(certain(l))return l;return pivot;}
 for(let l=pivot-1;l>=min;l--)if(certain(l))return l;
 return null;
}
export const firstMiniLevel=data=>{for(let l=data.costs.levels.min;l<=data.costs.levels.max;l++)if(data.routes[l]?.miniAfter!=null)return l;return null;};

const EPS=1e-9,EMPHASIS=15,covers=(a,b)=>a.every((v,k)=>v>=b[k]);
const lowerEase=character=>Math.min(MAX_EASE,Math.max(0,character.ease));
const idKey=set=>set.map(it=>it.id).sort((a,b)=>a-b).join();
// All stats count, boss stats 20% more (×5 to stay whole).
export const baseWeights=(P,target)=>Array.from({length:P},(_,k)=>target.includes(k)?6:5);

// Stats a boss always accepts: the fixed stats of rounds 1–2, the round 3 combo and its single stat.
export function bossFocus(data,location){
 const boss=data.bosses.find(b=>b.id===location.boss),at=id=>data.params.findIndex(p=>p.id===id),rounds=boss?.rounds??[];
 const fixed=rounds.filter(r=>r.fixed).map(r=>at(r.fixed)),combo=rounds.flatMap(r=>r.combo??[]).map(at),single=rounds.filter(r=>r.single).map(r=>at(r.single));
 return [fixed,combo,[...fixed,...combo],[...fixed,...single]].filter(f=>f.length);
}

// Every worn item meets its requirements with the others on, and some equip order gets there.
function wearable(set,character){
 const P=character.stats.length;
 for(const it of set){
  const support=character.stats.slice();let ease=character.ease;
  for(const o of set)if(o!==it){for(let k=0;k<P;k++)support[k]+=o.bonus[k];ease+=o.ease;}
  if(shortfall(it,support,ease,character.level))return false;
 }
 return orderExists(set,character);
}

// Exact branch and bound, no simulation: Σ weights·stats, then two 1H weapons over a 2H one, then fewer upgrades.
function weightedSet(slots,character,weights,budget){
 const P=character.stats.length,score=it=>it.bonus.reduce((s,v,k)=>s+v*weights[k],0);
 const groups=slots.map(g=>({options:options(g.items.map(it=>({...it,w:score(it)})),g.slot,P)})).filter(g=>g.options.length>1).sort((a,b)=>b.options[0].w-a.options[0].w);
 const G=groups.length,ubW=Array(G+1).fill(0),optB=Array.from({length:G+1},()=>Array(P).fill(0)),optE=Array(G+1).fill(0);
 for(let g=G-1;g>=0;g--){
  const o=groups[g].options;
  ubW[g]=ubW[g+1]+o[0].w;optE[g]=optE[g+1]+Math.max(0,...o.map(x=>x.ease));
  for(let k=0;k<P;k++)optB[g][k]=optB[g+1][k]+Math.max(0,...o.map(x=>x.bonus[k]));
 }
 const chosen=[],cur={bonus:Array(P).fill(0),ease:0,w:0,two:0,up:0};
 let best=null,nodes=0,aborted=false;
 const beats=(w,pref,up)=>!best||(w!==best.w?w>best.w:pref!==best.pref?pref>best.pref:up<best.up);
 // Every worn item, judged against the rest plus the best the remaining slots could still add.
 function feasible(g){
  const ob=optB[g],oe=optE[g];
  for(const it of chosen){
   const ease=character.ease+cur.ease-it.ease+oe;
   if(lowered(it.level,ease)>character.level)return false;
   for(let k=0;k<P;k++)if(it.need[k]&&lowered(it.need[k],ease)>character.stats[k]+cur.bonus[k]-it.bonus[k]+ob[k])return false;
  }
  return true;
 }
 function apply(o,sign){
  for(let k=0;k<P;k++)cur.bonus[k]+=sign*o.bonus[k];
  cur.ease+=sign*o.ease;cur.w+=sign*o.w;cur.two+=sign*o.two;cur.up+=sign*o.up;
  if(sign>0)chosen.push(...o.items);else chosen.length-=o.items.length;
 }
 function dfs(g){
  if(++nodes>budget){aborted=true;return;}
  if(g===G){
   if(beats(cur.w,cur.two?0:1,cur.up)&&orderExists(chosen,character))best={w:cur.w,pref:cur.two?0:1,up:cur.up,items:chosen.slice(),bonus:cur.bonus.slice()};
   return;
  }
  for(const o of groups[g].options){
   const w=cur.w+o.w+ubW[g+1];
   if(best&&w<best.w)break;
   if(!beats(w,cur.two||o.two?0:1,cur.up+o.up))continue;
   apply(o,1);
   if(feasible(g+1))dfs(g+1);
   apply(o,-1);
   if(aborted)return;
  }
 }
 dfs(0);
 return {best,aborted};
}

// Without `chance` the set with the best weighted stats wins. With `chance(level)` (an evaluator of stat arrays) the set
// first clears the hardest level at 100%, then has the best chance one level higher (level 1 when none is certain),
// then the weighted ties. Simulation is expensive: only a small pool of weighted sets is simulated, then single-slot
// swaps improve the best one while `timeMs` allows.
export function bestGear(items,character,target,{chance=null,levels=null,focus=[],timeMs=1500,budget=SEARCH_BUDGET}={}){
 const P=character.stats.length,started=Date.now(),base=lowerEase(character);
 const easeMatters=base<MAX_EASE&&items.some(it=>lowered(it.level,base)>character.level||it.need.some((n,k)=>n&&lowered(n,base)>character.stats[k]));
 const slots=SLOT_ORDER.map(slot=>({slot,items:prune(items.filter(it=>it.slot===slot),easeMatters)})).filter(g=>g.items.length);
 const weights=baseWeights(P,target),wOf=bonus=>bonus.reduce((s,v,k)=>s+v*weights[k],0);
 const describe=(set,bonus)=>({items:set,bonus,w:wOf(bonus),pref:set.some(i=>i.hands===2)?0:1,up:set.reduce((s,i)=>s+i.up,0),stats:character.stats.map((v,k)=>Math.max(0,v+bonus[k]))});
 let aborted=false,evals=0,level=null,goal=null;
 const weightedPick=w=>{const r=weightedSet(slots,character,w,budget);aborted||=r.aborted;return r.best&&describe(r.best.items,r.best.bonus);};
 const first=weightedPick(weights)??describe([],Array(P).fill(0));
 let best=first;
 if(chance){
  const memo=new Map();
  // More of any stat never lowers the chance, so simulated vectors settle the ones they cover or are covered by.
  const at=l=>{let m=memo.get(l);if(!m)memo.set(l,m={fn:chance(l),known:new Map(),sim:new Map(),seen:[]});return m;};
  const simulate=(l,s)=>{const m=at(l),key=s.join();if(!m.sim.has(key)){evals++;const c=m.fn(s);m.sim.set(key,c);m.seen.push({s,c});}return m.sim.get(key);};
  const chanceAt=(l,s)=>{
   const m=at(l),key=s.join();let c=m.sim.get(key)??m.known.get(key);if(c!==undefined)return c;
   for(const e of m.seen)if(e.c>=1-EPS&&covers(s,e.s)||e.c<=EPS&&covers(e.s,s)){c=e.c;break;}
   if(c===undefined)return simulate(l,s);
   m.known.set(key,c);return c;
  };
  // The pool: the weighted best, then the same search pushing each boss stat and the stats the boss always accepts.
  const pool=[first],keys=new Set([idKey(first.items)]);
  for(const f of [...target.map(k=>[k]),...focus]){
   const set=weightedPick(weights.map((v,k)=>v+(f.includes(k)?EMPHASIS:0)));
   if(set&&!keys.has(idKey(set.items))){keys.add(idKey(set.items));pool.push(set);}
  }
  const opt=optimistic(slots.flatMap(g=>g.items),P).bonus,top=character.stats.map((v,k)=>Math.max(0,v+opt[k]));
  const certain=new Map();
  level=hardestLevel(l=>{
   // Nothing clears a level the best item of every slot cannot; above the pivot only sets certain there are tried.
   const from=levels.pivot!=null&&l>levels.pivot&&certain.has(levels.pivot)?certain.get(levels.pivot):pool;
   const list=chanceAt(l,top)<1-EPS?[]:from.filter(s=>chanceAt(l,s.stats)>=1-EPS);
   certain.set(l,list);return list.length>0;
  },levels);
  goal=level===null?levels.min:level<levels.max?level+1:null;
  const value=s=>({...s,c:goal==null?null:chanceAt(goal,s.stats)});
  const better=(a,b)=>goal!=null&&Math.abs(a.c-b.c)>EPS?a.c>b.c:a.w!==b.w?a.w>b.w:a.pref!==b.pref?a.pref>b.pref:a.up<b.up;
  best=(level===null?pool:certain.get(level)).map(value).reduce((b,s)=>!b||better(s,b)?s:b,null);
  // Single-slot swaps until nothing improves or time runs out; a swap must stay wearable and keep the level at 100%.
  const swaps=slots.map(g=>({slot:g.slot,options:options(g.items.map(it=>({...it,w:wOf(it.bonus)})),g.slot,P)}));
  let changed=true;
  search:while(changed){
   changed=false;
   // A swap can clear the next level too: it becomes the level to keep, and the one above becomes the goal.
   while(goal!=null&&best.c>=1-EPS){level=goal;goal=level<levels.max?level+1:null;best=value(best);}
   for(const g of swaps){
    const rest=best.items.filter(it=>it.slot!==g.slot),current=idKey(best.items.filter(it=>it.slot===g.slot));
    for(const o of g.options){
     if(idKey(o.items)===current)continue;
     if(Date.now()-started>timeMs){aborted=true;break search;}
     const set=[...rest,...o.items],cand=describe(set,Array.from({length:P},(_,k)=>set.reduce((s,it)=>s+it.bonus[k],0)));
     // Lower or equal everywhere: neither the chance nor the weighted sum can rise.
     if(covers(best.stats,cand.stats)&&cand.pref<=best.pref&&cand.up>=best.up)continue;
     if(!wearable(set,character))continue;
     if(level!==null&&chanceAt(level,cand.stats)<1-EPS)continue;
     const v=value(cand);
     if(better(v,best)){best=v;changed=true;continue search;}
    }
   }
  }
  // A slot is never left empty when an item that only adds stats fits. The route planner can rate extra stats a bit
  // lower, but in the game they cannot hurt. One that keeps the level at 100% is preferred, the highest weighted first.
  const gain=it=>it.ease>=0&&it.bonus.every(v=>v>=0)&&(it.ease>0||it.bonus.some(v=>v>0));
  const fillers=slots.flatMap(g=>g.items).filter(gain).sort((a,b)=>wOf(b.bonus)-wOf(a.bonus));
  const free=(set,it)=>{
   const same=set.filter(o=>o.slot===it.slot);
   if(it.slot==='rings')return same.length<2;
   if(it.slot!=='hands')return !same.length;
   return it.hands===1?same.length<2&&!same.some(o=>o.hands===2):!same.length;
  };
  for(let added=true;added;){
   added=false;let fallback=null;
   const used=new Set(best.items.map(it=>it.src));
   for(const it of fillers){
    if(used.has(it.src)||!free(best.items,it))continue;
    const set=[...best.items,it];
    if(!wearable(set,character))continue;
    const cand=describe(set,best.bonus.map((v,k)=>v+it.bonus[k]));
    if(level!==null&&chanceAt(level,cand.stats)<1-EPS){fallback??=cand;continue;}
    best=value(cand);added=true;break;
   }
   if(!added&&fallback){best=value(fallback);added=true;}
  }
  // The shortcuts assume more stats never lower the chance; the route planner can break that slightly,
  // so the reported level and chance are simulated for the chosen set, exactly as the table will show them.
  if(level!==null&&simulate(level,best.stats)<1-EPS||goal!=null&&simulate(goal,best.stats)>=1-EPS){
   level=hardestLevel(l=>simulate(l,best.stats)>=1-EPS,levels);
   goal=level===null?levels.min:level<levels.max?level+1:null;
  }
  best={...best,c:goal==null?null:simulate(goal,best.stats)};
 }
 const order=it=>SLOT_ORDER.indexOf(it.slot)*10+it.hands;
 return {
  items:best.items.slice().sort((a,b)=>order(a)-order(b)||a.id-b.id).map(it=>it.id),bonus:best.bonus,
  score:target.reduce((s,k)=>s+best.bonus[k],0),total:best.bonus.reduce((a,b)=>a+b,0),weighted:best.w,
  level,goal,chance:goal==null?null:best.c,complete:!aborted,evals
 };
}

// Within one slot kind, an item is dropped when enough others (or an empty slot) are at least as good everywhere.
function prune(list,easeMatters){
 const kinds=new Map();
 for(const it of list){const kind=it.slot==='hands'?`hands${it.hands}`:it.slot;if(!kinds.has(kind))kinds.set(kind,[]);kinds.get(kind).push(it);}
 const out=[];
 for(const [kind,items]of kinds){
  const cap=kind==='rings'||kind==='hands1'?2:1;
  // Every stat feeds the journey chance, so all of them must be at least as high.
  const atLeast=(a,b)=>{
   if(a.level>b.level||(easeMatters?a.ease<b.ease:a.ease<Math.min(b.ease,0)))return false;
   for(let k=0;k<a.bonus.length;k++)if(a.need[k]>b.need[k]||a.bonus[k]<b.bonus[k])return false;
   return true;
  };
  const empty={level:0,ease:0,bonus:items[0].bonus.map(()=>0),need:items[0].need.map(()=>0)};
  for(const b of items){
   if(atLeast(empty,b))continue;
   // Dominators are counted per physical item; the other variant of b itself can always take its place.
   const by=new Set(items.filter(a=>a!==b&&atLeast(a,b)&&(!atLeast(b,a)||a.id<b.id)).map(a=>a.src));
   if(!by.has(b.src)&&by.size<cap)out.push(b);
  }
 }
 return out;
}

// Slot options, best first: empty, single items, and pairs for rings and one-handed weapons.
function options(list,slot,P){
 const make=items=>{
  const bonus=Array(P).fill(0);let ease=0,w=0,up=0;
  for(const it of items){for(let k=0;k<P;k++)bonus[k]+=it.bonus[k];ease+=it.ease;w+=it.w;up+=it.up;}
  return {items,bonus,ease,w,up,two:items.some(i=>i.hands===2)?1:0};
 };
 const out=[make([]),...list.map(it=>make([it]))];
 if(slot==='rings'||slot==='hands'){
  const pairable=slot==='rings'?list:list.filter(i=>i.hands===1);
  for(let i=0;i<pairable.length;i++)for(let j=i+1;j<pairable.length;j++)if(pairable[i].src!==pairable[j].src)out.push(make([pairable[i],pairable[j]]));
 }
 return out.sort((a,b)=>b.w-a.w||a.two-b.two||a.up-b.up||a.items.length-b.items.length);
}

// Plain data for the worker: everything the search needs, nothing from the catalog.
export const searchItem=({id,src,slot,hands,up,bonus,ease,level,need})=>({id,src,slot,hands,up,bonus,ease,level,need});

// `chanceFor(location)` returns level => evaluator; without it sets are ranked by the weighted stats sum only.
export function fitLocations(data,items,character,{chanceFor=null,timeMs,onProgress}={}){
 const params=data.params.map(p=>p.id),{items:alive,dropped}=reachableItems(items,character);
 const levels={...data.costs.levels,pivot:firstMiniLevel(data)};
 const results=data.locations.map((location,i)=>{
  const target=bossParams(data,location).map(id=>params.indexOf(id));
  const result={locationId:location.id,target,...bestGear(alive,character,target,{chance:chanceFor?.(location),levels,focus:bossFocus(data,location),timeMs})};
  onProgress?.({done:i+1,total:data.locations.length,result});
  return result;
 });
 return {results,dropped:[...dropped]};
}

// Pasted text from the game: first "<stat> <number>" for each stat, level and łatwość.
export function parseCharacterText(raw,params){
 const s=normalize(String(raw).slice(0,200000)),first=re=>{const m=s.match(re);return m?Number(m[1]):null;};
 const stats={};
 for(const id of params){const v=first(new RegExp(`(?:^|[^a-z])${id}\\s*[:=]?\\s*(\\d+)`));if(v!==null)stats[id]=v;}
 return {stats,level:first(/(?:^|[^a-z])poziom(?: postaci)?\s*[:=]?\s*(\d+)/),ease:first(/(?:^|[^a-z])latwosc\s*[:=]?\s*\+?\s*(\d+)/)};
}
