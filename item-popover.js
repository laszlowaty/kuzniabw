import {detailKey,itemClass,qualityLabel,officialUrl,lookupItem} from './item-details.js';
import {itemName,label} from './engine.js';
import {assessAffixes,recommendationSources} from './strong-combos.js';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function affixContent(n){
 const {pair,prefix,suffix}=assessAffixes(n);
 const sections=pair?[['Dobra para', [pair]]]:[
  [`Dobry prefiks: ${label(n?.prefix||'')}`,prefix],
  [`Dobry sufiks: ${label(n?.suffix||'')}`,suffix]
 ].filter(([,rules])=>rules.length);
 if(!sections.length)return '';
 return `<section class="affixAdvice"><h4>Przydatność afiksów · Moria</h4>${sections.map(([title,rules])=>`<p><strong>${esc(title)}</strong></p>${rules.map(rule=>`<p>${pair?'':'Przykładowe zastosowanie: '}${esc(rule.reason)} <a href="${esc(recommendationSources[rule.source].url)}" target="_blank" rel="noreferrer">Źródło</a></p>`).join('')}`).join('')}<p class="itemSourceNote">Przykłady ze starszych poradników Morii. Dobierz bazę, jakość, tatuaż i cały zestaw do postaci. To wskazówka zastosowania, nie wycena ani ranking DPS.${pair?'':' Dobre pojedyncze afiksy nie potwierdzają synergii tej pary.'}</p></section>`;
}
export function detailContent(n,details,catalog){
 const row=lookupItem(n,details,catalog),c=itemClass(n),url=row?.url||officialUrl(n,catalog,c??1);
 return `<header><div><p class="eyebrow">KATALOG R21 · ${esc(qualityLabel(c))}</p><h3>${esc(row?.name||itemName(n))}</h3></div><button type="button" id="closeItemInfo" class="textButton" aria-label="Zamknij dane przedmiotu">×</button></header>${affixContent(n)}${row?`<div class="itemStats">${row.lines.map(line=>`<p>${esc(line)}</p>`).join('')}</div><p class="itemSourceNote">${row.composed?'Statystyki złożone z danych bazy, prefiksu i sufiksu.':'Dokładny wariant z oficjalnego katalogu.'} Dane: 03–04.10.2026. Poziom postaci: 80. Bonusy opisane jako „niekompletny” wymagają zestawu — nie traktuj ich jako aktywnych bonusów samego itemu.</p>`:`<p class="missingStats">Brak tego wariantu w zapisanej bazie. Nie podstawiamy statystyk innej jakości. ${c===null?'Link otworzy wariant zwykły (+1); wybierz właściwą jakość w katalogu.':''}</p>`}${n.left?'<p class="itemSourceNote">Jakość wyniku wyznaczona z jakości składników według reguł Morii. Lista planów nadal wybiera najkrótszą ścieżkę dla każdej nazwy, nie najtańszy wariant.</p>':''}${url?`<a href="${esc(url)}" target="_blank" rel="noreferrer">Sprawdź ten wariant w oficjalnym katalogu R21</a>`:''}`;
}
export function createItemPopover(getDetails,getCatalog){
 const nodes=new Map();let target=null,closeTimer,skipFocusOnce=null;
 const panel=document.getElementById('itemInfo');
 const attrs=n=>{const key=detailKey(n);nodes.set(key,n);return `data-item-detail="${esc(key)}" aria-haspopup="dialog"`;};
 const inline=(n,text)=>{const key=detailKey(n);nodes.set(key,n);return `<span class="itemInfoTrigger" data-item-detail="${esc(key)}">${esc(text)}</span>`;};
 const markup=(n,text)=>`<button type="button" class="itemInfoTrigger" ${attrs(n)}>${esc(text)}</button>`;
 function close(){clearTimeout(closeTimer);panel.hidden=true;target?.removeAttribute('aria-describedby');target=null;}
 function show(element,point){
  clearTimeout(closeTimer);const n=nodes.get(element.dataset.itemDetail);if(!n)return;
  if(target!==element)target?.removeAttribute('aria-describedby');target=element;
  panel.innerHTML=detailContent(n,getDetails(),getCatalog());panel.hidden=false;
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
 function leave(e){if(panel.contains(e.relatedTarget)||target?.contains(e.relatedTarget))return;clearTimeout(closeTimer);closeTimer=setTimeout(close,220);}
 document.addEventListener('pointerover',e=>{const trigger=e.target.closest?.('[data-item-detail]');if(trigger&&trigger!==target&&(e.pointerType==='mouse'||e.pointerType==='pen'))show(trigger,e);else if(panel.contains(e.target))clearTimeout(closeTimer);});
 document.addEventListener('pointerout',leave);
 document.addEventListener('focusin',e=>{const trigger=e.target.closest?.('[data-item-detail]');if(trigger===skipFocusOnce&&trigger)return;if(trigger)show(trigger);else if(!panel.contains(e.target))close();});
 document.addEventListener('click',e=>{const trigger=e.target.closest?.('[data-item-detail]');if(trigger&&trigger.isConnected!==false)show(trigger,e.detail?e:null);else if(!panel.contains(e.target))close();});
 document.addEventListener('keydown',e=>{if(e.key==='Escape')close();if(e.key==='ArrowDown'&&target===e.target&&!panel.hidden){e.preventDefault();document.getElementById('closeItemInfo').focus();}});
 window.addEventListener('resize',close);
 // The popover is fixed to the viewport; close it if its anchor scrolls away.
 document.addEventListener('scroll',e=>{if(!panel.contains(e.target))close();},true);
 return {attrs,inline,markup,close};
}
