export const normalize = s => String(s).toLowerCase().replaceAll('ł','l').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim();
export function itemClass(n){
 if(n.left){const left=itemClass(n.left),right=itemClass(n.right),a=left===0?1:left,b=right===0?1:right;if(a===null||b===null||a>=18||b>=18||a===17&&b===17)return null;const c=Math.min(a,b)+(n.left.base===n.right.base?1:0);return c<18?c:null;}
 const s=normalize(n.original||'');if(!s)return null;
 const plus=Number(s.match(/\(\+(\d+)\)/)?.[1]||0);if(plus>5)return null;
 // Quality is a leading word, never an affix (e.g. Kusza Doskonałości).
 const name=s.replace(/^(?:\d+[.)]\s*)?(?:legendarn\S*\s+)?/,'');
 const q=/^starozytn\S*\s/.test(name)?24:/^epick\S*\s/.test(name)?18:/^doskonal[yae]\s/.test(name)?12:/^dobr[yae]\s/.test(name)?6:0;
 return q+plus;
}
export const requiresUpgrade=n=>!n.left&&itemClass(n)===0;
export const fusionInput=n=>requiresUpgrade(n)?{...n,original:`${n.original.replace(/\s*\(\+0\)\s*$/,'')} (+1)`}:n;
const displayWords = {'utwardzony':'utwardzany','helm':'hełm','obrecz':'obręcz','zlosliwy':'złośliwy','smiercionosny':'śmiercionośny','szamanski':'szamański','podroznika':'podróżnika','przezornosci':'przezorności','wytrzymalosci':'wytrzymałości','zmyslow':'zmysłów','slonca':'słońca','luski':'łuski','zolwia':'żółwia','skory':'skóry','cwiekowany':'ćwiekowany','wladczy':'władczy','luskowy':'łuskowy','plytowy':'płytowy','gietki':'giętki','lowiecki':'łowiecki','straznika':'strażnika','zlodzieja':'złodzieja','silacza':'siłacza','zabojcy':'zabójcy','unikow':'uników','grabiezcy':'grabieżcy','odpornosci':'odporności','smierci':'śmierci','szybkosci':'szybkości','krotkie':'krótkie','cwiekowane':'ćwiekowane','gietkie':'giętkie','szamanskie':'szamańskie','smiercionosne':'śmiercionośne','ruchow':'ruchów','skrytosci':'skrytości','bronia':'bronią','lowcy':'łowcy','weza':'węża','inkow':'inków','pierscien':'pierścień','lancuch':'łańcuch','zloty':'złoty','przebiegly':'przebiegły','gwiezdny':'gwiezdny','niedzwiedzi':'niedźwiedzi','msciwy':'mściwy','tanczacy':'tańczący','zwierzecy':'zwierzęcy','sloneczny':'słoneczny','pajeczy':'pajęczy','jastrzebi':'jastrzębi','wystepku':'występku','wladzy':'władzy','sily':'siły','madrosci':'mądrości','celnosci':'celności','mlodosci':'młodości','szczescia':'szczęścia','zdolnosci':'zdolności','przebieglosci':'przebiegłości','szalenca':'szaleńca','latwosci':'łatwości','palka':'pałka','noz':'nóż','topor':'topór','piesc':'pięść','zebaty':'zębaty','kosciany':'kościany','wzmacniajacy':'wzmacniający','kasajacy':'kąsający','opiekunczy':'opiekuńczy','swiecacy':'świecący','zabojczy':'zabójczy','przeklety':'przeklęty','dowodcy':'dowódcy','bolu':'bólu','zwinnosci':'zwinności','przodkow':'przodków','mestwa':'męstwa','bieglosci':'biegłości','samobojcy':'samobójcy','lom':'łom','dwureczny':'dwuręczny','pila':'piła','lancuchowa':'łańcuchowa','ciezki':'ciężki','podstepu':'podstępu','olowiu':'ołowiu','bazyliszka':'bazyliszka','luk':'łuk','krotki':'krótki','dlugi':'długi','ciezka':'ciężka','zasiegu':'zasięgu','doskonalosci':'doskonałości','szybkostrzelnosci':'szybkostrzelności','polautomat':'półautomat'};
export function label(s) { return String(s).split(' ').map(w=>displayWords[w]||w).join(' '); }
Object.assign(displayWords,{pelna:'pełna',spodnica:'spódnica',wilkolaka:'wilkołaka',krysztalowy:'kryształowy'});
const feminine = new Set(['czapka','maska','obrecz','kominiarka','opaska','bandana','korona','koszulka','kurtka','marynarka','kamizelka','peleryna','kolczuga','zbroja warstwowa','pelna zbroja','spodnica','bransoleta','apaszka','palka','kama','piesc niebios','maczuga','kosa','pika','halabarda','katana','pila lancuchowa','kusza','ciezka kusza','strzelba','beretta']);
const plural = new Set(['szorty','spodnie','wakizashi','mp5k','pilum','uzi','magnum','ak-47']);
const prefSpecial={'utwardzony':['utwardzany','utwardzana','utwardzane'],'kolcze':['kolczy','kolcza','kolcze'],'krotkie':['krotki','krotka','krotkie'],'lekkie':['lekki','lekka','lekkie'],'gietkie':['gietki','gietka','gietkie'],'elfie':['elfi','elfia','elfie'],'tygrysie':['tygrysi','tygrysia','tygrysie']};
export function variants(s) {
 if(prefSpecial[s])return prefSpecial[s];
 if(s.endsWith('y'))return [s,s.slice(0,-1)+'a',s.slice(0,-1)+'e'];
 if(s.endsWith('kie'))return [s.slice(0,-1),s.slice(0,-2)+'a',s];
 if(s.endsWith('ki'))return [s,s.slice(0,-1)+'a',s+'e'];
 if(s.endsWith('czy'))return [s,s.slice(0,-1)+'a',s.slice(0,-1)+'e'];
 if(s.endsWith('i'))return [s,s+'a',s+'e'];
 if(s.endsWith('ne')||s.endsWith('we'))return [s.slice(0,-1)+'y',s.slice(0,-1)+'a',s];
 return [s,s,s];
}
for (const [k,v] of Object.entries(displayWords)) { const ks=variants(k),vs=variants(v); ks.forEach((w,i)=>{if(!displayWords[w])displayWords[w]=vs[i]||v;}); }
const baseAliases={'karabin mysliwski':'karabin m.', 'karabin maszynowy':'karabin m.','polautomat snajperski':'polautomat s.','karabin snajperski':'karabin s.','miotacz plomieni':'miotacz p.','shuriken':'shurek','miecz 2h':'miecz dwureczny','topor 2h':'topor dwureczny'};
const baseLabels={'karabin m.':'Karabin myśliwski','polautomat s.':'Półautomat snajperski','karabin s.':'Karabin snajperski','miotacz p.':'Miotacz płomieni','ak-47':'AK-47','fn-fal':'FN-FAL','mp5k':'MP5K','shurek':'Shuriken'};
export const itemGender=item=>plural.has(item.base)?2:feminine.has(item.base)?1:0;
export function itemName(item){
 let p=item.prefix;
 if(p){let v=variants(p);p=v[plural.has(item.base)?2:feminine.has(item.base)?1:0];}
 const text=[item.rarity==='legendary'?['Legendarny','Legendarna','Legendarne'][itemGender(item)]:'',label(p||''),baseLabels[item.base]||label(item.base),label(item.suffix||'')].filter(Boolean).join(' ');
 return text.charAt(0).toUpperCase()+text.slice(1);
}
export function parseInventory(text,data){
 const items=[],errors=[];
 const catalog=[];
 for(const c of data.categories)for(const b of c.axes.base.values){catalog.push({category:c.id,base:b,match:b});for(const [k,v]of Object.entries(baseAliases))if(v===b)catalog.push({category:c.id,base:b,match:k});}
 catalog.sort((a,b)=>b.match.length-a.match.length);
 for(const [lineIndex,line] of text.split(/\r?\n/).entries()){
  const original=line.replace(/\s+sprzedaj\b.*$/i,'').trim();if(!original||/^sprzedaj\b/i.test(original)||/^\(?[\d\s]+\s*pln\)?$/i.test(original))continue;
  let s=normalize(original).replace(/^\d+[.)]\s*/,'').replace(/\s*\(\+\d+\)\s*$/,'').trim();
  const rarity=/^legendarn/.test(s)?'legendary':'normal';
  s=s.replace(/^(legendarn\w*\s+)?(dobr\w*|doskonal\w*|epick\w*|starozytn\w*)\s+/,'').replace(/^legendarn\w*\s+/,'');
  const base=catalog.find(x=>(' '+s+' ').includes(' '+x.match+' '));
  if(!base){errors.push({line:lineIndex+1,name:original,reason:'Nie rozpoznano bazy przedmiotu.'});continue;}
  const c=data.categories.find(c=>c.id===base.category); const at=s.indexOf(base.match);
  const pre=s.slice(0,at).trim(),suf=s.slice(at+base.match.length).trim();
  const prefix=pre?c.axes.prefix?.values.find(p=>variants(p).includes(pre)):'';
  const suffix=suf?c.axes.suffix?.values.find(p=>p===suf):'';
  if(pre&&!prefix||suf&&!suffix){errors.push({line:lineIndex+1,name:original,reason:pre&&!prefix?'Prefiks nie występuje w tabeli tej kategorii.':'Sufiks nie występuje w tabeli tej kategorii.'});continue;}
  items.push({id:items.length,original,category:c.id,base:base.base,prefix:prefix||'',suffix:suffix||'',rarity});
 }
 return {items,errors};
}
export function merge(a,b,data){
 if(a.category!==b.category||a.rarity!==b.rarity)return null;
 // Ordinary +0 ingredients are planned after an assumed upgrade to +1.
 // This planner handles ordinary Studnia fusions (+1 through Doskonały +5).
 // Epic/ancient transfer and Kuźnia Kaina use separate rules and costs.
 if(itemClass({left:a,right:b})===null)return null;
 const c=data.categories.find(c=>c.id===a.category);const result={category:a.category,rarity:a.rarity};const evidence=[];
 for(const axis of ['base','prefix','suffix']){
  if(axis!=='base'&&(!a[axis]||!b[axis])){result[axis]='';evidence.push({axis,a:a[axis],b:b[axis],result:'',rule:'Brak afiksu w składniku usuwa go z wyniku.'});continue;}
  const t=c.axes[axis]; if(!t)return null;
  const ordered=[a[axis],b[axis]].sort((x,y)=>t.values.indexOf(x)-t.values.indexOf(y)).join('|');
  if(t.blocked.includes(ordered))return null;
  const value=t.table[a[axis]+'|'+b[axis]];if(!value)return null;
  result[axis]=value;evidence.push({axis,a:a[axis],b:b[axis],result:value,cell:t.refs[a[axis]+'|'+b[axis]]});
 }
 return {...result,evidence};
}
export const resultKey=n=>[n.category,n.rarity,n.prefix,n.base,n.suffix].join('|');
export function analysisScope(items,data,category='all'){
 if(category==='all')return {items,tables:data};
 const selected=data.categories.find(c=>c.id===category);
 if(!selected)throw new Error('Nie rozpoznano rodzaju przedmiotu.');
 return {items:items.filter(item=>item.category===category),tables:{categories:[selected]}};
}
export function explore(items,data,maxDepth=3,onProgress=()=>{},limits={}){
 if(!Number.isInteger(maxDepth)||maxDepth<1||maxDepth>25)throw new Error('Głębokość musi wynosić od 1 do 25.');
 limits={states:30000,attempts:20000000,timeMs:5000,maxSteps:25,collectRecipes:true,...limits};
 const started=performance.now();let lastProgress=started,stopReason=null;
 const activeCategories=data.categories.filter(c=>items.some(i=>i.category===c.id));
 if(items.length>100)throw new Error('Maksymalnie 100 przedmiotów na analizę.');
 const results=new Map(),recipeSignatures=new Map();let states=items.length,attempts=0,truncated=false;
 function recipeSignature(node){
  const ids=[];function collect(n){if(!n.left)ids.push(n.id);else{collect(n.left);collect(n.right);}}
  collect(node);return ids.sort((a,b)=>a-b).join(',');
 }
 function* searchCategory(c){
  const pool=items.filter(i=>i.category===c.id);const maxLeaves=Math.min(pool.length,2**maxDepth,limits.maxSteps+1);
  const layers=Array.from({length:maxLeaves+1},()=>new Map());
  layers[1]=new Map(pool.map(i=>[String(i.id),{...i,mask:1n<<BigInt(i.id),depth:0,steps:0}]));
  for(let leaves=2;leaves<=maxLeaves;leaves++){
   for(let left=1;left<=leaves/2;left++){
    const right=leaves-left;
    for(const a of layers[left].values())for(const b of layers[right].values()){
     if(++attempts>limits.attempts){truncated=true;stopReason='attempts';return;}
     if(attempts%512===0){const now=performance.now();if(now-started>=limits.timeMs){truncated=true;stopReason='time';return;}if(now-lastProgress>180){lastProgress=now;onProgress({category:c.label,leaves,states,results:results.size,attempts,elapsedMs:now-started});}yield;}
     if(a.mask&b.mask||left===right&&a.mask>=b.mask)continue;
     const depth=Math.max(a.depth,b.depth)+1;if(depth>maxDepth)continue;
     const m=merge(a,b,data);if(!m)continue;
     const mask=a.mask|b.mask;const key=mask+'|'+resultKey(m)+'|'+itemClass({left:a,right:b});const old=layers[leaves].get(key);
     if(old&&old.depth<=depth)continue;
     if(!old&&states>=limits.states){truncated=true;stopReason='memory';return;}
     const n={...m,mask,depth,steps:leaves-1,left:a,right:b};layers[leaves].set(key,n);
     const result=resultKey(n),previous=results.get(result);
     if(!limits.collectRecipes){
      if(!previous||n.steps<previous.steps||n.steps===previous.steps&&n.depth<previous.depth)results.set(result,n);
     }
     else if(!previous){results.set(result,{...n,recipes:[n]});recipeSignatures.set(result,new Set([recipeSignature(n)]));}
     else{
      const recipes=previous.recipes||[previous],signatures=recipeSignatures.get(result),signature=recipeSignature(n);
      if(!signatures.has(signature)){recipes.push(n);signatures.add(signature);}
      if(n.steps<previous.steps||n.steps===previous.steps&&n.depth<previous.depth)Object.assign(previous,n);
      previous.recipes=recipes;
     }
     if(!old)states++;
    }
   }
   onProgress({category:c.label,leaves,states,results:results.size,attempts,elapsedMs:performance.now()-started});
  }
 }
 const pending=activeCategories.map(c=>searchCategory(c));let current=0;
 while(pending.length){
  const now=performance.now();if(now-started>=limits.timeMs){truncated=true;stopReason='time';break;}
  const sliceEnd=Math.min(started+limits.timeMs,now+50);
  let finished=false;
  do{
   if(pending[current].next().done){pending.splice(current,1);if(current>=pending.length)current=0;finished=true;break;}
  }while(!stopReason&&performance.now()<sliceEnd);
  if(stopReason)break;
  if(pending.length&&!finished)current=(current+1)%pending.length;
 }
 const output=[...results.values()];
 for(const result of output)result.recipes?.sort((a,b)=>a.steps-b.steps||a.depth-b.depth||recipeSignature(a).localeCompare(recipeSignature(b)));
 return {results:output.sort((a,b)=>a.steps-b.steps||a.depth-b.depth||itemName(a).localeCompare(itemName(b),'pl')),states,attempts,truncated,maxDepth,stopReason,maxSteps:limits.maxSteps,elapsedMs:performance.now()-started};
}
export function recipeSteps(node){const out=[];function walk(n){if(!n.left)return;walk(n.left);walk(n.right);out.push(n);}walk(node);return out;}
export function ingredients(node){return node.left?[...ingredients(node.left),...ingredients(node.right)]:[node];}
