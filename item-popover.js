import {detailKey,itemClass,qualityLabel,officialUrl,lookupItem} from './item-details.js';
import {itemName,label} from './engine.js';
import {assessAffixes} from './strong-combos.js';
import {assessProfileAffixes,tattoos,races,possibleForSex,requiredSex} from './profile-affixes.js';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function affixContent(n,profile,details,catalog,inventory=[]){
 const {pair,prefix,suffix}=assessAffixes(n,details,{},inventory);
 const match=profile?.tattoo||profile?.race?assessProfileAffixes(n,profile,details,catalog,inventory):null;
 const sections=pair?[['Dobra para', [pair]]]:[
  [`Dobry prefiks: ${label(n?.prefix||'')}`,prefix],
  [`Dobry sufiks: ${label(n?.suffix||'')}`,suffix]
 ].filter(([,rules])=>rules.length);
 if(!sections.length&&!match?.rank)return '';
 return `<section class="affixAdvice"><h4>Ocena afiksów · Moria</h4>${sections.map(([title,rules])=>`<p><strong>${esc(title)}</strong></p>${rules.map(rule=>`<p>${esc(rule.reason)}</p>`).join('')}`).join('')}${match?`<p class="tattooAdvice">${match.rank?`Dla ${esc(profile.tattoo?tattoos[profile.tattoo].label:races[profile.race].label)}: ${match.pair?'dobra para':match.prefix.length&&match.suffix.length?'oba afiksy':match.prefix.length?'prefiks':'sufiks'}.`:`Dla wybranego profilu ten wariant nie spełnia kryteriów wyróżnienia lub ograniczeń tatuażu.`}</p>`:''}<details class="itemExtra"><summary>Jak oceniamy afiksy</summary><p class="itemSourceNote">Porównanie cech afiksów z lokalnego katalogu R21 w tej samej kategorii. Ich ocena nie zależy od jakości ani ulepszenia przedmiotu. Bonusy oznaczone jako „niekompletny” nie są liczone jako aktywne. Ocena nie uwzględnia ceny rynkowej, statystyk postaci ani całego wyposażenia.</p></details></section>`;
}
export function detailContent(n,details,catalog,profile,inventory=[]){
 const row=lookupItem(n,details,catalog),c=itemClass(n),url=row?.url||officialUrl(n,catalog,c??1);
 const restricted=profile?.sex&&!possibleForSex(n,profile.sex,details,catalog),sex=requiredSex(n,details,catalog);
 return `<header><div><p class="eyebrow">KATALOG R21 · ${esc(qualityLabel(c))}</p><h3>${esc(row?.name||itemName(n))}</h3></div><button type="button" id="closeItemInfo" class="textButton" aria-label="Zamknij dane przedmiotu">×</button></header>${restricted?`<p class="sexNotice">Ten przedmiot jest tylko dla ${sex==='female'?'kobiet':'mężczyzn'} i nie pasuje do wybranej płci postaci.</p>`:''}${affixContent(n,profile,details,catalog,inventory)}${row?`<div class="itemStats">${row.lines.map(line=>`<p>${esc(line)}</p>`).join('')}</div><details class="itemExtra"><summary>Źródło i zakres statystyk</summary><p class="itemSourceNote">${row.composed?'Statystyki złożone z danych bazy, prefiksu i sufiksu.':'Dokładny wariant z oficjalnego katalogu.'} Dane: 03–04.10.2026. Poziom postaci: 80. Bonusy opisane jako „niekompletny” wymagają zestawu — nie traktuj ich jako aktywnych bonusów samego itemu.</p></details>`:`<p class="missingStats">Brak tego wariantu w zapisanej bazie. Nie podstawiamy statystyk innej jakości. ${c===null?'Link otworzy wariant zwykły (+1); wybierz właściwą jakość w katalogu.':''}</p>`}${n.left?'<details class="itemExtra"><summary>Jakość wyniku spawu</summary><p class="itemSourceNote">Jakość wyniku wyznaczona z jakości składników według reguł Morii. Lista planów nadal wybiera najkrótszą ścieżkę dla każdej nazwy, nie najtańszy wariant.</p></details>':''}${url?`<a href="${esc(url)}" target="_blank" rel="noreferrer">Sprawdź ten wariant w oficjalnym katalogu R21</a>`:''}`;
}
export function createItemPopover(getDetails,getCatalog,getProfile=()=>({}),getInventory=()=>[]){
 const nodes=new Map();let target=null,mode='hover',skipFocusOnce=null,closeTimer;
 const panel=document.getElementById('itemInfo');
 const attrs=n=>{const key=detailKey(n);nodes.set(key,n);return `data-item-detail="${esc(key)}" aria-haspopup="dialog"`;};
 const inline=(n,text,decorated)=>{const key=detailKey(n);nodes.set(key,n);return `<span class="itemInfoTrigger" data-item-detail="${esc(key)}">${decorated??esc(text)}</span>`;};
 const markup=(n,text,decorated)=>`<button type="button" class="itemInfoTrigger" ${attrs(n)}>${decorated??esc(text)}</button>`;
 function close(){clearTimeout(closeTimer);panel.hidden=true;target?.removeAttribute('aria-describedby');target=null;}
 function show(element,point,interaction='keyboard'){
  clearTimeout(closeTimer);mode=interaction;panel.dataset.mode=mode;const n=nodes.get(element.dataset.itemDetail);if(!n)return;
  if(target!==element)target?.removeAttribute('aria-describedby');target=element;
  panel.innerHTML=detailContent(n,getDetails(),getCatalog(),getProfile(),getInventory());panel.hidden=false;
  target.setAttribute('aria-describedby','itemInfo');
  document.getElementById('closeItemInfo').onclick=()=>{const prior=target;close();skipFocusOnce=prior;prior?.focus();skipFocusOnce=null;};
  const rect=element.getBoundingClientRect(),width=panel.offsetWidth,height=panel.offsetHeight,gap=14,margin=8;
  let left,top;
  if(point){
   left=Math.max(margin,Math.min(point.clientX+gap,window.innerWidth-width-margin));
   top=point.clientY+gap;
   if(top+height>window.innerHeight-margin)top=point.clientY-height-gap;
  }else{
   left=rect.right+12+width<=window.innerWidth?rect.right+12:rect.left-12-width>=margin?rect.left-12-width:Math.max(margin,Math.min(rect.left,window.innerWidth-width-margin));
   top=rect.top;
  }
  panel.style.left=left+'px';panel.style.top=Math.max(margin,Math.min(top,window.innerHeight-height-margin))+'px';
 }
 // Allow crossing the small gap from the name to the interactive panel.
 const inside=e=>e&&(target?.contains(e)||panel.contains(e));
 document.addEventListener('pointerover',e=>{
  if(inside(e.target))clearTimeout(closeTimer);
  const trigger=e.target.closest?.('[data-item-detail]');
  if(trigger&&trigger!==target&&(e.pointerType==='mouse'||e.pointerType==='pen'))show(trigger,e,'hover');
 });
 document.addEventListener('pointerout',e=>{
  if(mode!=='hover'||!inside(e.target)||inside(e.relatedTarget))return;
  clearTimeout(closeTimer);
  if(panel.contains(e.target)||!e.relatedTarget)close();
  else closeTimer=setTimeout(close,160);
 });
 // Pointer focus precedes click: opening here can cover the tapped item and
 // redirect that click to the popover. Keyboard focus still opens immediately.
 document.addEventListener('focusin',e=>{const trigger=e.target.closest?.('[data-item-detail]')||e.target.querySelector?.('[data-item-detail]');if(trigger===skipFocusOnce&&trigger)return;if(trigger&&e.target.matches(':focus-visible'))show(trigger);else if(!panel.contains(e.target))close();});
 document.addEventListener('click',e=>{const trigger=e.target.closest?.('[data-item-detail]');if(trigger&&trigger.isConnected!==false)show(trigger,e.detail?e:null,e.pointerType==='touch'?'touch':e.detail?'hover':'keyboard');else if(!panel.contains(e.target))close();});
 document.addEventListener('keydown',e=>{if(e.key==='Escape')close();if(e.key==='ArrowDown'&&target&&(target===e.target||e.target.contains(target))&&!panel.hidden){e.preventDefault();mode='keyboard';panel.dataset.mode=mode;document.getElementById('closeItemInfo').focus();}});
 document.addEventListener('focusout',e=>{if(mode!=='hover'&&!target?.contains(e.relatedTarget)&&!panel.contains(e.relatedTarget))close();});
 window.addEventListener('resize',close);
 // The popover is fixed to the viewport; close it if its anchor scrolls away.
 document.addEventListener('scroll',e=>{if(!panel.contains(e.target))close();},true);
 return {attrs,inline,markup,close};
}
