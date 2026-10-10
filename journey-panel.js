import {routeLayout,chanceLabel,chanceTone,SIMULATIONS} from './journey-sim.js';
import {parseCost} from './costs.js';
import {createJourneyRun,readSavedRun,routeText} from './journey-run.js';
import {createGearDialog} from './journey-gear.js';
import {MIN_ITEMS} from './gear-fit.js';
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const STORAGE='kuzniaJourney',ACTS={1:'I',2:'II',3:'III'};
const number=v=>v.toLocaleString('pl',{maximumFractionDigits:1});
const costList=r=>[r.monsterCost,r.miniBossCost,r.bossCost].filter(v=>v!=null).map(v=>v.toLocaleString('pl')).join(' / ');

function readSaved(){
 const out={values:{},level:null,waitTimed:true,hardest:false};
 try{
  const saved=JSON.parse(localStorage.getItem(STORAGE)||'{}');
  for(const [key,value]of Object.entries(saved.values??{}))if(/^[a-z]+$/.test(key)&&Number.isSafeInteger(value)&&value>=0)out.values[key]=value;
  if(Number.isSafeInteger(saved.level))out.level=saved.level;
  if(typeof saved.waitTimed==='boolean')out.waitTimed=saved.waitTimed;
  if(typeof saved.hardest==='boolean')out.hardest=saved.hardest;
 }catch{}
 return out;
}

