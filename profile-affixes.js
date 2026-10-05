import {assessAffixes} from './strong-combos.js';

// Weapon and armour restrictions: https://wiki.bloodwars.pl/index.php?title=Tatua%C5%BCe
export const tattoos={
 zabojca:{label:'Zabójca',weapons:['melee1','gun2'],armour:'max 7/15/7–50/80/50'},
 rewolwerowiec:{label:'Rewolwerowiec',weapons:['gun1'],armour:'max 10/20/10–55/120/55'},
 gangster:{label:'Gangster',weapons:['gun1'],armour:'bez minimum obrony'},
 wladca_demonow:{label:'Władca demonów',weapons:['ranged'],armour:'min 5/8/5–25/40/25'},
 mnich:{label:'Mnich',weapons:['melee1'],armour:'max 0/0/0'},
 berserker:{label:'Berserker',weapons:['melee1','melee2'],armour:'max 0/0/0'},
 czarny_rycerz:{label:'Czarny rycerz',weapons:['melee2'],armour:'min 6/9/6–30/60/30'},
 snajper:{label:'Snajper',weapons:['gun2'],armour:'max 10/20/10–55/120/55'},
 lowca_skarbow:{label:'Łowca skarbów',weapons:['gun1','ranged'],armour:'min 5/8/5–25/40/25'},
 lowca:{label:'Łowca',weapons:['ranged'],armour:'min 1/3/1–5/15/5'}
};
export const races={
 lapacz:{label:'Łapacz Myśli',bonus:'Szczęście +10'},
 wladca:{label:'Władca Zwierząt',bonus:'PŻ +20%, trafienie białą +20'},
 kultysta:{label:'Kultysta',bonus:'Szczęście +5, punkty krwi +10%'},
 ssak:{label:'Ssak',bonus:'PŻ +10%, punkty krwi +10%, łatwość +5%'},
 potepiony:{label:'Potępiony',bonus:'Punkty krwi +10%, trafienie wszystkich broni +30'}
};

const melee=['zabojca','mnich','berserker','czarny_rycerz'];
const ranged=['wladca_demonow','lowca_skarbow','lowca'];
const gun=['rewolwerowiec','gangster','snajper','zabojca'];
function relevant(rule,item,tattoo){
 if(!tattoo)return true;
 if(!tattoos[tattoo])return false;
 const category=item?.category;
 if(category==='melee1')return ['zabojca','mnich','berserker'].includes(tattoo);
 if(category==='melee2')return ['berserker','czarny_rycerz'].includes(tattoo);
 if(category==='ranged')return ranged.includes(tattoo);
 if(['head','chest','legs'].includes(category)){
  if(rule.source==='melee'||rule.source==='twoHanded')return ['zabojca','czarny_rycerz'].includes(tattoo);
  if(rule.source==='hunter')return ranged.includes(tattoo);
  return false;
 }
 if(['rings','neck'].includes(category)){
  if(rule.source==='twoHanded')return ['berserker','czarny_rycerz'].includes(tattoo);
  if(rule.source==='gunner')return gun.includes(tattoo);
  if(rule.source==='hunter')return ranged.includes(tattoo);
  return rule.source==='expedition';
 }
 return false;
}
function raceMatch(rule,item,race){
 if(!race||!races[race])return false;
 if(race==='wladca')return ['melee1','melee2'].includes(item.category)&&['melee','twoHanded','weapons'].includes(rule.source);
 if(race==='lapacz'||race==='kultysta')return /szczęści|wypraw/i.test(rule.reason);
 if(race==='potepiony')return /zasięg|trafieni|celnoś/i.test(rule.reason);
 if(race==='ssak')return /wymagani|łatwoś/i.test(rule.reason);
 return false;
}
export function assessProfileAffixes(item,profile={}){
 const base=assessAffixes(item),tattoo=profile.tattoo||'',race=profile.race||'';
 const pair=base.pair&&relevant(base.pair,item,tattoo)?base.pair:null;
 const prefix=base.prefix.filter(rule=>relevant(rule,item,tattoo));
 const suffix=base.suffix.filter(rule=>relevant(rule,item,tattoo));
 const raceAffinity=[pair,...prefix,...suffix].some(rule=>rule&&raceMatch(rule,item,race));
 return {pair,prefix,suffix,raceAffinity,rank:pair?3:Number(prefix.length>0)+Number(suffix.length>0)};
}
