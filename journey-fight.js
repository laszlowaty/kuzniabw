import {SPECIAL_RULES,specialCost} from './journey-specials.js';

export const freshFight=()=>({round:0,used:false,factors:[1,1,1],extras:[null,null,null]});
const highest=(s,n)=>{let best=0;for(let i=1;i<n;i++)if(s[i]>s[best])best=i;return best;};
export function fightOptions(s,f,state,shown){
 const r=f.rounds[state.round],factor=state.factors[state.round],cost=Math.round(f.stat*factor);
 const stat=i=>({pay:f.ids[i],costs:[[i,cost]]});
 let options=r.combo?[{pay:'combo',costs:r.combo.map(i=>[i,Math.round(f.combo*factor)])},stat(r.single)]:[stat(r.fixed),...(shown!==r.fixed?[stat(shown)]:[])];
 const extra=state.extras[state.round];
 if(extra!=null){const i=extra==='highest'?highest(s,f.bloodAt):extra;if(!options.some(o=>o.pay===f.ids[i]))options.push(stat(i));}
 options.push({pay:'blood',costs:[[f.bloodAt,cost*f.bloodMult]]});
 return options;
}
export function payFight(s,costs){
 const t=Float64Array.from(s);for(const [i,n]of costs)t[i]-=n;
 return t.every(v=>v>=0)?t:null;
}
export function specialPrice(f,special,override){
 const cost=specialCost(special,f.base[special.at],override);
 if(!Number.isSafeInteger(cost)||cost<0)throw new RangeError('Nieprawidłowy koszt ataku specjalnego');
 return cost;
}
// Each branch carries its probability and the result that the live UI records.
export function specialOutcomes(s,f,state,special,override){
 if(state.used||state.round>=f.rounds.length)return [];
 const cost=specialPrice(f,special,override),t=payFight(s,[[special.at,cost]]);
 if(!t)return [];
 const rule=SPECIAL_RULES[special.id],r=state.round,n=f.bloodAt;
 const next={...state,used:true,factors:[...state.factors],extras:[...state.extras]};
 const branch=(stats=t,st=next,result={},probability=1)=>({stats,state:st,result,probability});
 switch(rule.kind){
  case 'discount':for(let k=r;k<3;k++)next.factors[k]*=1-rule.value;break;
  case 'nextDiscount':if(r<2)next.factors[r+1]*=1-rule.value;break;
  case 'counter':next.factors[r]*=1.2;if(r<2)next.factors[r+1]*=0.5;break;
  case 'nextHighest':if(r<2)next.extras[r+1]='highest';break;
  case 'highest':next.extras[r]='highest';break;
  case 'nextParam':if(r<2)next.extras[r+1]=f.ids.indexOf(rule.target);break;
  case 'double':{const at=f.ids.indexOf(rule.target);t[at]*=2;break;}
  case 'regenerate':for(let i=0;i<n;i++)if(i!==special.at)t[i]+=Math.floor(f.base[i]*rule.value);break;
  case 'restore':{
   let most=0,at=-1;for(let i=0;i<n;i++)if(i!==special.at&&f.base[i]-t[i]>most){most=f.base[i]-t[i];at=i;}
   if(at>=0)t[at]=f.base[at];break;
  }
  case 'skip':return [branch(t,{...next,round:r+1},{success:true},rule.probability),branch(t,next,{success:false},1-rule.probability)];
  case 'randomParam':return Array.from({length:n},(_,i)=>branch(t,{...next,extras:next.extras.map((v,k)=>k===r?i:v)},{param:f.ids[i]},1/n));
  case 'boostThree':{
   const out=[],count=n*(n-1)*(n-2)/6;
   for(let a=0;a<n;a++)for(let b=a+1;b<n;b++)for(let c=b+1;c<n;c++){
    const boosted=Float64Array.from(t);for(const i of [a,b,c])boosted[i]+=Math.floor(boosted[i]*rule.value);
    out.push(branch(boosted,next,{params:[f.ids[a],f.ids[b],f.ids[c]]},1/count));
   }
   return out;
  }
 }
 return [branch()];
}
const better=(a,b)=>!b||(a[0]!==b[0]?a[0]>b[0]:a[1]!==b[1]?a[1]>b[1]:a[2]>b[2]);
const average=branches=>{
 const out=[0,0,0];for(const [p,v]of branches)for(let k=0;k<3;k++)out[k]+=p*v[k];
 // Avoid floating point averages of certain branches reading as 99%.
 for(let k=0;k<3;k++)if(branches.every(([,v])=>v[k]===branches[0][1][k]))out[k]=branches[0][1][k];
 return out;
};
// Allocation-free final-boss search once the special is spent (the hottest
// path, including all 84 Scorpion outcomes). No future route to evaluate here.
function plainWin(s,f,state,round=state.round,shown=null){
 if(round===f.rounds.length)return 1;
 const r=f.rounds[round],factor=state.factors[round],cost=Math.round(f.stat*factor);
 const pay=(i,n)=>{if(s[i]<n)return 0;s[i]-=n;const p=plainWin(s,f,state,round+1);s[i]+=n;return p;};
 let shared=0;
 if(r.combo){
  const n=Math.round(f.combo*factor),[a,b]=r.combo;s[a]-=n;s[b]-=n;
  if(s[a]>=0&&s[b]>=0)shared=plainWin(s,f,state,round+1);
  s[a]+=n;s[b]+=n;if(shared===1)return 1;
  shared=Math.max(shared,pay(r.single,cost));
 }else shared=pay(r.fixed,cost);
 if(shared===1)return 1;
 const extra=state.extras[round];
 if(extra!=null)shared=Math.max(shared,pay(extra==='highest'?highest(s,f.bloodAt):extra,cost));
 if(shared===1)return 1;
 shared=Math.max(shared,pay(f.bloodAt,cost*f.bloodMult));if(shared===1||r.combo)return shared;
 const slots=shown==null?r.random:[shown];let total=0;
 for(const i of slots)total+=i===r.fixed?shared:Math.max(shared,pay(i,cost));
 return total/slots.length;
}
// Expectimax: observe the random regular slot, then decide whether and when to
// spend the single special. Failed skips stay in the same round, already used.
const miniCaches=new WeakMap();
export function evaluateFight(s,f,leaf,state=freshFight(),special=null,shown=null,override){
 if(f.final)return evaluate(s,f,leaf,state,special,shown,override);
 let fights=miniCaches.get(leaf);if(!fights){fights=new WeakMap();miniCaches.set(leaf,fights);}
 let cache=fights.get(f);if(!cache){cache=new Map();fights.set(f,cache);}
 const key=`${s.join()}|${state.round}|${state.used?1:0}|${state.factors}|${state.extras}|${state.used?'':special?.id??''}|${shown}|${override??''}`;
 const cached=cache.get(key);if(cached)return cached;
 const value=evaluate(s,f,leaf,state,special,shown,override);
 if(cache.size>20000)cache.clear();cache.set(key,value);return value;
}
function evaluate(s,f,leaf,state,special,shown,override){
 if(state.round===f.rounds.length)return leaf(s);
 if(f.final){
  const plain=plainWin(s,f,state,state.round,shown);
  if(plain===1||state.used||!special)return [plain,plain,0];
 }
 const round=f.rounds[state.round];
 const slots=round.combo?[null]:shown!=null?[shown]:round.random;
 return average(slots.map(slot=>{
  let best=[0,0,0];
  for(const o of fightOptions(s,f,state,slot)){
   const t=payFight(s,o.costs);if(!t)continue;
   const v=evaluateFight(t,f,leaf,{...state,round:state.round+1},special,null,override);
   if(better(v,best))best=v;
   if(best[0]===1)return [1/slots.length,best];
  }
  if(special&&!state.used){
   const branches=specialOutcomes(s,f,state,special,override);
   if(branches.length){
    const v=average(branches.map(b=>[b.probability,evaluateFight(b.stats,f,leaf,b.state,special,b.state.round===state.round?slot:null,override)]));
    if(better(v,best))best=v;
   }
  }
  return [1/slots.length,best];
 }));
}

export function offeredFight(s,f,leaf,state=freshFight(),offer,shown=null,override){
 if(offer!==undefined){
  const special=offer===null?null:f.specials.find(x=>x.id===offer);
  if(offer!==null&&!special)throw new RangeError('Nieznany atak specjalny bossa');
  return evaluateFight(s,f,leaf,state,special,shown,override);
 }
 // The wiki reports about 50% for the exclusive action. Remaining generic
 // actions share the remainder; these weights are a documented estimate.
 const plain=evaluateFight(s,f,leaf,state,null,shown);
 if(plain[0]===1||!f.specials.length||state.used)return plain;
 const total=f.specials.reduce((n,sp)=>n+(sp.weight??1),0);
 return average(f.specials.map(special=>[(special.weight??1)/total,evaluateFight(s,f,leaf,state,special,shown)]));
}
