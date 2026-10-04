import {parseInventory,normalize,variants} from './engine.js';
const patterns=new WeakMap();
const rx=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const aliases={'karabin m.':['karabin mysliwski','karabin maszynowy'],'polautomat s.':['polautomat snajperski'],'karabin s.':['karabin snajperski'],'miotacz p.':['miotacz plomieni'],'shurek':['shuriken'],'miecz dwureczny':['miecz 2h'],'topor dwureczny':['topor 2h']};
const alternatives=list=>[...new Set(list)].sort((a,b)=>b.length-a.length).map(rx).join('|');
function getPatterns(data){
 if(patterns.has(data))return patterns.get(data);
 const out=data.categories.map(c=>{
  const pre=alternatives((c.axes.prefix?.values||[]).flatMap(variants)),suf=alternatives(c.axes.suffix?.values||[]),base=alternatives(c.axes.base.values.flatMap(b=>[b,...(aliases[b]||[])]));
  return new RegExp(`(?<![a-z0-9])(?:legendarn[a-z]*\\s+)?(?:(?:dobr[a-z]*|doskonal[a-z]*|epick[a-z]*|starozytn[a-z]*)\\s+)?${pre?`(?:(?:${pre})\\s+)?`:''}(?:${base})${suf?`(?:\\s+(?:${suf}))?`:''}(?:\\s*\\(\\s*\\+\\s*\\d+\\s*\\))?(?![a-z0-9])`,'g');
 });patterns.set(data,out);return out;
}
export function cleanInventoryText(raw){
 return String(raw).replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi,'\n').replace(/<\/?(?:br|div|p|tr|td|li|h[1-6])\b[^>]*>/gi,'\n').replace(/<[^>]*>/g,' ').replace(/\[(?:\/?(?:b|i|u|color|size|url)|\*)[^\]]*\]/gi,'').replace(/&(?:nbsp|amp|quot|apos|lt|gt);/gi,m=>({'&nbsp;':' ','&amp;':'&','&quot;':'"','&apos;':"'",'&lt;':'<','&gt;':'>'}[m.toLowerCase()])).replace(/&#(x[\da-f]+|\d+);/gi,(_,n)=>{const v=n[0].toLowerCase()==='x'?parseInt(n.slice(1),16):Number(n);return v>0&&v<=0x10ffff?String.fromCodePoint(v):' ';}).replace(/\\[nrt]/g,'\n').replace(/\u00a0/g,' ').replace(/[\u200b-\u200d\ufeff]/g,'').replace(/\r/g,'\n');
}
export function importInventory(raw,data){
 const items=[],ignored=[];
 if(String(raw).length>500000)return {items,ignored,error:'Wklej maksymalnie 500 tys. znaków naraz.'};
 const source=cleanInventoryText(raw).replace(/(?<![\p{L}\p{N}_])(?:SPRZEDAJ|ZAŁÓŻ|ZDEJMIJ|PRZENIEŚ|USUŃ|WYPOSAŻ|SCHOWAJ)(?![\p{L}\p{N}_])/giu,'\n$&\n').replace(/(?<![\p{L}\p{N}_])(?:WYMAGANIA|CECHY|CENA(?: SPRZEDAŻY)?|MANA|NANITY|OBRONA|OBRAŻENIA|PŁEĆ|STREFA)\s*:/giu,'\n$&').replace(/[;|\t]+/g,'\n');
 const compiled=getPatterns(data);
 for(const [lineIndex,line]of source.split('\n').entries()){
  const original=line.trim();if(!original)continue;
  const clean=original.replace(/\b(?:Leg\.)\s*/gi,'Legendarny ').replace(/\b(?:Dsk\.)\s*/gi,'Doskonały ').replace(/\b(?:Db\.)\s*/gi,'Dobry ').replace(/\(\s*\+\s*(\d+)\s*\)/g,'(+$1)').replace(/\s+/g,' ');
  const s=normalize(clean);
  if(/^(?:cena|wartosc|mana|nanity|wymagania|cechy|obrona|obrazenia|plec|poziom|sila|zwinnosc|odpornosc|wyglad|charyzma|wplywy|wiedza|inteligencja|strefa|rzadkosc)\s*[:\d]/.test(s)){ignored.push({line:lineIndex+1,text:original});continue;}
  const hits=[];
  for(const pattern of compiled){pattern.lastIndex=0;for(const match of s.matchAll(pattern))hits.push({start:match.index,end:match.index+match[0].length});}
  hits.sort((a,b)=>a.start-b.start||b.end-a.end);
  let end=0;const accepted=[];
  for(const hit of hits){
   if(hit.start<end)continue;
   const before=s.slice(end,hit.start),after=s.slice(hit.end);
   // Reject partial unknown names instead of silently turning them into a bare base.
   if(/[a-z]\s+$/.test(before)&&!/(?:przedmiot|item)\s*[:=]\s*$/.test(before)&&!/(?:^|\s)\d+\s*[x×]\s*$/.test(before))continue;
   if(/^\s+[a-z]/.test(after)&&!hits.some(h=>h.start===hit.end+after.match(/^\s+/)[0].length))continue;
   const name=clean.slice(hit.start,hit.end);
   if(Number(name.match(/\(\+(\d+)\)/)?.[1]||0)>5)continue;
   const parsed=parseInventory(name,data);
   if(parsed.errors.length||parsed.items.length!==1)continue;
   const qty=before.match(/(?:^|\s)(\d+)\s*[x×]\s*$/)?.[1];
   const count=qty?Number(qty):1;
   if(!Number.isSafeInteger(count)||count<1){ignored.push({line:lineIndex+1,text:original});continue;}
   if(items.length+count>100)return {items,ignored,error:'Rozpoznano więcej niż 100 sztuk. Zmniejsz wklejaną listę; nic nie zostało zaimportowane.'};
   for(let i=0;i<count;i++)items.push({...parsed.items[0],id:items.length,original:name});
   accepted.push(hit);end=hit.end;
  }
  let rest=clean;for(const hit of [...accepted].reverse())rest=rest.slice(0,hit.start)+' '+rest.slice(hit.end);
  if(rest.replace(/[\s\d.,:#>()[\]{}"'✓☐•*+×=-]/g,'').trim())ignored.push({line:lineIndex+1,text:rest.trim()});
 }
 return {items,ignored,error:items.length?null:'Nie rozpoznano żadnego przedmiotu. Obecny ekwipunek nie został zmieniony.'};
}
