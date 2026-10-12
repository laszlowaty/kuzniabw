// Effects shared by the planner and the live journey. Costs refer to the
// starting, unboosted parameter, never the remaining pool or the boss rate.
export const SPECIAL_RULES={
 calm:{kind:'discount',value:0.2,fraction:1/4},
 intimidate:{kind:'discount',value:0.25,fraction:1/4},
 weakness:{kind:'discount',value:0.3,fraction:1/3},
 scout:{kind:'nextDiscount',value:0.4,fraction:1/5},
 counter:{kind:'counter',fraction:1/8},
 ignore:{kind:'skip',probability:0.2,fraction:1/8},
 persuade:{kind:'regenerate',value:0.2,fraction:1/4},
 brainwash:{kind:'double',target:'spostrzegawczosc',fraction:1/5},
 provoke:{kind:'nextHighest',fraction:1/4},
 underestimate:{kind:'randomParam',fraction:1/8},
 disorient:{kind:'boostThree',value:0.5,fraction:1/4},
 agility:{kind:'nextParam',target:'zwinnosc',fraction:1/10},
 restore:{kind:'restore',fraction:1/4},
 highest:{kind:'highest',fraction:1/5},
 prophet:{kind:'skip',probability:0.5,fraction:1/5}
};

export function specialCost(special,base,override){
 if(override!=null){
  if(!Number.isSafeInteger(override)||override<0)throw new RangeError('Nieprawidłowy koszt ataku specjalnego');
  return override;
 }
 const fraction=SPECIAL_RULES[special.id]?.fraction;
 return fraction==null?null:Math.ceil((typeof base==='number'?base:base[special.param]??0)*fraction);
}
