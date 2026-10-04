// Independent holdouts: these URLs must not have been used to fit the model.
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {fullItemName,officialUrl} from '../item-details.js';
const read=p=>JSON.parse(fs.readFileSync(new URL(p,import.meta.url)));
const catalog=read('../item-catalog.json');
const fitted=new Set(read('../tests/fixtures/official-r21.json').map(s=>s.url));
const names=[];
for(const [index,[category,ids]]of Object.entries(Object.entries(catalog))){
 const bases=Object.keys(ids.base),prefixes=Object.keys(ids.prefix),suffixes=Object.keys(ids.suffix);
 const qualities=prefixes.length?[0,1,6,11,17,18,20,23,24,27,29]:[1,12,24];
 for(const [position,q]of qualities.entries()){
  for(let offset=0;offset<100;offset++){
   const base=bases[(Number(index)+q+offset+1)%bases.length],prefix=prefixes[(q+offset+Number(index)*3)%prefixes.length]||'';
   const suffix=prefix&&position%3===0?'':suffixes[(q*3+offset+Number(index))%suffixes.length]||'';
   const rarity=q<18&&position%2?'legendary':'normal';
   const node={category,base,prefix,suffix,rarity,original:`${rarity==='legendary'?'Legendarny ':''}${['','Dobry ','Doskonały ','Epicki ','Starożytny '][Math.floor(q/6)]}Przedmiot (+${q%6})`};
   node.original=fullItemName(node);
   if(fitted.has(officialUrl(node,catalog)))continue;
   names.push(node.original);break;
  }
 }
}
console.log(names.length,'independent validation variants');
if(!process.argv.includes('--fetch')){console.log(names.join('\n'));process.exit();}
for(let i=0;i<names.length;i+=50){
 const result=spawnSync(process.execPath,[fileURLToPath(new URL('./sample-r21.mjs',import.meta.url)),'--validation',...names.slice(i,i+50)],{stdio:'inherit'});
 if(result.status!==0)process.exit(result.status||1);
}
