import {MAX_EASE,gearCandidates,searchItem,parseCharacterText} from './gear-fit.js';
import {chanceLabel,chanceTone,SIMULATIONS} from './journey-sim.js';
import {fullItemName} from './item-details.js';
import {parseCost} from './costs.js';
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const STORAGE='kuzniaJourneyGear',ACTS={1:'I',2:'II',3:'III'},TIME_PER_LOCATION=1200;
const signed=v=>(v>0?'+':'')+v.toLocaleString('pl');
const count=(n,one,few,many)=>`${n} ${n===1?one:n%10>=2&&n%10<=4&&(n%100<12||n%100>14)?few:many}`;

function readSaved(params){
 const out={level:null,ease:null,stats:{},upgrade:false};
 try{
  const saved=JSON.parse(localStorage.getItem(STORAGE)||'{}');
  if(Number.isSafeInteger(saved.level)&&saved.level>0)out.level=saved.level;
  if(Number.isSafeInteger(saved.ease)&&saved.ease>=0&&saved.ease<=MAX_EASE)out.ease=saved.ease;
  for(const id of params)if(Number.isSafeInteger(saved.stats?.[id])&&saved.stats[id]>=0)out.stats[id]=saved.stats[id];
  out.upgrade=saved.upgrade===true;
 }catch{}
 return out;
}