// Journey view: loads its own data on first open and recalculates while the form is edited.
// `gear` gives the shared inventory and catalog to "Dopasuj sprzęt".
export function createJourneyPanel(gear){
 let data=null,loading=null,timer=0,live=null,gearDialog=null,worker=null;
 async function open(){
  syncGear();
  if(data)return;
  // Revalidate every time: the data file is edited by hand and a stale copy would silently win.
  loading??=fetch('./journey-data.json',{cache:'no-cache'}).then(r=>{if(!r.ok)throw new Error('Nie udało się wczytać danych podróży.');return r.json();});
  try{data=await loading;}catch(error){loading=null;$('journeyStatus').textContent=error.message||'Nie udało się wczytać danych podróży.';return;}
  build(readSaved());
  gearDialog=createGearDialog({...gear,data,onApply:applyGear,getSettings:()=>{const form=read();return {waitTimed:form.waitTimed,blood:form.values.blood??0};}});
  $('journeyGear').addEventListener('click',()=>{if(!$('journeyGear').disabled)gearDialog.open();});
  $('journeyGearEdit').addEventListener('click',gear.editInventory);
  syncGear();
  live=createJourneyRun({data,root:$('journeyRun'),onEnd:()=>{setRunMode(false);calculate();}});
  const saved=readSavedRun(data);
  if(saved){setRunMode(true);live.start(saved);}else calculate();
 }
 // During a journey the form is locked and the table gives way to the route.
 function setRunMode(on){
  for(const fieldset of $('journeyForm').querySelectorAll('fieldset'))fieldset.disabled=on;
  $('journeyForm').classList.toggle('isLocked',on);
  document.querySelector('#journeyView .journeyScroll').hidden=on;
  $('journeyStatus').hidden=on;
  if(!on)$('journeyRun').hidden=true;
 }
 function startRun(locationId,level){
  const form=read();
  if(form.invalid)return;
  const {blood=0,...stats}=form.values;
  setRunMode(true);
  live.start({locationId,level,waitTimed:form.waitTimed,stats,blood,log:[]});
  $('journeyRun').scrollIntoView({block:'start'});
 }
 function build(saved){
  const fields=[...data.params.map(p=>[p.id,p.label,'']),['blood','Punkty krwi',`${data.costs.blood} krwi = 1 punkt parametru`]];
  $('journeyStats').innerHTML=fields.map(([id,label,hint])=>`<label for="journey-${id}">${esc(label)}<input id="journey-${id}" data-key="${id}" type="number" min="0" step="1" inputmode="numeric" placeholder="0" value="${saved.values[id]??''}"${hint?` aria-describedby="journey-${id}-hint"`:''}>${hint?`<span id="journey-${id}-hint" class="hint">${esc(hint)}</span>`:''}</label>`).join('');
  const {min,max}=data.costs.levels,slider=$('journeyLevel');
  slider.min=min;slider.max=max;slider.value=saved.level>=min&&saved.level<=max?saved.level:min;
  $('journeyHardestHint').textContent=`Dla każdej lokacji szuka najwyższego poziomu ze 100% szans, od ${max} w dół. Blokuje suwak.`;
  $('journeyHardest').checked=saved.hardest;
  $('journeyWait').checked=saved.waitTimed;
  syncLevel();
  const miniLevel=Array.from({length:max-min+1},(_,i)=>min+i).find(l=>routeLayout(data,l).miniAfter!=null);
  const pct=v=>`${Math.round(v*100)}%`;
  $('journeyNotes').innerHTML=[
   `Każda z ${SIMULATIONS} tras ma własne wylosowane spotkania; te same trasy służą wszystkim lokacjom i poziomom. Walki z bossami są liczone dokładnie dla każdego losowego parametru rundy.`,
   `Planer płaci tym parametrem, który zostawia największą szansę na pokonanie bossa. Krew zastępuje cały koszt (${data.costs.blood} krwi = 1 punkt), nie uzupełnia brakującej części.`,
   `Mini boss kosztuje +${pct(data.costs.type.miniboss-1)} kosztu parametru, boss +${pct(data.costs.type.boss-1)}${Object.entries(data.costs.acts).filter(([,a])=>a.boss!=null).map(([act,a])=>` (Akt ${ACTS[act]??act}: +${pct(a.boss-1)})`).join('')}, a na poziomach z mini bossem co najmniej +${pct(data.costs.type.bossAfterMini-1)}. Kombo w 3. rundzie to ${pct(data.costs.combo)} stawki tej walki za każdy z dwóch parametrów.`,
   `Układ trasy zależy tylko od poziomu.${miniLevel?` Od poziomu ${miniLevel} po ${routeLayout(data,miniLevel).miniAfter}. węźle pojawia się mini boss: boss jednej z pozostałych lokacji.`:''}`,
   'Ataki specjalne bossów nie są uwzględnione — ich koszt nie jest znany, więc realna szansa może być wyższa.',
   'Przeciwnicy na trasie są losowani z jednakowym prawdopodobieństwem.',
   'Szansa dotyczy jednego zapasu parametrów, bez odpoczynku i regeneracji następnego dnia.'
  ].map(t=>`<li>${esc(t)}</li>`).join('');
  $('journeyForm').addEventListener('input',e=>{if(e.target===slider||e.target===$('journeyHardest'))syncLevel();schedule();});
  $('journeyForm').addEventListener('change',schedule);
  $('journeyForm').addEventListener('submit',e=>{e.preventDefault();clearTimeout(timer);calculate();});
  $('journeyTable').addEventListener('click',e=>{const b=e.target.closest('[data-start]');if(b&&!b.disabled)startRun(b.dataset.start,Number(b.dataset.level));});
 }
 // The slider is locked while the hardest certain level is searched for every location.
 function syncLevel(){
  const slider=$('journeyLevel'),locked=$('journeyHardest').checked;
  slider.disabled=locked;slider.closest('label').classList.toggle('isLocked',locked);
  $('journeyLevelValue').textContent=slider.value;
  $('journeyLevelHint').textContent=`Trasa: ${routeText(routeLayout(data,Number(slider.value)))}`;
  slider.setAttribute('aria-valuetext',`Poziom ${slider.value}${locked?', zablokowany':''}`);
 }
 function cancelCalculation(){
  clearTimeout(timer);worker?.terminate();worker=null;
  $('journeyTable').removeAttribute('aria-busy');
 }
 function schedule(){
  cancelCalculation();
  $('journeyTable').innerHTML='';
  $('journeyStatus').textContent='Przeliczanie szans podróży…';
  timer=setTimeout(calculate,250);
 }
 // Matching starts once the inventory could fill all 8 slots.
 function syncGear(){
  const n=gear.getInventory().length,ok=n>=MIN_ITEMS;
  $('journeyGear').disabled=!ok||!gearDialog;
  $('journeyGearHint').textContent=ok?`Najlepszy zestaw z ${n} przedmiotów ekwipunku dla każdej lokacji. Wynik możesz wpisać w parametry.`:`Potrzeba co najmniej ${MIN_ITEMS} przedmiotów w ekwipunku — masz ${n}.`;
 }
 function applyGear(values){
  for(const [id,value]of Object.entries(values)){const input=$(`journey-${id}`);if(input){input.value=Math.max(0,value);input.setAttribute('aria-invalid','false');}}
  clearTimeout(timer);calculate();
 }
 function read(){
  let invalid=false;
  const values={};
  for(const input of $('journeyStats').querySelectorAll('input')){
   const value=parseCost(input.value),bad=Number.isNaN(value);
   input.setAttribute('aria-invalid',String(bad));invalid||=bad;
   if(!bad)values[input.dataset.key]=value??0;
  }
  return {invalid,values,level:Number($('journeyLevel').value),waitTimed:$('journeyWait').checked,hardest:$('journeyHardest').checked};
 }
 function calculate(){
  cancelCalculation();
  if(live?.active())return;
  $('journeyTable').innerHTML='';
  const form=read();
  if(form.invalid){$('journeyStatus').textContent='Popraw pola: wpisz całe liczby od 0.';return;}
  try{localStorage.setItem(STORAGE,JSON.stringify({values:form.values,level:form.level,waitTimed:form.waitTimed,hardest:form.hardest}));}catch{}
  const {blood=0,...stats}=form.values,input={stats,blood,level:form.level,waitTimed:form.waitTimed};
  $('journeyTable').setAttribute('aria-busy','true');
  $('journeyStatus').textContent='Przeliczanie szans podróży…';
  try{
   const current=new Worker(new URL('./journey-worker.js',import.meta.url),{type:'module'});
   worker=current;
   const fail=message=>{
    if(worker!==current)return;
    cancelCalculation();$('journeyStatus').textContent=message;
   };
   current.onerror=()=>fail('Nie udało się przeliczyć podróży. Zmień ustawienia, aby spróbować ponownie.');
   current.onmessage=({data:result})=>{
    if(worker!==current)return;
    if(result.error){fail(result.error);return;}
    cancelCalculation();
    if(form.hardest){
     renderHardest(result.rows);
     $('journeyStatus').textContent=`Najtrudniejszy poziom ze 100% · ${SIMULATIONS} tras na każdym poziomie · sprawdzane od poziomu ${data.costs.levels.max} w dół.`;
    }else{
     render(result.rows);
     $('journeyStatus').textContent=`Średnia z ${SIMULATIONS} tras · poziom ${form.level} · ${routeText(routeLayout(data,form.level))}.`;
    }
   };
   current.postMessage({data,input,hardest:form.hardest});
  }catch(error){cancelCalculation();$('journeyStatus').textContent=error.message;}
 }
 // Location and the key result come first so both fit on a phone without scrolling the table.
 function table(columns,rows,row){
  const acts=[...new Set(rows.map(r=>r.act))].sort((a,b)=>a-b);
  $('journeyTable').innerHTML=`<thead><tr>${columns.map(c=>`<th scope="col">${c}</th>`).join('')}</tr></thead>`+acts.map(act=>`<tbody><tr class="journeyAct"><th colspan="${columns.length}" scope="colgroup">Akt ${ACTS[act]??act}</th></tr>${rows.filter(r=>r.act===act).map(row).join('')}</tbody>`).join('');
 }
 const place=r=>`<th scope="row">${esc(r.name)}<span class="journeyBoss">${esc(r.boss)}</span></th>`;
 const go=(r,level)=>`<td><button type="button" class="secondary journeyGo" data-start="${esc(r.locationId)}" data-level="${level??''}"${level?'':' disabled title="Brak poziomu ze 100% szans"'} aria-label="Wyrusz w podróż: ${esc(r.name)}${level?`, poziom ${level}`:''}">Wyrusz w podróż</button></td>`;
 function render(rows){
  const mini=rows.some(r=>r.miniBossPresent);
  table(['Lokacja i boss','Ukończenie','Węzły trasy','Mini boss','Boss',`Koszt: potwór${mini?' / mini':''} / boss`,'<span class="srOnly">Podróż</span>'],rows,r=>`<tr>${place(r)}<td><span class="journeyChance ${chanceTone(r.completion)}">${chanceLabel(r.completion)}</span></td><td class="journeyNum">${number(r.avgNodes)} / ${r.routeLength}</td><td class="journeyNum">${r.miniBossPresent?chanceLabel(r.miniBossKillChance):'—'}</td><td class="journeyNum">${chanceLabel(r.bossKillChance)}</td><td class="journeyNum">${costList(r)}</td>${go(r,r.level)}</tr>`);
 }
 function renderHardest(rows){
  table(['Lokacja i boss','Najtrudniejszy na 100%','Kolejny poziom','Koszt na tym poziomie','<span class="srOnly">Podróż</span>'],rows,r=>{
   const level=r.level?`<span class="journeyChance certain">Poziom ${r.level}</span>`:'<span class="journeyChance unlikely">Brak</span>';
   const next=r.next?`Poziom ${r.next.level}: <span class="journeyTone ${chanceTone(r.next.completion)}">${chanceLabel(r.next.completion)}</span>`:'<span class="subtle">Najwyższy poziom</span>';
   return `<tr>${place(r)}<td>${level}</td><td class="journeyNum">${next}</td><td class="journeyNum">${r.level?costList(r):'—'}</td>${go(r,r.level)}</tr>`;
  });
 }
 return {open,inventoryChanged(){syncGear();gearDialog?.inventoryChanged();}};
}
