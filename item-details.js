import {composeRecord} from './item-compose.js';
import {normalize,resultKey,itemName,itemGender} from './engine.js';
export const SOURCE='https://r21.bloodwars.pl/test_items.php';
export function itemClass(n){
 if(n.left){const a=itemClass(n.left),b=itemClass(n.right);if(a===null||b===null||a<1||b<1||a>=18||b>=18||a===17&&b===17)return null;const c=Math.min(a,b)+(n.left.base===n.right.base?1:0);return c<18?c:null;}
 const s=normalize(n.original||'');
 if(!s)return null;
 const plus=Number(s.match(/\(\+(\d+)\)/)?.[1]||0);
 if(plus>5)return null;
 const q=/\bstarozytn/.test(s)?24:/\bepick/.test(s)?18:/\bdoskonal/.test(s)?12:/\bdobr/.test(s)?6:0;
 return q+plus;
}
export function qualityLabel(c){return c===null?'Nieustalona jakość':`${['Zwykły','Dobry','Doskonały','Epicki','Starożytny'][Math.floor(c/6)]} (+${c%6})`;}
export const detailKey=(n,c=itemClass(n))=>`${resultKey(n)}|${c}`;
export function officialUrl(n,catalog,c=itemClass(n)){
 const ids=catalog?.[n.category];if(!ids||c===null)return null;
 const base=ids.base[n.base],prefix=n.prefix?ids.prefix[n.prefix]:0,suffix=n.suffix?ids.suffix[n.suffix]:0;
 if(base===undefined||prefix===undefined||suffix===undefined)return null;
 return `${SOURCE}?${new URLSearchParams({class:c,baseType:base,prefix,sufix:suffix,legendary:n.rarity==='legendary'?1:0,playerLvl:80})}`;
}
export function fullItemName(n){
 const c=itemClass(n);if(c===null)return itemName(n);
 const base=itemName({...n,rarity:'normal'});
 const gender=itemGender(n),quality=[['Zwykły','Zwykła','Zwykłe'],['Dobry','Dobra','Dobre'],['Doskonały','Doskonała','Doskonałe'],['Epicki','Epicka','Epickie'],['Starożytny','Starożytna','Starożytne']][Math.floor(c/6)][gender];
 return `${n.rarity==='legendary'?['Legendarny','Legendarna','Legendarne'][gender]+' ':''}${c>=6?quality+' ':''}${base} (+${c%6})`;
}
export function lookupItem(n,details,catalog=details?.catalog){
 const quality=itemClass(n);if(quality===null)return null;
 const known=details?.items?.[detailKey(n)];if(known)return known;
 const group=details?.components?.[n.category];if(!group)return null;
 const rarity=quality>=18?'normal':n.rarity,legendary=rarity==='legendary'?1:0;
 const exact=group.exact?.[`${quality}|${rarity}|${n.base}|${n.prefix}|${n.suffix}`];if(exact)return exact;
 if(!n.prefix&&!n.suffix)return group.rows[`${quality}|${legendary}|base|${n.base}`]||null;
 if(n.base===group.reference&&!(n.prefix&&n.suffix))return group.rows[`${quality}|${legendary}|${n.prefix?'prefix':'suffix'}|${n.prefix||n.suffix}`]||null;
 const cache=group.composed??=new Map(),key=detailKey(n);if(cache.has(key))return cache.get(key);
 const row=composeRecord(n,quality,group,officialUrl(n,catalog),fullItemName(n));cache.set(key,row);return row;
}
export function fusionCost(step,details){
 const left=lookupItem(step.left,details),right=lookupItem(step.right,details);
 const a=itemClass(step.left),b=itemClass(step.right);
 // Do not price unvalidated epic fusion rules or unupgraded ingredients.
 if(!left||!right||a===null||b===null||a<1||b<1||a>=18||b>=18||a===17&&b===17)return null;
 return {mana:left.mana+right.mana,nanites:left.nanites+right.nanites};
}