// "Dopasuj sprzęt": per location, the set from the shared inventory that clears the hardest journey level;
// OK writes its stats into the planner. The simulation runs in the worker, one location at a time.
export function createGearDialog({data,getInventory,getDetails,getSettings,canUse,itemMarkup,closePopover,onApply}){
 const params=data.params.map(p=>p.id),label=Object.fromEntries(data.params.map(p=>[p.id,p.label]));
 const dialog=$('gearDialog'),popover=$('itemInfo'),home=popover.parentNode;
 let found=null,picked=null,worker=null;
 const saved=readSaved(params);
 const field=(id,text,value,hint='',attrs='')=>`<label for="gear-${id}">${esc(text)}<input id="gear-${id}" data-key="${id}" type="number" min="0" step="1" inputmode="numeric" placeholder="0" value="${value??''}"${hint?` aria-describedby="gear-${id}-hint"`:''}${attrs}>${hint?`<span id="gear-${id}-hint" class="hint">${esc(hint)}</span>`:''}</label>`;
 $('gearCharacter').innerHTML=field('level','Poziom postaci',saved.level,'',' min="1"')+field('ease','Łatwość (%)',saved.ease,`Puste pole = 0%. Twoja, bez przedmiotów; razem z przedmiotami najwyżej ${MAX_EASE}%.`,` max="${MAX_EASE}"`);
 $('gearTraining').innerHTML=data.params.map(p=>field(p.id,p.label,saved.stats[p.id])).join('');
 $('gearUpgrade').checked=saved.upgrade;

 function read(){
  let error='';const values={};
  for(const input of dialog.querySelectorAll('[data-key]')){
   const key=input.dataset.key,value=parseCost(input.value);
   const bad=Number.isNaN(value)||key==='level'&&!(value>=1)||key==='ease'&&value>MAX_EASE;
   input.setAttribute('aria-invalid',String(bad));
   if(bad&&!error)error=key==='level'?'Wpisz poziom postaci (co najmniej 1).':key==='ease'?`Łatwość może wynosić najwyżej ${MAX_EASE}%.`:'Parametry wpisz jako całe liczby od 0.';
   values[key]=value??0;
  }
  return {error,level:values.level,ease:values.ease,stats:Object.fromEntries(params.map(id=>[id,values[id]])),upgrade:$('gearUpgrade').checked};
 }
 function stop(){worker?.terminate();worker=null;$('gearSearch').disabled=false;}
 // Any change makes the shown sets stale; OK must not apply them.
 function invalidate(){
  if(!found)return;
  stop();found=null;picked=null;closePopover();
  $('gearResults').innerHTML='';$('gearApply').disabled=true;
  $('gearStatus').textContent='Dane się zmieniły. Kliknij „Szukaj zestawów”.';
 }
 // The button means the user accepts the reading, so the paste panel closes; a plain paste only previews it.
 function importText(confirm=false){
  const text=$('gearPasteText').value;
  if(!text.trim()){$('gearPasteFeedback').textContent='Wklej najpierw tekst z gry.';return;}
  const parsed=parseCharacterText(text,params),set=(key,value)=>{const input=$(`gear-${key}`);input.value=value;input.setAttribute('aria-invalid','false');};
  if(parsed.level!==null)set('level',parsed.level);
  // Pasted text without łatwość means none: the field is cleared, which counts as 0%.
  set('ease',parsed.ease===null?'':Math.min(parsed.ease,MAX_EASE));
  for(const [id,value]of Object.entries(parsed.stats))set(id,value);
  const missing=params.filter(id=>!(id in parsed.stats));
  const got=[parsed.level!==null?'poziom':null,parsed.ease!==null?'łatwość':null,`${params.length-missing.length} z ${params.length} parametrów`].filter(Boolean);
  const nothing=params.length===missing.length&&parsed.level===null&&parsed.ease===null;
  $('gearPasteFeedback').textContent=nothing?'Nie rozpoznano żadnej wartości. Wklej tekst z widoku statystyk postaci albo wpisz je ręcznie.':`Rozpoznano: ${got.join(', ')}.${parsed.ease===null?' Brak łatwości w tekście — liczymy 0%.':''}${missing.length?` Brak: ${missing.map(id=>label[id]).join(', ')} — uzupełnij ręcznie.`:''} Sprawdź wartości poniżej.`;
  if(confirm&&!nothing)$('gearPasteText').closest('details').open=false;
  invalidate();
 }

 function search(){
  const form=read();
  if(form.error){$('gearStatus').textContent=form.error;return;}
  try{localStorage.setItem(STORAGE,JSON.stringify({level:form.level,ease:form.ease,stats:form.stats,upgrade:form.upgrade}));}catch{}
  const inventory=getInventory(),details=getDetails();
  if([...new Set(inventory.map(i=>i.category))].some(c=>!details?.components?.[c])){$('gearStatus').textContent='Dane przedmiotów R21 jeszcze się wczytują. Spróbuj za chwilę.';return;}
  stop();
  const {items,skipped}=gearCandidates(inventory,details,{params,upgrade:form.upgrade,canUse});
  const settings={...getSettings(),timeMs:TIME_PER_LOCATION},character={level:form.level,stats:params.map(id=>form.stats[id]),ease:form.ease};
  try{worker=new Worker(new URL('./worker.js',import.meta.url),{type:'module'});}catch{$('gearStatus').textContent='Nie udało się uruchomić obliczeń. Odśwież stronę.';return;}
  found={form,items,settings,inventory,skipped,results:new Map(),started:performance.now()};picked=null;
  $('gearApply').disabled=true;$('gearSearch').disabled=true;
  $('gearResults').innerHTML=`<fieldset class="gearLocations"><legend>Zestaw dla lokacji · najtrudniejszy poziom na 100%</legend>${[...new Set(data.locations.map(l=>l.act))].sort((a,b)=>a-b).map(act=>`<p class="gearAct">Akt ${ACTS[act]??act}</p>${data.locations.filter(l=>l.act===act).map(row).join('')}`).join('')}</fieldset><section id="gearDetail" class="gearDetail" aria-live="polite"></section><div id="gearSkipped"></div>`;
  $('gearStatus').textContent=`Liczę szanse: 0/${data.locations.length} lokacji…`;
  $('gearStatus').scrollIntoView({block:'start'});
  const run=found;
  worker.onmessage=({data:message})=>{
   if(found!==run)return;
   if(message.type==='gearProgress'){
    run.results.set(message.result.locationId,message.result);
    $(`gear-row-${message.result.locationId}`).outerHTML=row(data.locations.find(l=>l.id===message.result.locationId));
    if(!picked){picked=message.result.locationId;$(`gear-pick-${picked}`).checked=true;renderDetail();}
    $('gearStatus').textContent=`Liczę szanse: ${message.done}/${message.total} lokacji…`;
   }else if(message.type==='gearDone'){
    stop();
    const gone=new Map(message.dropped);
    // A physical item is out only when none of its variants can be worn.
    const unreachable=[...new Set(items.map(i=>i.src))].map(src=>items.filter(i=>i.src===src)).filter(v=>v.every(i=>gone.has(i.id))).map(v=>({source:v[0].source,reason:shortfallText(gone.get(v[0].id))}));
    const out=[...skipped,...unreachable].sort((a,b)=>a.source.id-b.source.id),usable=new Set(items.filter(i=>!gone.has(i.id)).map(i=>i.src)).size;
    $('gearSkipped').innerHTML=out.length?`<details class="gearSkipped"><summary>Nie do założenia: ${count(out.length,'przedmiot','przedmioty','przedmiotów')}</summary><ul>${out.map(s=>`<li><b>#${String(s.source.id+1).padStart(2,'0')}</b> ${itemMarkup(s.source,s.source.original)} — ${esc(s.reason)}</li>`).join('')}</ul></details>`:'';
    $('gearStatus').textContent=`Gotowe w ${((performance.now()-run.started)/1000).toLocaleString('pl',{maximumFractionDigits:1})} s · ${usable} z ${inventory.length} przedmiotów da się założyć.${[...run.results.values()].some(r=>!r.complete)?' Przy części lokacji limit czasu przerwał poprawianie zestawu.':''}`;
   }else if(message.type==='error'){stop();$('gearStatus').textContent=message.message||'Obliczenia się nie powiodły.';}
  };
  worker.onerror=()=>{if(found===run){stop();$('gearStatus').textContent='Obliczenia się nie powiodły. Odśwież stronę.';}};
  worker.postMessage({mode:'gear',journey:data,items:items.map(searchItem),character,settings});
 }
 function shortfallText(s){
  if(!s)return 'Wymagania poza zasięgiem.';
  if(s.stat==='level')return `Wymaga poziomu ${s.need} (po łatwości), masz ${s.have}.`;
  return `Wymaga: ${label[params[s.stat]]} ${s.need} (po łatwości), a nawet z pomocą reszty ekwipunku masz najwyżej ${s.have}.`;
 }
 // Hardest level at 100% first, then the chance one level higher (or at level 1 when no level is certain).
 const verdict=r=>r.level!=null?`<span class="journeyChance certain">Poziom ${r.level}</span>`:`<span class="journeyChance ${chanceTone(r.chance)}">${chanceLabel(r.chance)}</span>`;
 const next=r=>r.level==null?`na poziomie ${r.goal}, żaden na 100%`:r.goal?`poziom ${r.goal}: <b class="journeyTone ${chanceTone(r.chance)}">${chanceLabel(r.chance)}</b>`:'najwyższy poziom';
 function row(location){
  const r=found.results.get(location.id),boss=data.bosses.find(b=>b.id===location.boss);
  const stats=bossStats(location).map(id=>label[id]).join(', ');
  return `<label class="gearLocation${r?'':' isPending'}" id="gear-row-${esc(location.id)}"><input type="radio" name="gearPick" id="gear-pick-${esc(location.id)}" value="${esc(location.id)}"${r?'':' disabled'}${location.id===picked?' checked':''}><span class="gearLocName"><b>${esc(location.name)}</b><small>${esc(boss?.name??'')} · ${esc(stats)}</small></span><span class="gearLocSum">${r?`${verdict(r)}<small>${next(r)}</small>`:'<small>liczę…</small>'}</span></label>`;
 }
 const bossStats=location=>{const ids=new Set();for(const r of data.bosses.find(b=>b.id===location.boss)?.rounds??[])for(const id of [r.fixed,r.single,...(r.random??[]),...(r.combo??[])])if(id)ids.add(id);return params.filter(id=>ids.has(id));};
 function slots(chosen){
  const of=slot=>chosen.filter(it=>it.slot===slot),hands=of('hands'),rings=of('rings');
  return [...(hands.some(it=>it.hands===2)?[['Obie ręce',hands[0]]]:[['Ręka 1',hands[0]],['Ręka 2',hands[1]]]),['Głowa',of('head')[0]],['Klata',of('chest')[0]],['Spodnie',of('legs')[0]],['Amulet',of('neck')[0]],['Pierścień 1',rings[0]],['Pierścień 2',rings[1]]];
 }
 function renderDetail(){
  const r=found?.results.get(picked);
  $('gearApply').disabled=!r;
  if(!r)return;
  const {form,items,settings}=found,location=data.locations.find(l=>l.id===r.locationId),chosen=r.items.map(id=>items[id]),target=new Set(r.target);
  const gains=it=>[...params.map((id,k)=>[k,it.bonus[k]]).filter(([,v])=>v).sort(([a],[b])=>target.has(b)-target.has(a)).map(([k,v])=>`<span class="${target.has(k)?'gearGain':'gearGain other'}">${esc(label[params[k]])} ${signed(v)}</span>`),...(it.ease?[`<span class="gearGain other">Łatwość ${signed(it.ease)}%</span>`]:[])].join('')||'<span class="subtle">bez parametrów</span>';
  const slotRow=([slot,it])=>`<li><span class="gearSlotName">${slot}</span>${it?`<span class="gearSlotItem"><b>#${String(it.source.id+1).padStart(2,'0')}</b> ${itemMarkup(it.item,fullItemName(it.item))}${it.up?` <span class="gearUpgrade">podbij z (+${it.item.upgradedFrom%6}) do (+5)</span>`:''}</span><span class="gearGains">${gains(it)}</span>`:'<span class="gearSlotItem subtle">puste</span>'}</li>`;
  const training=params.map(id=>form.stats[id]),sum=list=>list.reduce((s,k)=>s+training[k],0),bossSum=sum(r.target),upgrades=chosen.filter(it=>it.up).length;
  const headline=r.level!=null?`100% do poziomu ${r.level}${r.goal?` · poziom ${r.goal}: ${chanceLabel(r.chance)}`:''}`:`Poziom ${r.goal}: ${chanceLabel(r.chance)}`;
  $('gearDetail').innerHTML=`<h3>${esc(location.name)} · ${esc(headline)}</h3><p class="subtle gearDetailMeta">${count(chosen.length,'przedmiot','przedmioty','przedmiotów')}${upgrades?` · do podbicia: ${upgrades}`:''}</p><ol class="gearSlots">${slots(chosen).map(slotRow).join('')}</ol>
<div class="tableScroll gearTableScroll"><table class="gearTable"><thead><tr><th scope="col">Parametr</th><th scope="col">Trening</th><th scope="col">Sprzęt</th><th scope="col">Razem</th></tr></thead><tbody>${params.map((id,k)=>`<tr${target.has(k)?' class="isTarget"':''}><th scope="row">${esc(label[id])}${target.has(k)?' <span class="gearBossMark" title="Parametr bossa">boss</span>':''}</th><td>${training[k].toLocaleString('pl')}</td><td>${r.bonus[k]?signed(r.bonus[k]):'—'}</td><td><b>${(training[k]+r.bonus[k]).toLocaleString('pl')}</b></td></tr>`).join('')}</tbody><tfoot><tr><th scope="row">Suma parametrów bossa</th><td>${bossSum.toLocaleString('pl')}</td><td>${signed(r.score)}</td><td><b>${(bossSum+r.score).toLocaleString('pl')}</b></td></tr></tfoot></table></div>
<p class="hint">Szanse z tej samej symulacji co tabela: ${SIMULATIONS} tras, punkty krwi ${settings.blood.toLocaleString('pl')}, przeszkody czasowe ${settings.waitTimed?'przeczekane':'opłacane'}. Po OK zaznacz „Zalicz najtrudniejszą”, aby zobaczyć ten poziom w tabeli. Złoty znacznik: parametr bossa.${r.complete?'':' Limit czasu przerwał poprawianie zestawu: szansa jest dokładna dla tego zestawu, ale może istnieć lepszy.'}</p>`;
 }
 function apply(){
  const r=found?.results.get(picked);if(!r)return;
  onApply(Object.fromEntries(params.map((id,k)=>[id,found.form.stats[id]+r.bonus[k]])));
  dialog.close();
 }

 $('gearForm').addEventListener('submit',e=>{e.preventDefault();closePopover();search();});
 $('gearForm').addEventListener('input',e=>{if(e.target.closest('#gearCharacter,#gearTraining')||e.target===$('gearUpgrade'))invalidate();});
 $('gearForm').addEventListener('change',e=>{if(e.target.name==='gearPick'){picked=e.target.value;closePopover();renderDetail();}else if(e.target===$('gearUpgrade'))invalidate();});
 $('gearPasteRead').addEventListener('click',()=>importText(true));
 $('gearPasteText').addEventListener('paste',()=>setTimeout(importText));
 $('gearApply').addEventListener('click',apply);
 $('gearClose').addEventListener('click',()=>dialog.close());
 // The item popover is not in the top layer; it lives inside the modal while it is open.
 dialog.addEventListener('close',()=>{closePopover();home.append(popover);if(worker){stop();found=null;picked=null;$('gearResults').innerHTML='';$('gearApply').disabled=true;}});
 function open(){
  dialog.append(popover);
  // Sets were simulated with the blood and obstacle settings of that moment.
  const settings=getSettings();
  if(found&&(found.settings.blood!==settings.blood||found.settings.waitTimed!==settings.waitTimed)){found=null;picked=null;$('gearResults').innerHTML='';$('gearApply').disabled=true;}
  if(!found)$('gearStatus').textContent=`Ekwipunek: ${getInventory().length} szt. Uzupełnij postać i kliknij „Szukaj zestawów”. Szukanie trwa kilka sekund.`;
  dialog.showModal();
 }
 // A new inventory makes old sets meaningless.
 function inventoryChanged(){stop();found=null;picked=null;$('gearResults').innerHTML='';$('gearApply').disabled=true;}
 return {open,inventoryChanged};
}
