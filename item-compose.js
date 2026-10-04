import {resolveRequirements} from './item-requirements.js';
const number=s=>Number(String(s).replace(/\s/g,''));
export function featureMap(line){
 const out={};
 for(const raw of line.replace(/^Cechy:\s*/,'').split(/\s*,\s*/)){
  const s=raw.trim();if(!s||s==='-')continue;
  const m=s.match(/[+-]\d+(?:\.\d+)?/)||s.match(/\d+(?:\.\d+)?/);
  if(!m||m[0]==='0'&&!/^[+-]/.test(m[0])){out['@'+s]=1;continue;}
  const signed=/^[+-]/.test(m[0]),key=s.slice(0,m.index)+(signed?'{+}':'{n}')+s.slice(m.index+m[0].length);
  out[key]=(out[key]||0)+Number(m[0]);
 }
 return out;
}
export function requirementMap(line){const out={};for(const m of line.replace(/^Wymagania:\s*/,'').matchAll(/([^,:]+):\s*(-?\d+)/g))out[m[1].trim()]=Number(m[2]);return out;}
export function parsedRecord(row){
 if(row.parsed)return row.parsed;
 const features=featureMap(row.lines.find(x=>x.startsWith('Cechy:'))||''),requirements=requirementMap(row.lines.find(x=>x.startsWith('Wymagania:'))||'');
 if(row.lines[0].startsWith('Broń')&&!('ilość ataków na rundę: {n}' in features))features['ilość ataków na rundę: {n}']=1;
 const armor=row.lines.find(x=>x.startsWith('Obrona:'))?.match(/-?\d+/)?.[0];
 const damage=row.lines.find(x=>x.startsWith('Obrażenia:'))?.match(/Obrażenia:\s*(-?\d+)\s*-\s*(-?\d+)/);
 const money=row.lines.find(x=>x.startsWith('Cena:'))||'';
 return row.parsed={features,requirements,armor:armor===undefined?null:Number(armor),damage:damage?[Number(damage[1]),Number(damage[2])]:null,price:number(money.match(/^Cena:\s*([\d\s]+)/)?.[1]||0),sale:number(money.match(/Cena sprzedaży:\s*([\d\s]+)/)?.[1]||0)};
}
function addMaps(rows,field){const out={};for(const [row,weight]of rows)for(const [k,v]of Object.entries(parsedRecord(row)[field]))out[k]=(out[k]||0)+v*weight;return out;}
const fvalue=(map,key)=>map[key]||0;
export function composeRecord(n,quality,group,url,name){
 if(!group||quality===null)return null;
 const exact=group.exact?.[`${quality}|${quality>=18?'normal':n.rarity}|${n.base}|${n.prefix}|${n.suffix}`];if(exact)return exact;
 const legendary=n.rarity==='legendary'&&quality<18?1:0;
 const get=(axis,value,rarity=legendary)=>group.rows[`${quality}|${rarity}|${axis}|${value}`];
 const base=get('base',n.base),reference=get('base',group.reference),prefix=n.prefix?get('prefix',n.prefix):null,suffix=n.suffix?get('suffix',n.suffix):null;
 if(!base||!reference||n.prefix&&!prefix||n.suffix&&!suffix)return null;
 const terms=[[base,1],...(prefix?[[prefix,1],[reference,-1]]:[]),...(suffix?[[suffix,1],[reference,-1]]:[])];
 const features=addMaps(terms,'features');
 // Legendary requirements are rounded after combining all normal components.
 const normalTerms=legendary?[[get('base',n.base,0),1],...(prefix?[[get('prefix',n.prefix,0),1],[get('base',group.reference,0),-1]]:[]),...(suffix?[[get('suffix',n.suffix,0),1],[get('base',group.reference,0),-1]]:[])]:terms;
 if(normalTerms.some(([row])=>!row))return null;
 let requirements=addMaps(normalTerms,'requirements');
 const normalRef=parsedRecord(get('base',group.reference,0)).requirements;
 for(const axis of ['prefix','suffix'])if(n[axis]){
  const corrections=group.requirementDeltas?.[`${quality}|${axis}|${n[axis]}`],part=parsedRecord(get(axis,n[axis],0)).requirements;
  for(const [field,value]of Object.entries(corrections||{}))requirements[field]=(requirements[field]||0)+value-((part[field]||0)-(normalRef[field]||0));
 }
 if(legendary){for(const k of Object.keys(requirements))requirements[k]=Math.ceil(requirements[k]*.8);requirements['Postać musi być w akcie']=2;}
 const calibrated=quality>=18?resolveRequirements(n,quality,group.requirementModels?.[quality]):null;
 const partialRequirements=quality>=18&&!calibrated;
 if(calibrated)requirements=calibrated;
 const bp=parsedRecord(base),delta=addMaps(terms.slice(1),'features');
 const levelBonus=pattern=>Object.entries(delta).reduce((sum,[key,value])=>{const m=key.match(pattern);return sum+(m?Math.floor(80/Number(m[1]))*value:0);},0);
 const armorLevel=levelBonus(/^obrona przedmiotu zwiększona o \{n\} na każde (\d+) poziomy postaci$/),damageLevel=levelBonus(/^obrażenia zwiększone o \{n\} na każde (\d+) poziomy postaci$/);
 const armor=bp.armor===null?null:Math.ceil((bp.armor+armorLevel+fvalue(delta,'obrona przedmiotu {+}'))*(1+fvalue(delta,'obrona przedmiotu {+} %')/100));
 const damage=bp.damage?.map((d,i)=>Math.ceil((d+damageLevel+fvalue(delta,'obrażenia broni {+}')+fvalue(delta,i?'obrażenia maksymalne {+}':'obrażenia minimalne {+}'))*(1+fvalue(delta,'obrażenia broni {+} %')/100)));
 const featureText=Object.entries(features).filter(([k,v])=>v!==0).map(([k,v])=>k.startsWith('@')?k.slice(1):k.replace('{+}',v>=0?'+'+v:String(v)).replace('{n}',String(v))).join(', ')||'-';
 const requirementText=Object.entries(requirements).filter(([,v])=>v>0).map(([k,v])=>`${k}: ${v}`).join(', ')||'-';
 const mana=terms.reduce((sum,[r,w])=>sum+r.mana*w,0),nanites=terms.reduce((sum,[r,w])=>sum+r.nanites*w,0),price=terms.reduce((sum,[r,w])=>sum+parsedRecord(r).price*w,0),sale=terms.reduce((sum,[r,w])=>sum+parsedRecord(r).sale*w,0);
 return {name,url,mana,nanites,composed:true,partialRequirements,lines:[base.lines[0],...(armor===null?[]:[`Obrona: ${armor}`]),...(damage?[`Obrażenia: ${damage[0]} - ${damage[1]}`]:[]),`Cechy: ${featureText}`,partialRequirements?'Wymagania: brak jednoznacznych danych dla tego wariantu w lokalnym katalogu.':`Wymagania: ${requirementText}`,`Cena: ${price} PLN ; Cena sprzedaży: ${sale} PLN ; Mana: ${mana} ; Nanity: ${nanites}`]};
}
