import {importInventory} from './inventory-import.js';
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const GUNS=`Magnum (+1)
Desert Eagle (+1)
Desert Eagle (+1)
Karabin snajperski (+1)
AK-47 (+1)
AK-47 (+1)`;

// One page-level inventory UI; consumers own the inventory and react to changes.
export function createInventoryPanel({getTables,getText,itemMarkup,canUse,onImport,onUndo}){
 function render(inventory,canUndo){
  $('inventoryCount').textContent=inventory.length;
  $('undoPlan').hidden=!canUndo;
  $('inventoryList').innerHTML=getTables().categories.map(c=>{const items=inventory.filter(i=>i.category===c.id);return items.length?`<div class="inventoryGroup"><div class="groupLabel"><span>${esc(c.label)}</span><span>${items.length} szt.</span></div>${items.map(i=>`<div class="item"><span class="itemIndex">${String(i.id+1).padStart(2,'0')}</span>${itemMarkup(i,i.original)}${canUse(i)?'':'<span class="sexBadge">NIE DLA TWOJEJ PŁCI</span>'}</div>`).join('')}</div>`:'';}).join('')||'<div class="empty">Lista jest pusta. Dodaj składniki.</div>';
 }
 function parseFeedback(){
  const parsed=importInventory($('inventoryText').value,getTables(),$('importCategory').value);
  $('parseFeedback').innerHTML=`<strong>Rozpoznano ${parsed.items.length} szt.</strong> Pominięto ${parsed.ignored.length} fragmentów tekstu.${parsed.error?`<p class="parseError">${esc(parsed.error)}</p>`:''}${parsed.items.length?`<details open><summary>Przedmioty do importu</summary><ol class="importPreview">${parsed.items.map(i=>`<li>${esc(i.original)}</li>`).join('')}</ol></details>`:''}${parsed.ignored.length?`<details><summary>Co zostało pominięte?</summary>${parsed.ignored.slice(0,30).map(e=>`<div class="parseError">Linia ${e.line}: ${esc(e.text)}</div>`).join('')}${parsed.ignored.length>30?'<p>Pokazano pierwszych 30 pominiętych fragmentów.</p>':''}</details>`:''}`;
  return parsed;
 }
 function reportError(error){$('inventoryChange').textContent=error.message;}
 function bind(){
  $('editInventory').onclick=()=>{$('inventoryText').value=getText();$('parseFeedback').textContent='';$('inventoryDialog').showModal();};
  $('closeDialog').onclick=()=>$('inventoryDialog').close();
  $('validateText').onclick=parseFeedback;
  $('importCategory').onchange=parseFeedback;
  $('inventoryForm').onsubmit=async e=>{
   e.preventDefault();const parsed=parseFeedback();if(parsed.error)return;
   const category=$('importCategory').value,text=$('inventoryText').value;
   $('inventoryDialog').close();
   try{await onImport(text,{category});}catch(error){reportError(error);}
  };
  $('gunExample').onclick=async()=>{try{await onImport(GUNS);}catch(error){reportError(error);}};
  $('undoPlan').onclick=async()=>{try{await onUndo();}catch(error){reportError(error);}};
 }
 function setBusy(busy){for(const id of ['editInventory','gunExample','undoPlan'])$(id).disabled=busy;}
 return {bind,render,setBusy};
}
