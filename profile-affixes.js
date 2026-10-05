import {assessAffixes} from './strong-combos.js';
import {lookupItem} from './item-details.js';

// Weapon and armour restrictions: https://wiki.bloodwars.pl/index.php?title=Tatua%C5%BCe
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

// Historical examples with a named tattoo and an item base. These show use, not a DPS ranking.
const monk='https://forum.bloodwars.pl/thread.php?postid=3606171';
const monkBuild='https://forum.bloodwars.pl/thread.php?postid=5931179';
const treasure='https://forum.bloodwars.pl/print.php?threadid=1321636&page=1';
const demon='https://forum.bloodwars.pl/thread.php?threadid=326006';
const knight='https://forum.bloodwars.pl/print.php?threadid=1293917&page=2';
export const tattooExamples=[
 {tattoo:'zabojca',category:'head',bases:['czapka'],prefix:'tygrysi',suffix:'adrenaliny',url:'https://forum.bloodwars.pl/thread.php?threadid=1112793'},
 {tattoo:'mnich',category:'head',bases:['czapka'],prefix:'tygrysi',suffix:'adrenaliny',url:monk},
 {tattoo:'mnich',category:'chest',bases:['koszulka'],prefix:'tygrysi',suffix:'szybkosci',url:monk},
 {tattoo:'mnich',category:'chest',bases:['peleryna'],prefix:'elfi',suffix:'szybkosci',url:monkBuild},
 {tattoo:'mnich',category:'melee1',bases:['piesc niebios'],prefix:'szybki',suffix:'samobojcy',url:monkBuild},
 {tattoo:'mnich',category:'melee1',bases:['piesc niebios'],prefix:'demoniczny',suffix:'samobojcy',url:monkBuild},
 {tattoo:'mnich',category:'neck',bases:['amulet','krawat'],prefix:'tytanowy',suffix:'celnosci',url:monk},
 {tattoo:'mnich',category:'rings',bases:['pierscien'],prefix:'tytanowy',suffix:'celnosci',url:monk},
 {tattoo:'berserker',category:'head',bases:['bandana'],prefix:'tygrysi',suffix:'adrenaliny',url:'https://forum.bloodwars.pl/thread.php?postid=6314866'},
 {tattoo:'czarny_rycerz',category:'head',bases:['helm'],prefix:'tygrysi',suffix:'adrenaliny',url:'https://forum.bloodwars.pl/thread.php?postid=4322588'},
 {tattoo:'czarny_rycerz',category:'melee2',bases:['katana'],prefix:'zwinny',suffix:'krwiopijcy',url:knight},
 {tattoo:'rewolwerowiec',category:'head',bases:['helm'],prefix:'smiercionosny',suffix:'kary',url:'https://forum.bloodwars.pl/print.php?threadid=141612&page=1'},
 {tattoo:'wladca_demonow',category:'legs',bases:['szorty'],prefix:'elfie',suffix:'pasterza',url:demon},
 {tattoo:'wladca_demonow',category:'ranged',bases:['shurek'],suffix:'reakcji',url:demon},
 {tattoo:'wladca_demonow',category:'rings',bases:['bransoleta'],prefix:'jastrzebi',url:demon},
 {tattoo:'lowca_skarbow',category:'head',bases:['bandana','maska'],prefix:'smiercionosny',suffix:'prekognicji',url:treasure},
 {tattoo:'lowca_skarbow',category:'head',bases:['bandana'],prefix:'runiczny',suffix:'prekognicji',url:treasure},
 {tattoo:'lowca_skarbow',category:'chest',bases:['peleryna'],prefix:'elfi',suffix:'siewcy smierci',url:treasure},
 {tattoo:'lowca_skarbow',category:'legs',bases:['kilt','szorty'],prefix:'elfie',suffix:'unikow',url:treasure},
 {tattoo:'lowca_skarbow',category:'neck',bases:['krawat'],prefix:'tytanowy',suffix:'celnosci',url:treasure},
 {tattoo:'lowca_skarbow',category:'rings',bases:['bransoleta'],prefix:'tytanowy',suffix:'celnosci',url:treasure},
 {tattoo:'lowca_skarbow',category:'ranged',bases:['shurek'],suffix:'reakcji',url:treasure},
 {tattoo:'lowca_skarbow',category:'ranged',bases:['noz do rzucania'],suffix:'driady',url:treasure},
 {tattoo:'lowca',category:'chest',bases:['peleryna'],prefix:'elfi',suffix:'siewcy smierci',url:'https://forum.bloodwars.pl/print.php?threadid=612715&page=1'},
 {tattoo:'lowca',category:'ranged',bases:['shurek'],suffix:'reakcji',url:'https://forum.bloodwars.pl/thread.php?threadid=1214439'},
 {tattoo:'snajper',category:'head',bases:['bandana'],prefix:'smiercionosny',suffix:'prekognicji',url:'https://forum.bloodwars.pl/thread.php?threadid=548746'},
 {tattoo:'gangster',category:'rings',bases:['pierscien'],prefix:'sloneczny',suffix:'madrosci',url:'https://forum.bloodwars.pl/thread.php?postid=8561556'}
];

const armourSlot={head:0,chest:1,legs:2};
export function itemDefense(item,details,catalog){
 if(armourSlot[item?.category]===undefined||!details?.components?.[item.category])return null;
 const line=lookupItem(item,details,catalog)?.lines?.find(value=>/^Obrona:\s*-?\d+/.test(value));
 const match=line?.match(/^Obrona:\s*(-?\d+)/);
 return match?Number(match[1]):null;
}
function possibleArmour(item,tattoo,defense){
 const slot=armourSlot[item?.category];if(slot===undefined)return true;
 if(!Number.isFinite(defense))return false;
 const path=tattoos[tattoo];
 return (path.min?.[slot]===undefined||defense>=path.min[slot])&&(path.max?.[slot]===undefined||defense<=path.max[slot]);
}
export function assessProfileAffixes(item,profile={},defense){
 const tattoo=profile.tattoo;
 if(!tattoos[tattoo]||!item)return {pair:null,prefix:[],suffix:[],examples:[],rank:0};
 const examples=tattooExamples.filter(example=>example.tattoo===tattoo&&example.category===item.category&&(!example.bases||example.bases.includes(item.base))&&(!example.prefix||example.prefix===item.prefix)&&(!example.suffix||example.suffix===item.suffix)&&possibleArmour(item,tattoo,defense));
 const base=assessAffixes(item);
 const pairExample=examples.find(example=>example.prefix&&example.suffix);
 const pair=pairExample?base.pair||pairExample:null;
 const prefix=examples.some(example=>example.prefix)?base.prefix.length?base.prefix:examples:[];
 const suffix=examples.some(example=>example.suffix)?base.suffix.length?base.suffix:examples:[];
 return {pair,prefix,suffix,examples,rank:pair?3:Number(prefix.length>0)+Number(suffix.length>0)};
}
