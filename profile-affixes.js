import {assessAffixes} from './strong-combos.js';
import {lookupItem} from './item-details.js';

// Requirements already transcribed into the project from the game encyclopedia.
// The min/max values cover tattoo levels 1–5; the individual levels are unknown.
export const tattoos={
 zabojca:{label:'Zabójca',weapons:['melee1','gun2'],armour:'max 7/15/7–50/80/50',max:[50,80,50]},
 rewolwerowiec:{label:'Rewolwerowiec',weapons:['gun1'],armour:'max 10/20/10–55/120/55',max:[55,120,55]},
 gangster:{label:'Gangster',weapons:['gun1'],armour:'min 0/0/0',min:[0,0,0]},
 wladca_demonow:{label:'Władca demonów',weapons:['ranged'],armour:'min 5/8/5–25/40/25',min:[5,8,5]},
 mnich:{label:'Mnich',weapons:['melee1'],armour:'max 0/0/0',max:[0,0,0]},
 berserker:{label:'Berserker',weapons:['melee1','melee2'],armour:'max 0/0/0',max:[0,0,0]},
 czarny_rycerz:{label:'Czarny rycerz',weapons:['melee2'],armour:'min 6/9/6–30/60/30',min:[6,9,6]},
 snajper:{label:'Snajper',weapons:['gun2'],armour:'max 10/20/10–55/120/55',max:[55,120,55]},
 lowca_skarbow:{label:'Łowca skarbów',weapons:['gun1','ranged'],armour:'min 5/8/5–25/40/25',min:[5,8,5]},
 lowca:{label:'Łowca',weapons:['ranged'],armour:'min 1/3/1–5/15/5',min:[1,3,1]}
};
export const races={
 lapacz:{label:'Łapacz Myśli',bonus:'Szczęście +10'},
 wladca:{label:'Władca Zwierząt',bonus:'PŻ +20%, trafienie białą +20'},
 kultysta:{label:'Kultysta',bonus:'Szczęście +5, punkty krwi +10%'},
 ssak:{label:'Ssak',bonus:'PŻ +10%, punkty krwi +10%, łatwość +5%'},
 potepiony:{label:'Potępiony',bonus:'Punkty krwi +10%, trafienie wszystkich broni +30'}
};
const armourSlot={head:0,chest:1,legs:2};
const weaponCategories=new Set(['melee1','melee2','gun1','gun2','ranged']);
export function requiredSex(item,details,catalog){
 if(!item)return null;
 const base=details?.components?.[item.category]?.rows?.[`0|0|base|${item.base}`];
 const line=(base||lookupItem(item,details,catalog))?.lines?.[0]||'';
 const requirement=line.match(/PŁEĆ\s*:\s*([^)]*)/i)?.[1]?.trim();
 if(!requirement)return null;
 if(/tylko dla kobiet/i.test(requirement))return 'female';
 if(/tylko dla mężczyzn/i.test(requirement))return 'male';
 return /dowolna/i.test(requirement)?'any':null;
}
export function possibleForSex(item,sex,details,catalog){
 if(!sex||!['male','female'].includes(sex))return true;
 const required=requiredSex(item,details,catalog);
 return required===null||required==='any'||required===sex;
}
export function itemDefense(item,details,catalog){
 if(armourSlot[item?.category]===undefined||!details?.components?.[item.category])return null;
 const line=lookupItem(item,details,catalog)?.lines?.find(value=>/^Obrona:\s*-?\d+/.test(value));
 const match=line?.match(/^Obrona:\s*(-?\d+)/);
 return match?Number(match[1]):null;
}
export function possibleForTattoo(item,tattoo,details,catalog){
 const path=tattoos[tattoo];if(!path||!item)return false;
 if(weaponCategories.has(item.category))return path.weapons.includes(item.category);
 const slot=armourSlot[item.category];if(slot===undefined)return true;
 const defense=itemDefense(item,details,catalog);
 return Number.isFinite(defense)&&(path.min?.[slot]===undefined||defense>=path.min[slot])&&(path.max?.[slot]===undefined||defense<=path.max[slot]);
}
export function assessProfileAffixes(item,profile={},details,catalog,inventory=[]){
 if(!profile.tattoo&&!profile.race)return {pair:null,prefix:[],suffix:[],rank:0,score:0,totalScore:0,compatible:false};
 if(!possibleForSex(item,profile.sex,details,catalog))return {pair:null,prefix:[],suffix:[],rank:0,score:0,totalScore:0,compatible:false};
 if(profile.tattoo&&!possibleForTattoo(item,profile.tattoo,details,catalog))return {pair:null,prefix:[],suffix:[],rank:0,score:0,totalScore:0,compatible:false};
 return {...assessAffixes(item,details,profile,inventory),compatible:true};
}
