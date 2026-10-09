import {estimateTiers} from './tier-estimate.js';
import {parseInventory,itemName,label,normalize,variants,recipeSteps,ingredients,resultKey,requiresUpgrade,fusionInput,analysisScope} from './engine.js';
import {costKey,parseCost,totalCosts} from './costs.js';
import {fusionCost,fullItemName} from './item-details.js';
import {createItemPopover} from './item-popover.js';
import {importInventory} from './inventory-import.js';
import {createInventoryPanel} from './inventory-panel.js';
import {isStrongCombo,assessAffixes} from './strong-combos.js';
import {assessProfileAffixes,tattoos,races,possibleForSex,requiredSex} from './profile-affixes.js';
import {sortResults} from './result-sort.js';
import {createGoalTarget} from './missing-planner.js';
import {missingItemList,missingPlanListText,missingAffixList} from './missing-list.js';
import {createJourneyPanel} from './journey-panel.js';
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const axisLabels={base:'Baza',prefix:'Prefiks',suffix:'Sufiks'};
let data,inventory=[],inventoryText='',results=[],lastRun=null,worker,selected,selectedRecipeIndex=0,visibleLimit=50,running=false,runCounter=0,activeReject=null;
let loadingTimer,deadlineTimer;
let depthTimer,completedRun=null,newKeys=new Set();
let resultOrder='fewest';
let tierVisibleLimit=50,craftingDirty=false;
const simulationHistory=[];
const enteredCosts=new Map();
let renderedRecipeKey=null;
let goalWorker=null,goalRun=0,goalDeadlineTimer=null,goalLoadingTimer=null,goalResultState=null,goalMatchedPlans=[],goalVisibleLimit=100;
let goalMissingListMode='items';
let itemDetails=null,itemCatalog=null;
const profile=()=>({race:$('profileRace').value,tattoo:$('profileTattoo').value,sex:$('profileSex').value});
const profileActive=()=>!!(profile().tattoo||profile().race);
const profileMatch=n=>assessProfileAffixes(n,profile(),itemDetails,itemCatalog,inventory);
const itemPopover=createItemPopover(()=>itemDetails,()=>itemCatalog,profile,()=>inventory);
const strongBadge=n=>{
 const {pair,prefix,suffix}=assessAffixes(n,itemDetails,{},inventory);
 const match=profileActive()?profileMatch(n):null;
 const badge=(kind,text,reason)=>`<span class="strongBadge ${kind}" title="${esc(reason)}">${text}</span>`;
 const tattooBadge=match?.rank?badge('tattooBadge',`${profile().tattoo?'TATUAŻ':'RASA'}: ${match.pair?'PARA':match.prefix.length&&match.suffix.length?'OBA AFIKSY':match.prefix.length?'PREFIKS':'SUFIKS'}`,`Ocena statystyk dla ${profile().tattoo?tattoos[profile().tattoo].label:races[profile().race].label}; sprawdź cały zestaw.`):'';
 const general=pair?badge('pairBadge','DOBRA PARA',pair.reason):(prefix.length?badge('prefixBadge','DOBRY PREFIKS',`${label(n.prefix)}: ${prefix[0].reason}`):'')+(suffix.length?badge('suffixBadge','DOBRY SUFIKS',`${label(n.suffix)}: ${suffix[0].reason}`):'');
 return general+tattooBadge;
};
function highlightedName(n,text){
 const assessment=assessAffixes(n,itemDetails,{},inventory),match=profileActive()?profileMatch(n):null;
 const source=text.toLocaleLowerCase('pl'),ranges=[];
 if((assessment.prefix.length||match?.prefix.length)&&n.prefix){
  for(const form of variants(n.prefix)){
   const candidate=label(form).toLocaleLowerCase('pl'),at=source.indexOf(candidate);
   if(at>=0){ranges.push({start:at,end:at+candidate.length,kind:'prefix',pair:!!(assessment.pair||match?.pair),profile:!!match?.prefix.length});break;}
  }
 }
 if((assessment.suffix.length||match?.suffix.length)&&n.suffix){const candidate=label(n.suffix).toLocaleLowerCase('pl'),at=source.lastIndexOf(candidate);if(at>=0)ranges.push({start:at,end:at+candidate.length,kind:'suffix',pair:!!(assessment.pair||match?.pair),profile:!!match?.suffix.length});}
 ranges.sort((a,b)=>a.start-b.start);let last=0,html='';for(const range of ranges){if(range.start<last)continue;html+=esc(text.slice(last,range.start))+`<span class="affixHighlight ${range.kind}${range.pair?' pair':''}${range.profile?' profileMatch':''}">${esc(text.slice(range.start,range.end))}</span>`;last=range.end;}return html+esc(text.slice(last));
}
const itemMarkup=(n,text)=>itemPopover.markup(n,text,highlightedName(n,text))+strongBadge(n);
const upgradeBadge='<span class="upgradeBadge">podnieś do +1</span>';
function effectiveCosts(step){return {...(fusionCost(step,itemDetails)||{}),...enteredCosts.get(costKey(step))};}
const categoryName=id=>data.categories.find(c=>c.id===id)?.label||id;
const inventoryPanel=createInventoryPanel({
 getTables:()=>data,getText:()=>inventoryText,itemMarkup,
 canUse:item=>possibleForSex(item,profile().sex,itemDetails,itemCatalog),
 onImport:(text,options)=>loadInventory(text,options),
 onUndo:()=>{if(running||!simulationHistory.length)return;const previous=simulationHistory.pop();$('inventoryChange').textContent='Cofnięto ostatni plan. Składniki wróciły do ekwipunku.';return loadInventory(previous,{preserveHistory:true});}
});
function renderInventory(){
 if(!$('tiersPanel').hidden)renderTierEstimate();
 inventoryPanel.render(inventory,simulationHistory.length>0);
}
function filterOptions(){
 const cats=data.categories.filter(c=>$('category').value==='all'||c.id===$('category').value);
 for(const [id,axis]of [['filterBase','base'],['filterPrefix','prefix'],['filterSuffix','suffix']]){
  const previous=$(id).value;
  const values=[...new Set(cats.flatMap(c=>c.axes[axis]?.values||[]))].sort((a,b)=>label(a).localeCompare(label(b),'pl'));
  $(id).innerHTML='<option value="all">Wszystkie</option>'+(axis==='base'?'':'<option value="any">Dowolny</option><option value="none">Bez '+(axis==='prefix'?'prefiksu':'sufiksu')+'</option>')+values.map(v=>`<option value="${esc(v)}">${esc(axis==='base'?itemName({base:v}):label(v))}</option>`).join('');
  $(id).value=(previous==='none'||previous==='any')&&axis!=='base'||values.includes(previous)?previous:'all';
 }
}
function matchesCurrentFilters(n){
 const category=$('category').value;
 return (category==='all'||n.category===category)&&[['filterBase','base'],['filterPrefix','prefix'],['filterSuffix','suffix']].every(([id,key])=>{const value=$(id).value;return value==='all'||(value==='none'?!n[key]:value==='any'?Boolean(n[key]):n[key]===value);});
}
function filtered(){
 const matching=results.filter(n=>matchesCurrentFilters(n)&&possibleForSex(n,profile().sex,itemDetails,itemCatalog));
 return sortResults(matching,resultOrder,profileActive()?profile():undefined,itemDetails,itemCatalog,inventory);
}
function renderResults(){
 itemPopover.close();
 document.querySelectorAll('#resultOrder [data-order]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.order===resultOrder)));
 const list=filtered();$('resultCount').textContent=list.length.toLocaleString('pl');
 if(!list.some(n=>resultKey(n)===selected)){selected=list[0]?resultKey(list[0]):null;selectedRecipeIndex=0;}
 $('resultsList').innerHTML=list.slice(0,visibleLimit).map(n=>{const name=fullItemName(n);return `<button class="result ${resultKey(n)===selected?'selected':''} ${isStrongCombo(n,itemDetails,{},inventory)?'strongResult':''}" data-key="${esc(resultKey(n))}" aria-pressed="${resultKey(n)===selected}"><div class="resultName">${newKeys.has(resultKey(n))?'<span class="newBadge">NOWY</span> ':''}${itemPopover.inline(n,name,highlightedName(n,name))} ${strongBadge(n)}</div><div class="resultMeta"><span class="pill cost">${n.steps} ${n.steps===1?'spaw':n.steps<5?'spawy':'spawów'}</span><span>${esc(categoryName(n.category))}</span><span>·</span><span>głębokość ${n.depth}</span></div></button>`;}).join('');
 $('resultsList').querySelectorAll('.result').forEach((row,index)=>{if(ingredients(list[index]).some(requiresUpgrade))row.querySelector('.resultMeta').insertAdjacentHTML('beforeend',upgradeBadge);});
 if(!list.length&&!running){const gun=$('category').value.startsWith('gun')&&!inventory.some(i=>i.category===$('category').value);const emptyInventory=inventory.length===0;const message=emptyInventory?'Kliknij „Edytuj listę”, aby wkleić swój ekwipunek.':gun?'Do palnej potrzebujesz broni palnej tego samego rodzaju. Wklej swoje bronie lub wczytaj przykład palnej.':'Zmień filtr, listę składników lub głębokość. Niektóre wyniki wymagają kolejnego spawu.';$('resultsList').innerHTML=`<div class="empty"><strong>${emptyInventory?'Dodaj składniki':gun?'Brak składników palnej':'Brak pasujących wyników'}</strong>${message}</div>`;}
 if(!list.length&&!running&&profile().sex&&results.some(n=>matchesCurrentFilters(n)&&!possibleForSex(n,profile().sex,itemDetails,itemCatalog)))$('resultsList').innerHTML='<div class="empty"><strong>Brak wyników dla wybranej płci</strong>Przeliczone przedmioty w tym widoku są przeznaczone dla innej płci. Zmień wybór płci albo filtry.</div>';
 $('loadMore').hidden=list.length<=visibleLimit;
 $('resultsList').querySelectorAll('button[data-key]').forEach(b=>b.onclick=()=>{selected=b.dataset.key;const keepFocus=document.activeElement===b;renderResults();if(keepFocus)[...$('resultsList').querySelectorAll('button[data-key]')].find(next=>next.dataset.key===selected)?.focus({preventScroll:true});});
 const selectedResult=list.find(n=>resultKey(n)===selected);
 $('showRecipe').hidden=!selectedResult;
 renderRecipe(selectedResult?.recipes?.[selectedRecipeIndex]||selectedResult);
}
function renderRecipe(n){
 if(!n){renderedRecipeKey=null;$('recipe').innerHTML='<div class="empty">Wybierz wynik, aby zobaczyć potrzebne składniki i każdy spaw.</div>';return;}
 const leaves=ingredients(n),steps=recipeSteps(n);
 const key=costKey(n),scrollTop=key===renderedRecipeKey?$('recipe').scrollTop:0;renderedRecipeKey=key;
 const short=i=>i.left?itemName(i):i.original;
 const recipes=results.find(result=>resultKey(result)===selected)?.recipes||[n];
 $('recipe').innerHTML=`<div class="recipeTitle"><p class="eyebrow">${esc(categoryName(n.category))} / WYNIK KOŃCOWY</p><h3>${itemMarkup(n,itemName(n))}</h3>${recipes.length>1?`<label class="recipeChoice">Kombinacja składników <select id="recipeChoice">${recipes.map((recipe,index)=>`<option value="${index}" ${recipe===n?'selected':''}>${index+1}. ${ingredients(recipe).map(item=>esc(item.original)).join(' + ')}</option>`).join('')}</select></label>`:''}<div class="recipeMeta"><span>${n.steps} ${n.steps===1?'spaw':n.steps<5?'spawy':'spawów'}</span><span>${leaves.length} ${leaves.length<5?'składniki':'składników'}</span><span>głębokość ${n.depth}</span></div></div><section class="recipeCosts"><h4>KOSZT CAŁEGO PRZEPISU</h4><div id="costSummary" aria-live="polite"></div><p>Mana i nanity to suma wartości dwóch zużywanych składników z katalogu R21. Kwoty możesz skorygować według Studni. Suma nie obejmuje ulepszania ani obniżania jakości. Każdy spaw wymaga też 1 kamienia przemiany.</p></section><div class="recipeIngredients"><h4>TE SKŁADNIKI ZNIKNĄ Z LISTY</h4>${leaves.map(i=>`<div class="ingredient"><b>#${String(i.id+1).padStart(2,'0')}</b>${itemMarkup(i,i.original)}</div>`).join('')}<div class="applyPlan"><p>${leaves.length} składniki → 1 wynik. Ekwipunek: ${inventory.length} → ${inventory.length-leaves.length+1} szt. Pozostałe przedmioty zostają na liście.</p><button id="applyPlan" class="primary" type="button">Zastosuj plan do ekwipunku</button><span>Symulacja na stronie. Nie wykonuje spawów w grze.</span></div></div><div class="steps">${steps.map((s,i)=>`<div class="step"><div class="stepLabel">SPAW ${String(i+1).padStart(2,'0')}</div><div class="stepInput">${itemMarkup(s.left,short(s.left))}</div><div class="join">+</div><div class="stepInput">${itemMarkup(s.right,short(s.right))}</div><div class="stepResult">${itemMarkup(s,fullItemName(s))}</div>${renderCostFields(s,i)}<details><summary>Sprawdź trzy osie w tabeli</summary><div class="proof">${s.evidence.map(e=>`<span><b>${axisLabels[e.axis]}:</b> ${esc(label(e.a)||'brak')} + ${esc(label(e.b)||'brak')} = ${esc(label(e.result)||'brak')}<br>${e.cell?esc(e.cell):esc(e.rule)}</span>`).join('')}</div></details></div>`).join('')}</div>`;
 const recipeChoice=$('recipeChoice');if(recipeChoice)recipeChoice.onchange=()=>{selectedRecipeIndex=Number(recipeChoice.value);renderResults();};
 const upgrades=leaves.filter(requiresUpgrade);
 if(upgrades.length){
  $('recipe').querySelector('.recipeCosts p').insertAdjacentHTML('afterend',`<p class="upgradeNotice">Plan wymaga podniesienia ${upgrades.length} ${upgrades.length===1?'składnika':'składników'} z +0 do +1 przed spawaniem. Koszty spawów liczymy dla przedmiotów po podniesieniu; koszt ulepszenia nie jest wliczony.</p>`);
  $('recipe').querySelectorAll('.ingredient').forEach((row,index)=>{if(requiresUpgrade(leaves[index]))row.insertAdjacentHTML('beforeend',upgradeBadge);});
  $('recipe').querySelectorAll('.step').forEach((row,index)=>{const inputs=row.querySelectorAll('.stepInput');for(const [side,node] of [steps[index].left,steps[index].right].entries())if(requiresUpgrade(node))inputs[side].insertAdjacentHTML('beforeend',` → ${itemPopover.markup(fusionInput(node),fullItemName(fusionInput(node)))} ${upgradeBadge}`);});
 }
 $('applyPlan').onclick=()=>applyPlan(n).catch(e=>{$('inventoryChange').textContent=e.message;});
 steps.forEach((step,i)=>{for(const resource of ['mana','nanites']){
  const input=$('step-'+resource+'-'+i);
  input.value=effectiveCosts(step)[resource]??'';
  input.oninput=()=>{const k=costKey(step);enteredCosts.set(k,{...enteredCosts.get(k),[resource]:input.value});input.setAttribute('aria-invalid',String(Number.isNaN(parseCost(input.value))));renderCostSummary(steps);};
 }});
 renderCostSummary(steps);$('recipe').scrollTop=scrollTop;

}
function renderCostFields(step,index){
 const row=effectiveCosts(step);
 return `<fieldset class="stepCosts"><legend>Spaw ${index+1} · ${fusionCost(step,itemDetails)?'katalog R21, można poprawić':'uzupełnij ze Studni'}</legend>${[['mana','Mana'],['nanites','Nanity']].map(([resource,name])=>`<label for="step-${resource}-${index}">${name}<input id="step-${resource}-${index}" type="number" min="0" step="1" inputmode="numeric" placeholder="Brak kwoty" aria-label="${name}, spaw ${index+1}" aria-invalid="${Number.isNaN(parseCost(row[resource]))}" value="${esc(row[resource]??'')}"></label>`).join('')}</fieldset>`;
}
function renderCostSummary(steps){
 const totals=totalCosts(steps,new Map(steps.map(s=>[costKey(s),effectiveCosts(s)])));
 $('costSummary').innerHTML=`<div class="resourceTotals">${[['mana','Mana'],['nanites','Nanity']].map(([key,name])=>{const t=totals[key];return `<div><span>${name}</span><strong>${t.invalid?'Popraw kwoty':t.known?t.total.toLocaleString('pl'):'—'}</strong><small>${t.invalid?'Wpisz całe liczby od 0':t.complete?'Łącznie za cały przepis':`Znane koszty · ${t.known}/${steps.length} spawów`}</small></div>`;}).join('')}<div><span>Kamienie przemiany</span><strong>${steps.length}</strong><small>1 kamień na każdy spaw</small></div></div><p class="costCompletion">${totals.mana.complete&&totals.nanites.complete?'Suma obejmuje wyłącznie spawy tego przepisu. Sprawdź kwoty w Studni przed wykonaniem.':'Koszt niepełny. Puste pola oznaczają brak danych, a nie darmowy spaw.'}</p>`;
}
function goalPlanCosts(steps){
 const totals=totalCosts(steps,new Map(steps.map(step=>[costKey(step),fusionCost(step,itemDetails)])));
 const text=[['mana','Mana'],['nanites','Nanity']].map(([key,label])=>{
  const value=totals[key];
  return `${label}: ${value.complete?value.total.toLocaleString('pl'):value.known?`${value.total.toLocaleString('pl')} (koszt niepełny)`:'brak danych'}`;
 }).join(' · ');
 return `<span class="goalPlanCosts" title="Łączny koszt spawów według katalogu R21, bez ulepszania i obniżania jakości.">${text}</span>`;
}
function clearGoalResults(){itemPopover.close();goalRun++;clearTimeout(goalDeadlineTimer);clearInterval(goalLoadingTimer);goalWorker?.terminate();goalWorker=null;goalResultState=null;goalMatchedPlans=[];goalVisibleLimit=100;$('goalStop').hidden=true;$('goalSearch').disabled=!data||!$('goalCategory').value;$('goalResults').innerHTML='';}
function goalTargetName(target){return target.base?itemName(target):`Dowolna baza${target.prefix?` · prefiks: ${label(target.prefix)}`:''}${target.suffix?` · sufiks: ${label(target.suffix)}`:''}`;}
function updateGoalPreview(){
 try{$('goalPreview').textContent=`Szukany wynik: ${goalTargetName(createGoalTarget(data,$('goalCategory').value,$('goalBase').value,$('goalPrefix').value,$('goalSuffix').value))}`;}
 catch{$('goalPreview').textContent='Wybierz rodzaj i przedmiot, aby ustawić cel.';}
 clearGoalResults();
}
function updateGoalCategory(){
 const category=data.categories.find(c=>c.id===$('goalCategory').value);
 $('goalBase').innerHTML='<option value="">Dowolna baza</option>'+(category?.axes.base.values||[]).map(base=>`<option value="${esc(base)}">${esc(itemName({base}))}</option>`).join('');
 $('goalBase').disabled=!category;
 for(const [id,axis,empty] of [['goalPrefix','prefix','Bez prefiksu'],['goalSuffix','suffix','Bez sufiksu']]){
  const values=category?.axes[axis]?.values||[];
  $(id).innerHTML=`<option value="">${values.length?empty:'Brak w tej kategorii'}</option>`+values.map(value=>`<option value="${esc(value)}">${esc(label(value))}</option>`).join('');
  $(id).disabled=!values.length;
 }
 updateGoalPreview();
}
function renderGoalPlanCards(){
 if(!goalResultState)return;
 const {plans}=goalResultState,query=$('goalTextFilter').value.trim().toLocaleLowerCase('pl'),prefix=$('goalPrefixFilter').value,suffix=$('goalSuffixFilter').value;
 goalMatchedPlans=plans.filter(plan=>{const missing=ingredients(plan).filter(item=>item.missing);if(($('goalStepsFilter').value!==''&&plan.steps!==Number($('goalStepsFilter').value))||($('goalMissingFilter').value!==''&&missing.length!==Number($('goalMissingFilter').value)))return false;return missing.length?missing.some(item=>(!query||itemName(item).toLocaleLowerCase('pl').includes(query))&&(!prefix||item.prefix===prefix)&&(!suffix||item.suffix===suffix)):!query&&!prefix&&!suffix;});
 const visible=goalMatchedPlans.slice(0,goalVisibleLimit),planNumbers=new Map(plans.map((plan,index)=>[plan,index+1]));
 $('goalResultCount').textContent=`Pokazano ${visible.length.toLocaleString('pl')} z ${goalMatchedPlans.length.toLocaleString('pl')} pasujących · ${plans.length.toLocaleString('pl')} łącznie`;
 $('goalPlanList').innerHTML=goalMatchedPlans.length?visible.map((plan,index)=>{const missing=ingredients(plan).filter(i=>i.missing),owned=ingredients(plan).filter(i=>!i.missing),steps=recipeSteps(plan);return `<details ${index===0?'open':''}><summary>Zestaw #${planNumbers.get(plan)} · ${plan.steps} ${plan.steps===1?'spaw':plan.steps<5?'spawy':'spawów'} · ${missing.length?`brakuje ${missing.length}: ${missing.map(i=>itemPopover.markup(i,itemName(i))).join(', ')}`:'wszystkie składniki masz'}${goalPlanCosts(steps)}</summary><div class="goalPlanBody"><p><strong>Masz:</strong> ${owned.length?owned.map(i=>`#${i.id+1} ${itemPopover.markup(i,i.original)}${requiresUpgrade(i)?' (podnieś do +1)':''}`).join(', '):'brak pasujących składników w ekwipunku'}</p><p><strong>Potrzebujesz:</strong> ${missing.length?missing.map(i=>itemPopover.markup(i,i.original)).join(', '):'niczego'}</p><ol>${steps.map(step=>`<li>${itemPopover.markup(step.left,step.left.left?fullItemName(step.left):step.left.original)} + ${itemPopover.markup(step.right,step.right.left?fullItemName(step.right):step.right.original)} → ${itemPopover.markup(step,fullItemName(step))}</li>`).join('')}</ol>${owned.some(requiresUpgrade)?'<p>Zwykłe składniki +0 trzeba podnieść do +1 przed spawem.</p>':''}</div></details>`;}).join(''):'<p class="goalNoMatches">Brak kombinacji pasujących do filtrów.</p>';
 $('goalShowMore').hidden=goalMatchedPlans.length<=goalVisibleLimit;
 renderGoalMissingList();
}
function renderGoalMissingList(){
 const fullItems=missingItemList(goalMatchedPlans),isItems=goalMissingListMode==='items';
 const list=isItems?fullItems:missingAffixList(goalMatchedPlans,goalMissingListMode);
 const title=isItems?'Lista brakujących itemów':goalMissingListMode==='prefix'?'Unikalne prefiksy':'Unikalne sufiksy';
 $('goalMissingListTitle').textContent=title;
 $('goalMissingListHint').textContent=isItems
  ?'Każdy zestaw odpowiada przepisowi o tym samym numerze. Zdobądź razem składniki jednego wybranego zestawu — pozostałe to alternatywy. Lista obejmuje wszystkie przepisy pasujące do filtrów. Składniki na poziomie +1.'
  :'Afiksy brakujących składników ze wszystkich kombinacji pasujących do filtrów, każdy tylko raz. Pomijamy przedmioty bez wybranego afiksu. Właściwą bazę i drugi afiks sprawdź w przepisie.';
 $('goalMissingList').value=isItems?missingPlanListText(goalMatchedPlans,goalResultState.plans):list.join('\n');
 $('goalMissingList').setAttribute('aria-label',isItems?'Brakujące itemy według zestawów: ilość - nazwa':title);
 $('goalMissingList').placeholder=!goalMatchedPlans.length?'Brak kombinacji pasujących do filtrów.':!fullItems.length?'Wszystkie składniki masz.':goalMissingListMode==='prefix'?'Brakujące składniki nie mają prefiksów.':'Brakujące składniki nie mają sufiksów.';
 $('goalMissingListCount').textContent=`${isItems?'Unikalne przedmioty':title}: ${list.length.toLocaleString('pl')} · kombinacje: ${goalMatchedPlans.length.toLocaleString('pl')}`;
 $('goalCopyList').disabled=!list.length;
 $('goalCopyStatus').textContent='';
}

function renderGoalPlans(target,response){
 const {plans,partial,stopReason}=response;
 const partialMessage=stopReason==='memory'?'Osiągnięto limit pamięci wyszukiwania. Wyniki są częściowe; zawęź cel lub ekwipunek.':'Osiągnięto limit czasu. Wyniki są częściowe.';
 if(!plans.length){$('goalResults').innerHTML=`<p class="goalStatus">${partial?partialMessage:'Nie znaleziono przepisu w wybranym limicie spawów i najwyżej dwóch brakujących składnikach.'}</p>`;return;}
 const minMissing=plans.reduce((min,plan)=>Math.min(min,plan.missingCount),Infinity),lead=minMissing===0?'Ten przedmiot da się zbudować z Twojego ekwipunku.':`Z Twoich przedmiotów brakuje co najmniej ${minMissing} ${minMissing===1?'składnika':'składników'}`;
 goalResultState={target,plans};
 const category=data.categories.find(item=>item.id===target.category),prefixes=category?.axes.prefix?.values||[],suffixes=category?.axes.suffix?.values||[];
 $('goalResults').innerHTML=`<p class="goalStatus"><strong>${esc(goalTargetName(target))}</strong> · ${lead}. ${partial?partialMessage:''} Pokazujemy wszystkie znalezione kombinacje; nowe składniki zakładamy na poziomie +1.</p><div class="goalFilters"><label for="goalTextFilter">Brakujący przedmiot<input id="goalTextFilter" type="search" placeholder="Szukaj nazwy, prefiksu lub sufiksu"></label><label for="goalPrefixFilter">Prefiks brakującego<select id="goalPrefixFilter"><option value="">Wszystkie prefiksy</option>${prefixes.map(value=>`<option value="${esc(value)}">${esc(label(value))}</option>`).join('')}</select></label><label for="goalSuffixFilter">Sufiks brakującego<select id="goalSuffixFilter"><option value="">Wszystkie sufiksy</option>${suffixes.map(value=>`<option value="${esc(value)}">${esc(label(value))}</option>`).join('')}</select></label><label for="goalStepsFilter">Liczba spawów<select id="goalStepsFilter"><option value="">Dowolna</option>${[...new Set(plans.map(plan=>plan.steps))].sort((a,b)=>a-b).map(count=>`<option value="${count}">${count}</option>`).join('')}</select></label><label for="goalMissingFilter">Brakujących sztuk<select id="goalMissingFilter"><option value="">Dowolna</option>${[...new Set(plans.map(plan=>plan.missingCount))].sort((a,b)=>a-b).map(count=>`<option value="${count}">${count}</option>`).join('')}</select></label><p id="goalResultCount" class="goalResultCount" aria-live="polite"></p></div><div class="goalResultsLayout"><div class="goalCardsColumn"><div id="goalPlanList" class="goalPlans"></div><button id="goalShowMore" class="secondary more" type="button" hidden>Pokaż kolejne 100</button></div><aside class="goalMissingSidebar" aria-labelledby="goalMissingListTitle"><h3 id="goalMissingListTitle">Lista brakujących itemów</h3><label class="missingListMode" for="goalMissingListMode">Pokaż na liście<select id="goalMissingListMode"><option value="items">Pełne przedmioty</option><option value="prefix">Unikalne prefiksy</option><option value="suffix">Unikalne sufiksy</option></select></label><p id="goalMissingListHint"></p><p id="goalMissingListCount" aria-live="polite"></p><textarea id="goalMissingList" readonly aria-label="Brakujące itemy według zestawów: ilość - nazwa" spellcheck="false"></textarea><button id="goalCopyList" class="secondary" type="button">Kopiuj listę</button><p id="goalCopyStatus" role="status"></p></aside></div>`;
 $('goalMissingListMode').value=goalMissingListMode;
 $('goalMissingListMode').onchange=()=>{goalMissingListMode=$('goalMissingListMode').value;renderGoalMissingList();};
 const resetPage=()=>{goalVisibleLimit=100;renderGoalPlanCards();};
 $('goalTextFilter').oninput=resetPage;$('goalPrefixFilter').onchange=resetPage;$('goalSuffixFilter').onchange=resetPage;$('goalStepsFilter').onchange=resetPage;$('goalMissingFilter').onchange=resetPage;
 $('goalCopyList').onclick=async()=>{try{await navigator.clipboard.writeText($('goalMissingList').value);if($('goalCopyStatus'))$('goalCopyStatus').textContent='Skopiowano listę.';}catch{if($('goalMissingList')){$('goalMissingList').focus();$('goalMissingList').select();$('goalCopyStatus').textContent='Zaznaczono listę. Skopiuj ją skrótem Ctrl+C lub z menu urządzenia.';}}};
 $('goalShowMore').onclick=()=>{goalVisibleLimit+=100;renderGoalPlanCards();};
 renderGoalPlanCards();
}
function searchMissing(event){
 event.preventDefault();clearGoalResults();
 let target;
 try{target=createGoalTarget(data,$('goalCategory').value,$('goalBase').value,$('goalPrefix').value,$('goalSuffix').value);}
 catch(error){$('goalResults').textContent=error.message;return;}
 if(!possibleForSex(target,profile().sex,itemDetails,itemCatalog)){$('goalResults').textContent=`Wybrany przedmiot jest przeznaczony tylko dla ${requiredSex(target,itemDetails,itemCatalog)==='female'?'kobiet':'mężczyzn'}. Zmień płeć postaci, aby szukać przepisu.`;return;}
 const run=++goalRun,timeMs=Number($('goalTimeBudget').value||5)*1000;
 try{goalWorker=new Worker(new URL('./worker.js',import.meta.url),{type:'module'});}catch{$('goalResults').textContent='Nie udało się uruchomić obliczeń.';return;}
 $('goalSearch').disabled=true;$('goalStop').hidden=false;
 $('goalResults').innerHTML='Szukam brakujących składników… <span id="goalCountdown" aria-live="off"></span><small id="goalWork"></small>';
 const start=performance.now(),tick=()=>{const countdown=$('goalCountdown');if(countdown)countdown.textContent=`${Math.max(0,(timeMs-performance.now()+start)/1000).toFixed(0)} s do limitu obliczeń.`;};tick();goalLoadingTimer=setInterval(tick,1000);
 const finish=()=>{goalRun++;clearTimeout(goalDeadlineTimer);clearInterval(goalLoadingTimer);goalWorker?.terminate();goalWorker=null;$('goalStop').hidden=true;$('goalSearch').disabled=false;};
 goalWorker.onmessage=({data:response})=>{if(run!==goalRun)return;if(response.type==='progress'){$('goalWork').textContent=`${response.phase==='spawy'?'Liczenie spawów':'Sprawdzanie składników'} · ${response.attempts?.toLocaleString('pl')||0} sprawdzonych kombinacji · ${response.states?.toLocaleString('pl')||0} stanów`;return;}finish();if(response.type==='missingDone')renderGoalPlans(target,response);else $('goalResults').textContent=response.message||'Nie udało się sprawdzić przepisów.';};
 goalWorker.onerror=()=>{if(run!==goalRun)return;finish();$('goalResults').textContent='Nie udało się sprawdzić przepisów.';};
 const finishGraceMs=Math.min(30000,Math.max(2000,timeMs*0.05));
 goalDeadlineTimer=setTimeout(()=>{if(run!==goalRun)return;finish();$('goalResults').textContent='Obliczenia przerwane po przekroczeniu limitu bezpieczeństwa. Zmniejsz ekwipunek lub liczbę spawów i spróbuj ponownie.';},timeMs+finishGraceMs);
 try{goalWorker.postMessage({mode:'missing',items:inventory,target,tables:data,maxSteps:Number($('goalSteps').value),timeMs});}catch{finish();$('goalResults').textContent='Nie udało się przekazać składników do obliczeń.';}
}
function setBusy(b){running=b;$('loadingState').hidden=!b;if(!b){clearInterval(loadingTimer);clearTimeout(deadlineTimer);}$('calculate').disabled=b;$('stop').hidden=!b;inventoryPanel.setBusy(b);}
async function calculate(){
 if(!data)return;
 craftingDirty=false;
 clearTimeout(depthTimer);
 clearInterval(loadingTimer);clearTimeout(deadlineTimer);
 const depth=Number($('depth').value);const run=++runCounter;
 const category=$('category').value,scope=analysisScope(inventory,data,category);
 const inventorySignature=JSON.stringify({category,items:scope.items});
 const baseline=completedRun?.inventorySignature===inventorySignature&&!completedRun.truncated?completedRun:null;
 worker?.terminate();worker=null;activeReject?.(new Error('Uruchomiono nowszą analizę.'));activeReject=null;
 results=[];newKeys=new Set();selected=null;lastRun=null;visibleLimit=50;setBusy(true);renderResults();
 $('status').className='status';$('status').textContent=category==='all'?'Sprawdzam kolejne połączenia…':`Sprawdzam połączenia: ${categoryName(category)}…`;
 const start=performance.now(),timeMs=Number($('timeBudget').value||5)*1000;
 $('loadingWork').textContent='Przygotowuję składniki…';
 const tick=()=>{const elapsed=performance.now()-start,remaining=Math.max(0,(timeMs-elapsed)/1000);$('loadingCountdown').textContent=remaining>0?`${remaining.toFixed(1)} s do limitu obliczeń`:'Kończę i przygotowuję wyniki…';$('loadingProgress').value=Math.min(100,elapsed/timeMs*100);};tick();loadingTimer=setInterval(tick,150);
 return new Promise((resolve,reject)=>{
  activeReject=reject;
  const fail=message=>{if(run!==runCounter)return;activeReject=null;runCounter++;setBusy(false);$('status').className='status warning';$('status').textContent=message;worker?.terminate();worker=null;renderResults();reject(new Error(message));};
  try{worker=new Worker(new URL('./worker.js',import.meta.url),{type:'module'});}catch{fail('Nie udało się uruchomić obliczeń. Odśwież stronę lub spróbuj ponownie.');return;}
  worker.onerror=e=>fail(e.message||'Nie udało się uruchomić obliczeń. Spróbuj ponownie.');
  worker.onmessage=({data:r})=>{
   if(run!==runCounter)return;
   if(r.type==='progress'){$('loadingWork').textContent=`${r.attempts?.toLocaleString('pl')||0} sprawdzonych par · ${r.states} stanów`;$('status').textContent=`${r.category}: do ${r.leaves} składników · ${r.results} różnych wyników`;return;}
   if(r.type==='error'){fail(r.message);return;}
   if(r.type==='done'){
    results=r.results;lastRun=r;activeReject=null;setBusy(false);worker.terminate();worker=null;
    if(baseline&&depth>baseline.depth)newKeys=new Set(results.map(resultKey).filter(k=>!baseline.keys.has(k)));
    const comparison=baseline&&depth>baseline.depth&&!r.truncated?newKeys.size?`Dodano ${newKeys.size} nowych wyników względem głębokości ${baseline.depth}. Oznaczono je etykietą NOWY. `:`Brak nowych nazw względem głębokości ${baseline.depth} — ta pula składników daje te same wyniki w wybranym zakresie. `:'';
    completedRun={inventorySignature,depth,keys:new Set(results.map(resultKey)),truncated:r.truncated};
    $('status').className=r.truncated?'status warning':'status';
    $('status').textContent=`${r.truncated?(r.stopReason==='memory'?'Wyniki częściowe — osiągnięto limit pamięci wyszukiwania. Zawęź ekwipunek lub zmniejsz głębokość. ':'Wyniki częściowe — osiągnięto limit czasu. Zwiększ czas albo zawęź ekwipunek. '):''}${r.results.length.toLocaleString('pl')} różnych nazw · głębokość do ${depth} · ${((performance.now()-start)/1000).toFixed(2)} s. ${comparison}Dla każdej nazwy pokazujemy najkrótszą znalezioną ścieżkę. Wyniki to alternatywy korzystające ze wspólnej puli.`;
    renderResults();resolve({count:results.length,partial:r.truncated,depth});
   }
  };
  const finishGraceMs=Math.min(30000,Math.max(2000,timeMs*0.05));
  deadlineTimer=setTimeout(()=>fail('Obliczenia przerwane po przekroczeniu limitu bezpieczeństwa. Zmniejsz ekwipunek i spróbuj ponownie.'),timeMs+finishGraceMs);
  try{worker.postMessage({items:scope.items,tables:scope.tables,depth,timeMs});}catch{fail('Nie udało się przekazać składników do obliczeń. Spróbuj ponownie.');}
 });
}
function loadInventory(text,{preserveHistory=false,category='all'}={}){
 const parsed=importInventory(text,data,category);if(parsed.error)throw new Error(parsed.error);
 clearGoalResults();
 if(!preserveHistory){enteredCosts.clear();simulationHistory.length=0;$('inventoryChange').textContent=parsed.ignored.length?`Zaimportowano ${parsed.items.length} szt. Pominięto ${parsed.ignored.length} fragmentów tekstu.`:'';}
 inventoryText=text;inventory=parsed.items;renderInventory();visibleLimit=50;filterOptions();for(const id of ['filterBase','filterPrefix','filterSuffix'])$(id).value='all';if(!$('tiersPanel').hidden){craftingDirty=true;return Promise.resolve();}return calculate();
}
async function applyPlan(node){
 if(running)throw new Error('Poczekaj na zakończenie obliczeń.');
 const used=ingredients(node),ids=new Set(used.map(i=>i.id));
 if(ids.size!==used.length||used.some(i=>!inventory.some(current=>current.id===i.id&&resultKey(current)===resultKey(i))))throw new Error('Składniki tego planu nie są już dostępne. Przelicz możliwości.');
 const remaining=inventory.filter(i=>!ids.has(i.id));
 const name=fullItemName(node);const nextText=[...remaining.map(i=>i.original),name].join('\n');
 const check=parseInventory(nextText,data);if(check.errors.length)throw new Error('Nie udało się dodać wyniku do listy składników.');
 simulationHistory.push(inventory.map(i=>i.original).join('\n'));
 $('inventoryChange').textContent=`Zastosowano plan: zużyto ${used.length} szt., dodano ${name}. Ekwipunek: ${inventory.length} → ${remaining.length+1} szt.`;
 return await loadInventory(nextText,{preserveHistory:true});
}
function renderTables(){
 const c=data.categories.find(c=>c.id===$('tableCategory').value);const axis=$('tableAxis').value;const a=c.axes[axis];
 if(!a)return;
 const blocked=new Set(a.blocked);const isBlocked=(x,y)=>blocked.has([x,y].sort((x,y)=>a.values.indexOf(x)-a.values.indexOf(y)).join('|'));
 $('tableMeta').textContent=`${c.sheet} · ${axisLabels[axis]} · ${a.values.length} elementów · nagłówek w wierszu ${a.headerRow}`;
 $('matrix').innerHTML=`<thead><tr><th>${axisLabels[axis]}</th>${a.values.map(v=>`<th>${esc(label(v))}</th>`).join('')}</tr></thead><tbody>${a.values.map(x=>`<tr><th>${esc(label(x))}</th>${a.values.map(y=>`<td class="${isBlocked(x,y)?'conflict':x===y?'diagonal':''}" title="${esc(a.refs[x+'|'+y]||'Brak komórki')}${isBlocked(x,y)?' · para zablokowana':''}">${esc(label(a.table[x+'|'+y]||'brak'))}${isBlocked(x,y)?' ⚠':''}</td>`).join('')}</tr>`).join('')}</tbody>`;
}
function tableCategoryChanged(){const c=data.categories.find(c=>c.id===$('tableCategory').value);$('tableAxis').innerHTML=Object.keys(c.axes).map(k=>`<option value="${k}">${axisLabels[k]}</option>`).join('');renderTables();}
const tierKindLabel={gain:'Awans bez strat',mixed:'Awans kosztem drugiego afiksu',neutral:'Bez zmiany tierów',loss:'Strata tierów'};
function renderTierEstimate(){
 if(!data)return;
 const scope=inventory.filter(i=>$('tierCategory').value==='all'||i.category===$('tierCategory').value);
 const minGain=Number($('tierMinGain').value);
 $('tierMinGain').max=Math.max(2,...data.categories.map(c=>['prefix','suffix'].reduce((sum,axis)=>sum+Math.max(0,(c.axes[axis]?.values.length||0)-1),0)));
 const minGainLabel=minGain?`+${minGain}`:'Bez minimum';
 $('tierMinGainValue').value=minGainLabel;
 $('tierMinGain').setAttribute('aria-valuetext',minGainLabel);
 const estimate=estimateTiers(scope,data),pairs=estimate.pairs.filter(p=>($('tierKind').value==='all'||p.kind===$('tierKind').value)&&(!minGain||p.gain>=minGain));
 const signed=n=>n>0?'+'+n:String(n);
 $('tierSummary').innerHTML=`<div><strong>${scope.length}</strong><span>szt. w ekwipunku</span></div><div><strong>${estimate.pairs.length}</strong><span> dozwolonych par z afiksami</span></div><div class="tierStatGain"><strong>${estimate.pairs.filter(p=>p.kind==='gain').length}</strong><span>awansów bez strat</span></div><div><strong>${Math.min(pairs.length,tierVisibleLimit)} / ${pairs.length}</strong><span>widoczne pary</span></div>`;
 $('tierPairs').innerHTML=pairs.slice(0,tierVisibleLimit).map(p=>`<article class="panel tierPair ${p.kind}">
  <div class="tierPairHeading"><strong>${tierKindLabel[p.kind]}</strong><span class="tierBalance">Bilans <b>${signed(p.gain)}</b></span></div>
  <div class="tierResult"><span class="tierSectionLabel">Wynik · 1 spaw</span><h3>${itemPopover.markup(p.node,fullItemName(p.node))}</h3>${p.lowTier?`<span class="tierLowBadge" title="Suma tierów prefiksu i sufiksu wyniku jest poniżej 6; brak afiksu liczy się jako 0.">Słaby wynik · suma tierów ${p.resultTierSum} &lt; 6</span>`:''}</div>
  <div class="tierIngredients"><span class="tierSectionLabel">Składniki</span>${[p.node.left,p.node.right].map(n=>`<div class="tierIngredient"><span class="tierItemIndex">#${n.id+1}</span><span>${itemPopover.markup(n,n.original)}${requiresUpgrade(n)?' '+upgradeBadge:''}</span></div>`).join('')}</div>
  <div class="tierAxes">${Object.entries(p.axes).map(([axis,a])=>`<div class="tierAxis"><div class="tierAxisHeading"><strong>${axisLabels[axis]}: <span class="tierDelta ${a.delta>0?'positive':a.delta<0?'negative':'unchanged'}">${signed(a.delta)}</span></strong><span class="tierFormula">T${a.left} + T${a.right} <span aria-hidden="true">→</span> <b>T${a.result}</b></span></div><p>${esc(label(p.node.left[axis]||'brak'))} + ${esc(label(p.node.right[axis]||'brak'))} → <strong>${esc(label(p.node[axis]||'brak'))}</strong></p></div>`).join('')}</div>
 </article>`).join('')||`<div class="empty">${inventory.length?'Brak par dla wybranych filtrów. Kategorie bez afiksów nie mają oceny tierów.':'Wklej ekwipunek, aby sprawdzić pojedyncze spawy.'}</div>`;
 $('tierMore').hidden=pairs.length<=tierVisibleLimit;
 const statuses={gain:'Ma parę z awansem bez strat',mixed:'Awans tylko kosztem drugiego afiksu',none:'Brak korzystnej pary',unavailable:'Brak obsługiwanej pary do oceny afiksów'};
 $('tierShelf').innerHTML=estimate.items.map(({item,status})=>`<div class="tierShelfItem"><strong>#${item.id+1} ${itemPopover.markup(item,item.original)}</strong><span>${statuses[status]}</span></div>`).join('')||'<p>Brak przedmiotów.</p>';
}
function showToolPanel(which,focus=false){itemPopover.close();const tabs=[['missingTab','missingPanel','missing'],['craftingTab','craftingPanel','crafting'],['tiersTab','tiersPanel','tiers']];for(const [tab,panel,name]of tabs){$(panel).hidden=name!==which;$(tab).setAttribute('aria-selected',String(name===which));$(tab).tabIndex=name===which?0:-1;}if(which==='tiers'){tierVisibleLimit=50;renderTierEstimate();}if(which==='crafting'&&craftingDirty)calculate().catch(()=>{});if(focus)$(`${which}Tab`).focus();}
let journeyPanel;
function showView(which){itemPopover.close();$('forgeView').hidden=which!=='forge';$('tablesView').hidden=which!=='tables';$('journeyView').hidden=which!=='journey';document.querySelector('.sharedInventoryLayout').hidden=which==='journey';for(const [id,view]of [['forgeTab','forge'],['tablesTab','tables'],['journeyTab','journey']]){if(view===which)$(id).setAttribute('aria-current','page');else $(id).removeAttribute('aria-current');}if(which==='journey')(journeyPanel??=createJourneyPanel()).open();}
function registerTools(){
 const context=document.modelContext;if(!context?.registerTool)return;
 const abort=new AbortController();window.addEventListener('pagehide',()=>abort.abort(),{once:true});
 const tools=[
  {name:'read_crafting_results',title:'Odczytaj wyniki kuźni',description:'Odczytaj widoczne wyniki i stan ostatniej analizy ekwipunku.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:true},execute:()=>({running,depth:lastRun?.maxDepth,partial:lastRun?.truncated??false,count:filtered().length,results:filtered().slice(0,50).map(n=>({name:itemName(n),steps:n.steps,depth:n.depth,ingredients:ingredients(n).map(i=>i.original),upgradeToPlusOne:ingredients(n).filter(requiresUpgrade).map(i=>i.original)}))})},
  {name:'configure_inventory_and_calculate',title:'Ustaw ekwipunek i oblicz spawy',description:'Zastąp listę składników w kuźni i oblicz ścieżki do wybranej głębokości. Nie wykonuje żadnych działań w grze.',inputSchema:{type:'object',properties:{inventory:{type:'string'},depth:{type:'integer',minimum:1,maximum:25}},required:['inventory','depth'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:true},execute:async input=>{if(!input||typeof input.inventory!=='string'||!Number.isInteger(input.depth)||input.depth<1||input.depth>25)throw new Error('Wymagana lista tekstowa oraz głębokość 1–25.');if(running)throw new Error('Poczekaj na zakończenie obecnej analizy.');const parsed=importInventory(input.inventory,data);if(parsed.error)throw new Error(parsed.error);$('depth').value=input.depth;$('depthValue').value=input.depth;showView('forge');return await loadInventory(input.inventory);}}
 ];
 for(const tool of tools)try{Promise.resolve(context.registerTool(tool,{signal:abort.signal})).catch(()=>{});}catch{}
}
async function loadCatalog(){
 itemDetails??={items:{}};itemDetails.catalog=itemCatalog;itemDetails.components??={};
 let count=0;const failed=[];
 await Promise.all(data.categories.map(async c=>{try{const response=await fetch(`./item-components/${c.id}.json`);if(!response.ok)throw new Error('catalog');const group=await response.json();group.requirementModels=itemDetails.requirementModels?.[c.id];itemDetails.components[c.id]=group;}catch{failed.push(c.label);}finally{count++;$('catalogStatus').textContent=`Wczytuję dane przedmiotów: ${count}/${data.categories.length} kategorii…`;}}));
 $('catalogStatus').textContent=failed.length?`Nie wczytano danych: ${failed.join(', ')}. Odśwież stronę; brakujące koszty można wpisać ręcznie.`:!itemDetails.requirementModels?'Nie wczytano dokładnych wymagań epickich i starożytnych przedmiotów. Odśwież stronę.':'Dane R21 gotowe · 10 kategorii · poziom postaci 80 · odczyt 03–04.10.2026';
 if(profile().sex)clearGoalResults();
 if(!running){renderInventory();renderResults();}
}
async function init(){
 const response=await fetch('./data.json');if(!response.ok)throw new Error('Nie udało się wczytać tabel R21.');data=await response.json();
 try{const [details,catalog,requirements]=await Promise.all(['./item-details.json','./item-catalog.json','./item-requirements.json'].map(url=>fetch(url).catch(()=>null)));if(details?.ok)itemDetails=await details.json();if(catalog?.ok)itemCatalog=await catalog.json();if(requirements?.ok){itemDetails??={items:{}};itemDetails.requirementModels=(await requirements.json()).models;}}catch{}
 const options=data.categories.map(c=>`<option value="${c.id}">${esc(c.label)}</option>`).join('');$('category').insertAdjacentHTML('beforeend',options);$('tableCategory').innerHTML=options;
 $('goalCategory').insertAdjacentHTML('beforeend',options);
 $('tierCategory').insertAdjacentHTML('beforeend',options);
 $('goalForm').onsubmit=searchMissing;$('goalCategory').onchange=updateGoalCategory;
 for(const id of ['goalBase','goalPrefix','goalSuffix'])$(id).onchange=updateGoalPreview;
 $('goalSteps').onchange=clearGoalResults;$('goalTimeBudget').onchange=clearGoalResults;$('goalStop').onclick=()=>{clearGoalResults();$('goalResults').textContent='Wyszukiwanie zatrzymane.';};updateGoalCategory();
 $('profileRace').insertAdjacentHTML('beforeend',Object.entries(races).map(([id,r])=>`<option value="${id}">${esc(r.label)}</option>`).join(''));
 $('profileTattoo').insertAdjacentHTML('beforeend',Object.entries(tattoos).map(([id,t])=>`<option value="${id}">${esc(t.label)}</option>`).join(''));
 try{const saved=JSON.parse(localStorage.getItem('kuzniaProfile')||'{}');if(races[saved.race])$('profileRace').value=saved.race;if(tattoos[saved.tattoo])$('profileTattoo').value=saved.tattoo;if(['female','male'].includes(saved.sex))$('profileSex').value=saved.sex;}catch{}
 const updateProfile=()=>{const p=profile(),t=tattoos[p.tattoo],r=races[p.race];try{localStorage.setItem('kuzniaProfile',JSON.stringify(p));}catch{}$('profileHint').innerHTML=`${r?`<strong>${esc(r.label)}</strong> · ${esc(r.bonus)}. Bonus rasy wpływa na względną ocenę statystyk. `:''}${t?`<strong>${esc(t.label)}</strong> · broń: ${esc(t.weapons.map(w=>data.categories.find(c=>c.id===w)?.label||w).join(', '))} · obrona głowa/klatka/nogi: ${esc(t.armour)}. Ocena uwzględnia styl walki i możliwy zakres obrony; sprawdź poziom tatuażu oraz cały zestaw.`:'Wybierz rasę i tatuaż, aby ocenić przyrost statystyk dla postaci.'}${p.sex?` Pokazujemy wyniki możliwe do używania przez ${p.sex==='female'?'kobietę':'mężczyznę'}.`:''}`;clearGoalResults();renderInventory();renderResults();};
 $('profileRace').onchange=updateProfile;$('profileTattoo').onchange=updateProfile;$('profileSex').onchange=updateProfile;updateProfile();
 inventory=[];filterOptions();renderInventory();
 $('sourceLink').href=data.source.url;
 $('conflicts').innerHTML=data.issues.map(i=>`<div class="conflictCard"><b>${esc(i.category)} · ${axisLabels[i.axis]}</b><br>${esc(label(i.a))} + ${esc(label(i.b))}<br>${esc(i.cells[0])}: <b>${esc(label(i.ab))}</b> / ${esc(i.cells[1])}: <b>${esc(label(i.ba))}</b></div>`).join('');
 $('correctionSummary').textContent=`${data.corrections.length} korekty literówek i odmiany nazw`;
 $('corrections').innerHTML=data.corrections.map(c=>`<div class="correction">${esc(c.cell)}: <s>${esc(c.from)}</s> → ${esc(c.to)}</div>`).join('');
 tableCategoryChanged();
 $('tableCategory').onchange=tableCategoryChanged;$('tableAxis').onchange=renderTables;
 $('forgeTab').onclick=()=>showView('forge');$('tablesTab').onclick=()=>showView('tables');$('journeyTab').onclick=()=>showView('journey');
 $('showRecipe').onclick=()=>{$('recipePanel').focus({preventScroll:true});$('recipePanel').scrollIntoView({block:'start'});};
 $('backToResults').onclick=()=>{const target=$('resultsList').querySelector('.selected')||$('craftingResults');target.focus({preventScroll:true});target.scrollIntoView({block:'center'});};
 for(const [index,name]of ['missing','crafting','tiers'].entries()){
  $(name+'Tab').onclick=()=>showToolPanel(name);
  $(name+'Tab').onkeydown=e=>{const names=['missing','crafting','tiers'];let next;if(['ArrowRight','ArrowDown'].includes(e.key))next=(index+1)%3;else if(['ArrowLeft','ArrowUp'].includes(e.key))next=(index+2)%3;else if(e.key==='Home')next=0;else if(e.key==='End')next=2;else return;e.preventDefault();showToolPanel(names[next],true);};
 }
 for(const id of ['tierCategory','tierKind'])$(id).onchange=()=>{tierVisibleLimit=50;renderTierEstimate();};
 $('tierMinGain').oninput=()=>{tierVisibleLimit=50;renderTierEstimate();};
 $('tierMore').onclick=()=>{tierVisibleLimit+=50;renderTierEstimate();};
 $('depth').oninput=()=>{$('depthValue').value=$('depth').value;clearTimeout(depthTimer);$('status').textContent=`Głębokość ${$('depth').value} — za chwilę automatycznie przeliczę wyniki…`;depthTimer=setTimeout(()=>calculate().catch(()=>{}),250);};
 $('calculate').onclick=()=>calculate().catch(()=>{});
 $('stop').onclick=()=>{clearTimeout(depthTimer);runCounter++;worker?.terminate();worker=null;activeReject?.(new Error('Obliczenia zatrzymane.'));activeReject=null;setBusy(false);results=[];newKeys=new Set();$('status').textContent='Obliczenia zatrzymane. Zmniejsz głębokość lub listę i przelicz ponownie.';renderResults();};
 $('resultOrder').querySelectorAll('[data-order]').forEach(button=>button.onclick=()=>{resultOrder=button.dataset.order;visibleLimit=50;selected=null;renderResults();});
 for(const id of ['filterBase','filterPrefix','filterSuffix'])$(id).onchange=()=>{visibleLimit=50;renderResults();};$('category').onchange=()=>{filterOptions();visibleLimit=50;calculate().catch(()=>{});};
 $('clearFilters').onclick=()=>{const changed=$('category').value!=='all';$('category').value='all';filterOptions();for(const id of ['filterBase','filterPrefix','filterSuffix'])$(id).value='all';if(changed)calculate().catch(()=>{});else renderResults();};
 $('timeBudget').onchange=()=>calculate().catch(()=>{});
 $('loadMore').onclick=()=>{visibleLimit+=50;renderResults();};
 inventoryPanel.bind();
 registerTools();loadCatalog().catch(()=>{});await calculate();
}
init().catch(e=>{$('status').textContent=e.message;$('status').className='status warning';});
