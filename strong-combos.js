// Curated examples from Moria build discussions. Keys are the normalized axes from data.json.
export const strongCombos={
 head:{tygrysi:['adrenaliny']},
 chest:{tygrysi:['szybkosci'],elfi:['szybkosci']},
 legs:{tygrysie:['nocy'],elfie:['unikow']},
 melee1:{szybki:['samobojcy']},
 melee2:{demoniczny:['krwiopijcy']}
};

export function isStrongCombo(item){
 return !!item?.prefix&&!!item?.suffix&&!!strongCombos[item.category]?.[item.prefix]?.includes(item.suffix);
}
