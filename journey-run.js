import {validateJourneyRun,routeLayout,chanceLabel,chanceTone} from './journey-sim.js';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const STORAGE='kuzniaJourneyRun',ACTS={1:'I',2:'II',3:'III'};
const plural=(n,one,few,many)=>n===1?one:n%10>=2&&n%10<=4&&(n%100<12||n%100>14)?few:many;

// "3 węzły → mini boss → 2 węzły → boss"
export function routeText({nodes,miniAfter}){
 const count=n=>`${n} ${plural(n,'węzeł','węzły','węzłów')}`;
 if(miniAfter==null)return `${count(nodes)} → boss`;
 return [miniAfter?count(miniAfter):null,'mini boss',nodes>miniAfter?count(nodes-miniAfter):null,'boss'].filter(Boolean).join(' → ');
}

// A run in progress survives reloads; it is dropped if the data no longer knows its location.
export function readSavedRun(data){
 try{
  const run=JSON.parse(localStorage.getItem(STORAGE)||'null');
  if(run&&Array.isArray(run.log)&&data.locations.some(l=>l.id===run.locationId)){validateJourneyRun(data,run);return run;}
 }catch{}
 return null;
}

// Live journey: the player reports each encounter, the planner says what to pay and recalculates the rest.
export function createJourneyRun({data,root,onEnd}){
 let run=null,pending={},view=null,focus=null,worker=null,advice=null;
 const label=id=>id==='blood'?'Krew':data.params.find(p=>p.id===id)?.label??id;
 const bossName=id=>data.bosses.find(b=>b.id===id)?.name??id;
 const encounters=data.encounters.map((e,i)=>({...e,i})).sort((a,b)=>a.name.localeCompare(b.name,'pl'));
 function save(){try{localStorage.setItem(STORAGE,JSON.stringify(run));}catch{}}
 function start(next){stop();advice=null;root.innerHTML='';run={...next,log:next.log??[]};pending={};view=null;focus=null;save();render();}
 function stop(){worker?.terminate();worker=null;root.removeAttribute('aria-busy');}
 function end(){stop();run=null;advice=null;focus=null;root.innerHTML='';root.hidden=true;try{localStorage.removeItem(STORAGE);}catch{}onEnd();}
 function commit(entry){run.log=[...run.log,entry];pending={};view=null;save();render();}

 function optionName(o){
  if(o.pay==='wait')return 'Przeczekaj';
  if(o.pay==='blood')return 'Krew';
  if(o.pay==='combo')return `Kombo: ${o.costs.map(c=>label(c.param)).join(' + ')}`;
  return label(o.pay);
 }
 function optionCost(o){
  if(o.pay==='wait')return '5 min · bez nagrody z worka';
  if(o.pay==='blood')return `${o.costs[0].amount.toLocaleString('pl')} krwi`;
  return `${o.costs.map(c=>c.amount.toLocaleString('pl')).join(' + ')} pkt`;
 }
 function options(advice){
  if(!advice.options)return '';
  const any=advice.options.some(o=>o.affordable)||advice.special?.affordable;
  return `<p class="journeyOptionsHint">Kliknij to, czym zapłaciłeś w grze:</p><div class="journeyOptions">${advice.options.map(o=>{
   const rec=o.pay===advice.recommended,left=o.affordable&&o.pay!=='wait'&&o.pay!=='combo'?` · zostanie ${o.left.toLocaleString('pl')}`:'';
   return `<button type="button" class="journeyOption${rec?' recommended':''}" data-pay="${esc(o.pay)}"${o.affordable?'':' disabled'}><span class="journeyOptionName">${esc(optionName(o))}</span><span class="journeyOptionCost">${esc(optionCost(o))}${left}</span><span class="journeyOptionChance">${o.affordable?`szansa po: <b class="journeyTone ${chanceTone(o.chance)}">${chanceLabel(o.chance)}</b>`:'za mało'}</span>${rec?'<em>Polecane</em>':''}</button>`;
  }).join('')}</div>${any?'':'<p class="journeyStuck">Nie stać Cię na żadną opcję. W grze możesz odpocząć do następnego dnia albo uciec.</p>'}`;
 }
 function pickSelect(name,text,choices,value){
  return `<label>${text}<select data-pick="${name}"><option value="">Wybierz…</option>${choices}</select></label>`.replace(`value="${esc(value)}"`,`value="${esc(value)}" selected`);
 }
 function nodeStep(advice){
  const e=data.encounters[pending.encounter];
  const group=(type,title)=>`<optgroup label="${title}">${encounters.filter(x=>x.type===type).map(x=>`<option value="${x.i}">${esc(x.name)}</option>`).join('')}</optgroup>`;
  const pick=pickSelect('encounter','Kto się pojawił?',group('enemy','Przeciwnicy')+group('timed','Przeszkody czasowe'),pending.encounter??'');
  const shown=e?.type==='enemy'?pickSelect('shown',`Drugi parametr (pierwszy: ${esc(label(e.fixed))})`,e.random.map(id=>`<option value="${id}">${esc(label(id))}</option>`).join(''),pending.shown??''):'';
  const hint=advice.options?'':`<p class="subtle">${e?'Wybierz drugi parametr przeciwnika.':'Wybierz, kto pojawił się na tym węźle.'}</p>`;
  return `<h3>Węzeł ${advice.done+1} z ${advice.routeLength}</h3><div class="journeyPick">${pick}${shown}</div>${hint}${options(advice)}`;
 }
 function fightStep(advice){
  const mini=advice.phase==='mini',id=mini?advice.miniBoss:data.locations.find(l=>l.id===run.locationId).boss;
  const round=data.bosses.find(b=>b.id===id).rounds[advice.round];
  const head=`<h3>${mini?'Mini boss':'Boss'}: ${esc(bossName(id))} · runda ${advice.round+1} z 3</h3>${specialControls(advice)}`;
  if(round.combo)return `${head}<p class="subtle">Kombo ${esc(round.combo.map(label).join(' + '))} albo sam parametr ${esc(label(round.single))}.</p>${options(advice)}`;
  const pick=pickSelect('shown',`Drugi parametr rundy (pierwszy: ${esc(label(round.fixed))})`,round.random.map(p=>`<option value="${p}">${esc(label(p))}</option>`).join(''),pending.shown??advice.shown??'').replace('<select ',`<select ${advice.shownLocked?'disabled ':''}`);
  return `${head}<div class="journeyPick">${pick}</div>${advice.options?options(advice):'<p class="subtle">Wybierz drugi parametr, który pokazała gra.</p>'}`;
 }
 function specialControls(a){
  if(!a.specials?.length)return '';
  if(a.specialUsed)return '<p class="hint">Atak specjalny wykorzystany w tej walce.</p>';
  if(a.offer===null)return '<p class="hint">Ta walka jest liczona bez ataku specjalnego.</p>';
  if(a.offer===undefined){
   const selected=a.specials.find(s=>s.id===pending.offer),choices=a.specials.map(s=>`<option value="${s.id}">${esc(s.effect)} (${esc(label(s.param))})</option>`).join('')+'<option value="none">Bez specjala / inny niż na liście</option>';
   return `<div class="journeySpecial"><div class="journeyPick">${pickSelect('offer','Atak specjalny pokazany przez grę',choices,pending.offer??'')}${selected?`<label>Koszt: ${esc(label(selected.param))}<input type="number" min="0" step="1" inputmode="numeric" data-special-cost value="${pending.specialCost??selected.cost}"></label>`:''}</div><button type="button" class="secondary" data-action="offer"${pending.offer?'':' disabled'}>Zapisz specjal</button><p class="hint">Jeden wylosowany specjal, jedno użycie na tę walkę. Koszt możesz poprawić według gry.</p></div>`;
  }
  const sp=a.special;if(!sp)return '';
  const resultText=r=>r.success!==undefined?(r.success?'Runda wygrana':'Nie udało się wygrać rundy'):r.params?`Wzmocnione: ${r.params.map(label).join(', ')}`:r.param?`Wylosowany parametr: ${label(r.param)}`:'Zastosuj efekt';
  return `<div class="journeySpecial${a.recommended==='special'?' recommended':''}"><p><b>${a.recommended==='special'?'Polecane teraz · ':''}Specjal: ${esc(label(sp.param))} · ${sp.cost} pkt</b><br>${esc(sp.effect)}</p><p class="hint">${sp.chance==null?'Wybierz drugi parametr rundy, aby obliczyć szansę.':`Szansa po użyciu: ${chanceLabel(sp.chance)} (przed losowaniem efektu).`}</p>${sp.outcomes.length>1?`<label>Wynik pokazany przez grę<select data-special-result><option value="">Wybierz…</option>${sp.outcomes.map((o,i)=>`<option value="${i}">${esc(resultText(o.result))}</option>`).join('')}</select></label>`:''}<button type="button" class="secondary" data-action="use-special"${sp.affordable&&sp.outcomes.length?'':' disabled'}>Użyłem specjala w grze</button>${!sp.affordable?'<p class="hint">Za mało punktów wymaganego parametru.</p>':''}</div>`;
 }
 function miniStep(advice){
  return `<h3>Mini boss</h3><p class="subtle">Który boss pojawił się jako mini boss?</p><div class="journeyOptions">${advice.candidates.map(c=>`<button type="button" class="journeyOption" data-mini="${esc(c.boss)}"><span class="journeyOptionName">${esc(c.name)}</span><span class="journeyOptionChance">${c.chance==null?'Wybierz przeciwnika z gry':`szansa: <b class="journeyTone ${chanceTone(c.chance)}">${chanceLabel(c.chance)}</b>`}</span></button>`).join('')}</div>`;
 }
 function pastStep(advice,stage){
  const entries=run.log.map((entry,i)=>[entry,advice.entryStage[i]]).filter(([,s])=>s===stage).map(([entry])=>entry);
  let round=0;
  const lines=entries.map(entry=>{
   if(entry.type==='mini')return `Mini boss: ${esc(bossName(entry.boss))}`;
   if(entry.type==='offer'){const sp=data.bosses.flatMap(b=>b.specials).find(s=>s.id===entry.special);return `Specjal: ${esc(sp?.effect??'bez specjala')}${entry.cost!=null?` · ${entry.cost} pkt`:''}`;}
   if(entry.type==='special'){const r=entry.result??{},success=r.success;if(success)round++;return `Użycie specjala${success===undefined?'':success?' — runda wygrana':' — bez wygrania rundy'}${r.params?` · wzmocnione: ${esc(r.params.map(label).join(', '))}`:r.param?` · parametr: ${esc(label(r.param))}`:''}`;}
   const pay=entry.pay==='wait'?'przeczekano':entry.pay==='combo'?'kombo':label(entry.pay);
   if(entry.type==='round')return `Runda ${++round}: ${esc(pay)}`;
   const e=data.encounters[entry.encounter];
   return `${esc(e.name)}${entry.shown?` (drugi parametr: ${esc(label(entry.shown))})`:''} — zapłacono: ${esc(pay)}`;
  });
  const type=advice.stages[stage].type,title=type==='node'?`Węzeł ${advice.stages[stage].index+1}`:type==='mini'?'Mini boss':'Boss';
  return `<h3>${title}</h3><ul class="journeyPast">${lines.map(l=>`<li>${l}</li>`).join('')}</ul><button type="button" class="secondary" data-action="rewind" data-stage="${stage}">Zmień od tego miejsca</button><p class="hint">Usuwa ten krok i wszystkie kolejne.</p>`;
 }
 function nodeBar(advice){
  return `<ol class="journeyNodes" aria-label="Węzły trasy">${advice.stages.map((stage,i)=>{
   const status=advice.current===null||i<advice.current?'done':i===advice.current?'current':'future';
   const text=stage.type==='node'?stage.index+1:stage.type==='mini'?'M':'B';
   const name=stage.type==='node'?`Węzeł ${stage.index+1}`:stage.type==='mini'?'Mini boss':'Boss';
   return `<li><button type="button" class="journeyNode ${status} ${stage.type}${view===i?' viewed':''}" data-stage="${i}" aria-label="${name}, ${status==='done'?'zaliczony':status==='current'?'bieżący':'przed Tobą'}"${status==='current'?' aria-current="step"':''}${status==='future'?' disabled':''}>${text}</button></li>`;
  }).join('')}</ol>`;
 }
 function render(){
  stop();advice=null;root.hidden=false;root.setAttribute('aria-busy','true');
  if(!root.innerHTML)root.innerHTML='<div class="journeyRunActions"><button type="button" class="primary" data-action="end">Zakończ podróż</button></div>';
  for(const control of root.querySelectorAll('button,select,input'))control.disabled=!['end','undo'].includes(control.dataset.action)||control.dataset.action==='undo'&&!run.log.length;
  let status=root.querySelector('[data-calculation]');
  if(!status){status=document.createElement('p');status.dataset.calculation='';status.setAttribute('role','status');root.prepend(status);}
  status.textContent='Przeliczanie szans podróży…';
  const fail=message=>{stop();status.textContent=message;const retry=document.createElement('button');retry.type='button';retry.dataset.action='retry';retry.textContent='Spróbuj ponownie';status.append(' ',retry);};
  try{
   const current=new Worker(new URL('./journey-worker.js',import.meta.url),{type:'module'});worker=current;
   current.onerror=()=>{if(worker===current)fail('Nie udało się przeliczyć podróży.');};
   current.onmessage=({data:result})=>{
    if(worker!==current||!run)return;
    if(result.error){fail(result.error);return;}
    stop();advice=result.advice;
    if(!advice.valid){run.log=run.log.slice(0,advice.applied);save();}
    draw();
   };
   current.postMessage({data,run,pending});
  }catch{fail('Nie udało się uruchomić obliczeń podróży.');}
 }
 function draw(){
  const location=data.locations.find(l=>l.id===run.locationId),boss=bossName(location.boss);
  const chips=[...data.params.map(p=>[p.label,advice.stats[p.id],run.stats?.[p.id]??0]),['Krew',advice.blood,run.blood??0]].map(([name,now,was])=>`<span class="journeyStatChip${now<was?' used':''}"><b>${esc(name)}</b> ${now.toLocaleString('pl')} / ${was.toLocaleString('pl')}</span>`).join('');
  const chance=advice.phase==='done'?'<span class="journeyChance certain">Ukończona</span>':`<span class="journeyChance ${chanceTone(advice.chance)}">${chanceLabel(advice.chance)}</span>`;
  const step=view!==null&&view!==advice.current?pastStep(advice,view):advice.phase==='done'?'<h3>Podróż ukończona</h3><p class="subtle">Boss pokonany. „Zakończ podróż” wraca do tabeli.</p>':advice.phase==='node'?nodeStep(advice):advice.phase==='miniPick'?miniStep(advice):fightStep(advice);
  root.hidden=false;
  root.innerHTML=`<div class="journeyRunHead"><div><p class="eyebrow">PODRÓŻ W TOKU · AKT ${ACTS[location.act]??location.act} · POZIOM ${run.level}</p><h2>${esc(location.name)}</h2><p class="subtle">Boss: ${esc(boss)} · trasa: ${esc(routeText(routeLayout(data,run.level)))} · koszt potwora ${advice.costs.monster.toLocaleString('pl')}, bossa ${advice.costs.boss.toLocaleString('pl')}</p></div><div class="journeyRunActions"><button type="button" class="secondary" data-action="undo"${run.log.length?'':' disabled'}>Cofnij krok</button><button type="button" class="primary" data-action="end">Zakończ podróż</button></div></div>
<div class="journeyRunBody"><p class="journeyRunChance">Szansa na ukończenie: ${chance}</p><div class="journeyStatChips">${chips}</div>${nodeBar(advice)}<div class="journeyStep">${step}</div></div>`;
  if(focus){root.querySelector(focus)?.focus();focus=null;}
 }

 root.addEventListener('change',e=>{
  if(!advice||worker)return;
  const pick=e.target.closest('[data-pick]')?.dataset.pick;
  if(pick==='encounter'){const v=e.target.value;pending=v===''?{}:{encounter:Number(v)};focus='[data-pick="shown"],.journeyOption.recommended';}
  else if(pick==='shown'){pending={...pending,shown:e.target.value||undefined};focus='.journeyOption.recommended';}
  else if(pick==='offer'){pending={...pending,offer:e.target.value||undefined,specialCost:undefined};}
  else if(e.target.matches('[data-special-cost]')){pending.specialCost=e.target.value===''?undefined:Number(e.target.value);return;}
  else return;
  render();
 });
 root.addEventListener('click',e=>{
  const button=e.target.closest('button');
  if(!button||button.disabled)return;
  const {action,pay,mini,stage}=button.dataset;
  if(action==='end')return end();
  if(action==='retry')return render();
  if(action==='undo'){run.log=run.log.slice(0,-1);pending={};view=null;save();return render();}
  if(!advice||worker)return;
  if(action==='offer'){
   const costField=root.querySelector('[data-special-cost]');
   if(costField&&(!costField.checkValidity()||costField.value==='')){costField.reportValidity();return;}
   const shown=pending.shown??advice.shown;
   run.log=[...run.log,{type:'offer',special:pending.offer==='none'?null:pending.offer,cost:costField?Number(costField.value):undefined}];pending={shown};save();return render();
  }
  if(action==='use-special'){
   const sp=advice.special,select=root.querySelector('[data-special-result]');
   if(select&&select.value===''){select.focus();return;}
   const outcome=sp?.outcomes[select?Number(select.value):0];if(!outcome)return;
   return commit({type:'special',shown:pending.shown??advice.shown,result:outcome.result});
  }
  if(action==='rewind'){const i=advice.entryStage.indexOf(Number(stage));if(i>=0)run.log=run.log.slice(0,i);pending={};view=null;save();return render();}
  if(mini)return commit({type:'mini',boss:mini});
  if(pay){
   return commit(advice.phase==='node'?{type:'node',encounter:pending.encounter,shown:pending.shown??null,pay}:{type:'round',shown:pending.shown??advice.shown??null,pay});
  }
  if(stage!==undefined){const i=Number(stage);view=view===i?null:i;draw();}
 });
 return {start,end,active:()=>!!run};
}
