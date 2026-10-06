import {itemClass} from './engine.js';
import {parsedRecord} from './item-compose.js';

// Relative combat utility, not market value or a damage formula. Affixes are
// compared with alternatives in the same category, quality and rarity.
const paths={zabojca:'melee',mnich:'melee',berserker:'melee',czarny_rycerz:'melee',rewolwerowiec:'gun',gangster:'gun',snajper:'gun',wladca_demonow:'ranged',lowca_skarbow:'ranged',lowca:'ranged'};
const weapons={melee1:'melee',melee2:'melee',gun1:'gun',gun2:'gun',ranged:'ranged'};
const statLabels={'ZWINNOŚĆ':'zwinność','SPOSTRZEGAWCZOŚĆ':'spostrzegawczość','SIŁA':'siła','WIEDZA':'wiedza','INTELIGENCJA':'inteligencja','ODPORNOŚĆ':'odporność','SZCZĘŚCIE':'szczęście'};
const thresholdCache=new WeakMap();
// Affix labels describe the affix, not the item's current upgrade/quality.
// Use one catalog snapshot for ranking so the same prefix/suffix keeps its
// label when the item is upgraded or has a different quality tier.
const rankingQuality=11; // Dobry (+5), standard (non-legendary) catalog row.
const empty=()=>({pair:null,prefix:[],suffix:[],rank:0,score:0,totalScore:0});
const kindFor=(category,profile)=>weapons[category]||paths[profile?.tattoo]||'general';
const setFamily=prefix=>({tygrysi:'tygrys',tygrysie:'tygrys',elfi:'elf',elfie:'elf',runiczny:'runicz',runiczne:'runicz'})[prefix]||prefix;
function completesPotentialSet(item,inventory){
 if(!item.prefix||!inventory?.length)return false;
 const family=setFamily(item.prefix),others=inventory.filter(part=>part!==item&&(item.id===undefined||part.id!==item.id)&&setFamily(part.prefix)===family);
 if(['head','chest','legs'].includes(item.category))return ['head','chest','legs'].every(slot=>slot===item.category||others.some(part=>part.category===slot));
 if(item.category==='neck')return others.filter(part=>part.category==='rings').length>=2;
 if(item.category==='rings')return others.some(part=>part.category==='neck')&&others.some(part=>part.category==='rings');
 return false;
}
function weight(key,kind,race,category,profile){
 const melee=kind==='melee',gun=kind==='gun',ranged=kind==='ranged';
 if(key==='ZWINNOŚĆ {+}')return melee?.72:ranged?.53:gun?.12:.46;
 if(key==='SPOSTRZEGAWCZOŚĆ {+}')return gun?.72:ranged?.53:melee?.09:.43;
 if(key==='SIŁA {+}')return melee?.28:.09;
 if(key==='WIEDZA {+}')return ranged?.33:gun?.13:.14;
 if(key==='INTELIGENCJA {+}')return ranged?.16:.08;
 if(key==='ODPORNOŚĆ {+}')return .13;
 if(key==='SZCZĘŚCIE {+}')return profile?.tattoo==='lowca_skarbow'?.32:race==='lapacz'?.14:race==='kultysta'?.17:.2;
 if(key==='PKT KRWI {+} %')return ['kultysta','ssak','potepiony'].includes(race)?.1:.15;
 if(key==='trafienie {+}'||key==='trafienie wszystkich broni {+}'||key==='szansa trafienia bronią białą {+}')return race==='potepiony'||race==='wladca'&&melee?.13:.25;
 if(key.startsWith('szansa trafienia krytycznego'))return key.includes('bronią palną')&&!gun?0:profile?.tattoo==='berserker'?.8:.65;
 if(key.startsWith('szansa trafienia bronią zwiększona'))return .45;
 if(key.startsWith('łączne obrażenia broni'))return 1.3;
 if(key.startsWith('modyfikator obrażeń od trafienia krytycznego'))return .3;
 if(weapons[category]&&/^(obrażenia broni|obrażenia minimalne|obrażenia maksymalne) \{[+n]\}/.test(key))return 0;
 if(key.startsWith('obrażenia')&&!key.includes('przedmiotu'))return key.includes('na każde')?2.5:1.2;
 if(key==='ilość ataków na rundę: {n}'||key==='ilość dodatkowych ataków każdą bronią: {n}')return category.startsWith('gun')?38:profile?.tattoo==='mnich'?54:48;
 if(key==='ignoruje {n} % obrony przeciwnika')return .9;
 if(key==='PKT ŻYCIA (bazowe i z budynków) {+} %'||key==='bazowe PKT ŻYCIA {+} %')return race==='ssak'||race==='wladca'?.32:.4;
 if(key==='obrona przedmiotu {+}')return profile?.tattoo==='czarny_rycerz'?.35:.08;
 if(key==='twardość {+} %'||key==='unik {+} %')return .35;
 if(key==='łatwość {+} %')return race==='ssak'?.08:.13;
 return 0;
}
function statScore(part,reference,kind,race,category,profile){
 const a=parsedRecord(part),b=parsedRecord(reference),changes=[];
 let score=0;
 for(const key of new Set([...Object.keys(a.features),...Object.keys(b.features)])){
  if(key.includes('(niekompletny)'))continue;
  const delta=(a.features[key]||0)-(b.features[key]||0);if(!delta)continue;
  if(key.startsWith('@maksymalna obrona')){score+=profile?.tattoo==='mnich'||profile?.tattoo==='berserker'?8:profile?.tattoo==='czarny_rycerz'?-35:-5;continue;}
  if(key.startsWith('@przeciwnik nie atakuje')){score+=12;changes.push({impact:12,label:'brak ataku przeciwnika w pierwszej rundzie zasadzki',delta:1});continue;}
  const w=weight(key,kind,race,category,profile);
  if(w){score+=delta*w;if(Math.abs(delta*w)>2)changes.push({impact:delta*w,label:statLabels[key.replace(' {+}','')]||key.replace(/ \{[+n]\}.*/,''),delta});}
 }
 if(a.damage&&b.damage){const delta=((a.damage[0]+a.damage[1])-(b.damage[0]+b.damage[1]))/2;score+=delta*.9;if(Math.abs(delta)>3)changes.push({impact:delta*.9,label:'obrażenia broni',delta});}
 return {score,changes:changes.sort((x,y)=>Math.abs(y.impact)-Math.abs(x.impact))};
}
function parts(item,details){
 if(!item)return null;
 const group=details?.components?.[item?.category],quality=itemClass(item);
 // Imported inventory names often omit (+N), which means ordinary +0.
 // Affix ranking uses the fixed reference quality, so +0 needs no special
 // catalog row; only its base-stat contribution may be unavailable.
 if(!group||quality===null)return null;
 const actualLegendary=item.rarity==='legendary'&&quality<18?1:0;
 const actualReference=group.rows[`${quality}|${actualLegendary}|base|${group.reference}`];
 const reference=group.rows[`${rankingQuality}|0|base|${group.reference}`];
 return reference?{group,q:rankingQuality,legendary:0,reference,actualReference,quality,actualLegendary}:null;
}
function rankPart(axis,value,context,kind,profile,item){
 if(!value)return null;
 const {group,q,legendary,reference}=context;
 const row=group.rows[`${q}|${legendary}|${axis}|${value}`];if(!row)return null;
 const race=profile?.race,assessed=statScore(row,reference,kind,race,item.category,profile);
 let cache=thresholdCache.get(group);if(!cache){cache=new Map();thresholdCache.set(group,cache);}
 const cacheKey=`${q}|${legendary}|${axis}|${kind}|${race||''}|${profile?.tattoo||''}`;
 let scores=cache.get(cacheKey);
 if(!scores){
  scores=Object.entries(group.rows).filter(([key])=>key.startsWith(`${q}|${legendary}|${axis}|`)).map(([,part])=>statScore(part,reference,kind,race,item.category,profile).score).filter(n=>n>0).sort((a,b)=>b-a);
  cache.set(cacheKey,scores);
 }
 const cutoff=scores[Math.min(scores.length-1,Math.max(0,Math.ceil(scores.length*.3)-1))]??Infinity;
 const good=assessed.score>0&&assessed.score>=cutoff;
 const top=assessed.changes.slice(0,2).map(c=>`${c.label} ${c.delta>0?'+':''}${c.delta}`);
 return {good,score:assessed.score,cutoff,reason:`Przyrost względem przedmiotu bez ${axis==='prefix'?'prefiksu':'sufiksu'}: ${top.join(', ')||'cechy bojowe'}. Ocena afiksu niezależna od jakości i ulepszenia przedmiotu.`};
}
export function assessAffixes(item,details,profile={},inventory=[]){
 const context=parts(item,details);if(!context)return empty();
 const kind=kindFor(item.category,profile);
 const p=rankPart('prefix',item.prefix,context,kind,profile,item),s=rankPart('suffix',item.suffix,context,kind,profile,item);
 if(p&&completesPotentialSet(item,inventory)){
  const part=context.group.rows[`${context.q}|${context.legendary}|prefix|${item.prefix}`];
  if(Object.keys(parsedRecord(part).features).some(key=>key.includes('(niekompletny)'))){
   if(p.score>0){
    p.score+=10;
    p.good=p.good||p.score>=p.cutoff;
    if(p.good)p.reason+=' Inne części na liście mogą utworzyć zestaw; jego bonus nie jest liczony jako aktywny.';
   }
  }
 }
 const prefix=p?.good?[p]:[],suffix=s?.good?[s]:[];
 const pair=prefix.length&&suffix.length?{reason:`Oba afiksy należą do najlepszych 30% w tej kategorii. ${p.reason} ${s.reason}`}:null;
 const base=context.group.rows[`${context.quality}|${context.actualLegendary}|base|${item.base}`];
 const baseScore=base&&context.actualReference?statScore(base,context.actualReference,kind,profile.race,item.category,profile).score:0;
 const score=Math.max(0,p?.score||0)+Math.max(0,s?.score||0);
 return {pair,prefix,suffix,rank:pair?3:Number(prefix.length>0)+Number(suffix.length>0),score,totalScore:score+baseScore};
}
export function isStrongCombo(item,details,profile,inventory){return !!assessAffixes(item,details,profile,inventory).pair;}
