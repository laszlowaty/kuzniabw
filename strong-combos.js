// Curated Moria examples, reviewed 2026-10-04. Scope and sources: AFFIXES.md.
// Build hints, not a price/DPS ranking or a Cartesian product of good affixes.
export const recommendationSources={
 melee:{label:'Moria: wyposażenie mnicha i białej',url:'https://forum.bloodwars.pl/thread.php?threadid=1341473'},
 hunter:{label:'Moria: łowca skarbów, dystans i runiczny zestaw',url:'https://forum.bloodwars.pl/thread.php?threadid=1321636'},
 twoHanded:{label:'Moria: porównanie Berserkera i Czarnego rycerza',url:'https://forum.bloodwars.pl/print.php?threadid=1293917&page=2'},
 weapons:{label:'Moria: przykłady wykonanych broni 1H',url:'https://forum.bloodwars.pl/thread.php?postid=8477132'},
 gunner:{label:'Moria: wyposażenie gangstera',url:'https://forum.bloodwars.pl/thread.php?postid=8561556'},
 expedition:{label:'Moria: przykłady zestawów bojowych i wyprawowych',url:'https://forum.bloodwars.pl/thread.php?threadid=326006'}
};

const pairRules=[
 ['head','tygrysi',['adrenaliny'],'Biała: zwinność i ofensywa; uwzględnij bonus całego tygrysiego zestawu.','melee'],
 ['head','smiercionosny',['prekognicji','kary'],'Dystans: warianty ofensywnego nakrycia głowy.','hunter'],
 ['head','runiczny',['prekognicji'],'Runiczny zestaw: szczęście i zastosowania obronne; szczególnie build łowcy skarbów.','hunter'],
 ['chest','tygrysi',['szybkosci'],'Biała: dodatkowe ataki; dobierz bazę i zestaw do tatuażu.','melee'],
 ['chest','elfi',['szybkosci'],'Biała: zwinność i dodatkowe ataki.','melee'],
 ['chest','elfi',['siewcy smierci'],'Zasięg i obrażenia: przykład dla dystansu i białej 2H.','hunter'],
 ['chest','runiczny',['siewcy smierci'],'Runiczny zestaw dla łowcy skarbów; liczy się komplet i reszta buildu.','hunter'],
 ['legs','tygrysie',['nocy'],'Biała: element tygrysiego zestawu bojowego.','melee'],
 ['legs','elfie',['unikow'],'Zwinność i obrona w zasadzce; przykład wyposażenia dystansowego.','hunter'],
 ['legs','elfie',['pasterza'],'Dystans: zwinność i spostrzegawczość pomagają budować zasięg.','hunter'],
 ['legs','runiczne',['nocy','unikow'],'Runiczny zestaw: warianty do walki, zależne od przeciwnika.','hunter'],
 ['melee1','szybki',['samobojcy'],'Biała 1H: ataki i obrażenia kosztem obrony z przedmiotów.','weapons'],
 ['melee1','demoniczny',['samobojcy'],'Biała 1H: ofensywny wariant kosztem obrony z przedmiotów.','weapons'],
 ['melee2','demoniczny',['krwiopijcy'],'Biała 2H: wariant obrażeń; w przykładzie łączony z mściwym zestawem.','twoHanded'],
 ['melee2','zwinny',['krwiopijcy'],'Biała 2H: wariant zasięgu; w przykładzie łączony z tytanowym zestawem.','twoHanded'],
 ...['rings','neck'].flatMap(category=>[
  [category,'tytanowy',['celnosci'],'Tytanowy zestaw z dodatkową zwinnością pod zasięg.','hunter'],
  [category,'tytanowy',['wladzy'],'Tytanowy zestaw z charyzmą; wariant użytkowy zależny od rodzaju walki.','hunter'],
  [category,'sloneczny',['koncentracji'],'Palna: wariant do zestawu słonecznego. Bonus zestawu wymaga kompletu.','gunner'],
  [category,'tanczacy',['szczescia'],'Wyprawy: zestaw do szczęścia, nie uniwersalny sprzęt bojowy.','expedition']
 ])
];

export const strongCombos={};
const pairs=new Map(),prefixes=new Map(),suffixes=new Map();
const key=(category,affix)=>`${category}|${affix}`;
function add(map,k,rule){const entries=map.get(k)||[];entries.push(rule);map.set(k,entries);}
for(const [category,prefix,values,reason,source] of pairRules){
 const rule={reason,source};
 (strongCombos[category]??={})[prefix]=[...(strongCombos[category][prefix]||[]),...values];
 add(prefixes,key(category,prefix),rule);
 for(const suffix of values){
  pairs.set(`${category}|${prefix}|${suffix}`,rule);
  add(suffixes,key(category,suffix),rule);
 }
}
// Standalone affixes, including ranged weapons which have no prefix axis.
for(const category of ['rings','neck']){
 add(prefixes,key(category,'jastrzebi'),{reason:'Dystans: element jastrzębiego zestawu; sufiks dobierz do zasięgu lub obrażeń.',source:'hunter'});
 add(prefixes,key(category,'msciwy'),{reason:'Biała 2H: element mściwego zestawu; oceniaj po skompletowaniu biżuterii.',source:'twoHanded'});
 add(suffixes,key(category,'mlodosci'),{reason:'Zasięg: sufiks rozważany na etapie budowy ekwipunku dystansowego.',source:'hunter'});
}
for(const suffix of ['reakcji','driady','wilka'])add(suffixes,key('ranged',suffix),{
 reason:'Dystans: sufiks do rozważenia zależnie od bazy broni, zasięgu i przeciwnika.',source:'hunter'
});

export function assessAffixes(item){
 const category=item?.category;
 const pair=pairs.get(`${category}|${item?.prefix}|${item?.suffix}`)||null;
 const prefix=prefixes.get(key(category,item?.prefix))||[];
 const suffix=suffixes.get(key(category,item?.suffix))||[];
 return {pair,prefix,suffix,rank:pair?3:Number(prefix.length>0)+Number(suffix.length>0)};
}
export function isStrongCombo(item){return !!assessAffixes(item).pair;}
