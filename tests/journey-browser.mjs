// Optional UI regression: node tests/journey-browser.mjs /path/to/playwright/index.mjs
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {tmpdir} from 'node:os';
import {fileURLToPath,pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
import {planJourneys,hardestCertain,chanceLabel,liveAdvice} from '../journey-sim.js';
const {chromium}=await import(pathToFileURL(process.argv[2]).href);
const root=fileURLToPath(new URL('../',import.meta.url));
const data=JSON.parse(fs.readFileSync(new URL('../journey-data.json',import.meta.url)));
const stats=Object.fromEntries(data.params.map(p=>[p.id,300]));
const input={stats,blood:1000,level:9,waitTimed:false};
const specialsOnly=process.argv.includes('--specials-only');
const expected=specialsOnly?[]:planJourneys(data,input).map(r=>chanceLabel(r.completion));
const hardest=specialsOnly?[]:hardestCertain(data,{...input,waitTimed:true}).map(r=>r.level?`Poziom ${r.level}`:'Brak');
const server=http.createServer((req,res)=>{
 const file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname.replace(/\/$/,'/index.html')));
 if(!file.startsWith(root)||!fs.existsSync(file)){res.writeHead(404);res.end();return;}
 const mime={'.html':'text/html','.js':'text/javascript','.json':'application/json','.css':'text/css'}[path.extname(file)]||'application/octet-stream';
 res.writeHead(200,{'Content-Type':mime+'; charset=utf-8'});fs.createReadStream(file).pipe(res);
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 for(const width of specialsOnly?[]:[1440,390]){
  const page=await browser.newPage({viewport:{width,height:900}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(({stats})=>{
   localStorage.setItem('kuzniaJourney',JSON.stringify({values:{...stats,blood:1000},level:9,waitTimed:true}));
   window.maxGap=0;let last=performance.now();
   setInterval(()=>{const now=performance.now();window.maxGap=Math.max(window.maxGap,now-last);last=now;},20);
  },{stats});
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await page.locator('#journeyTab').click();
  const ready=()=>page.waitForFunction(()=>document.querySelectorAll('#journeyTable [data-start]').length===9,{},{timeout:60000});
  await ready();
  await page.evaluate(()=>{window.maxGap=0;});
  await page.locator('#journeyWait').uncheck();
  await page.waitForFunction(()=>document.querySelector('#journeyTable').getAttribute('aria-busy')==='true');
  // Change settings while the old simulation is still in flight, then return to the intended setting.
  await page.locator('#journeyWait').check();
  await page.locator('#journeyWait').uncheck();
  await ready();
  assert.deepEqual(await page.locator('#journeyTable .journeyChance').allTextContents(),expected);
  assert.ok(await page.evaluate(()=>window.maxGap<500),'simulation must not block the UI timer');
  await page.locator('#journeyHardest').check();
  await page.locator('#journeyWait').check();
  await ready();
  assert.deepEqual(await page.locator('#journeyTable .journeyChance').allTextContents(),hardest);
  assert.equal(await page.locator('#journeyLevel').isDisabled(),true);
  assert.deepEqual(errors,[]);
  console.log(`Journey worker: responsive UI, cancellation and results OK at ${width}px`);
  await page.close();
 }
 // The previously blocking live path: low CPU speed, waiting, reload and cancellation.
 for(const viewport of specialsOnly?[]:[{width:1440,height:900},{width:390,height:844},{width:844,height:390}]){
  const page=await browser.newPage({viewport}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{
   window.liveRequests=0;window.longTasks=[];
   const post=Worker.prototype.postMessage;
   Worker.prototype.postMessage=function(message,...args){if(message.run)window.liveRequests++;return post.call(this,message,...args);};
   new PerformanceObserver(list=>window.longTasks.push(...list.getEntries().map(e=>e.duration))).observe({type:'longtask'});
  });
  const run={stats,blood:1000,level:9,waitTimed:true,locationId:'ochrona-karawany',log:[]};
  await page.goto(origin);
  await page.evaluate(run=>localStorage.setItem('kuzniaJourneyRun',JSON.stringify(run)),run);
  const cdp=await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
  await page.locator('#journeyTab').click();
  const ready=()=>page.waitForFunction(()=>document.querySelector('#journeyRun .journeyStep')&&!document.querySelector('#journeyRun').hasAttribute('aria-busy'),null,{timeout:60000});
  await ready();
  assert.equal(await page.evaluate(()=>window.liveRequests),1,'restoring a run calculates advice only once');
  const timed=data.encounters.findIndex(e=>e.type==='timed'),pending={encounter:timed};
  const expected=liveAdvice(data,run,pending);
  await page.evaluate(()=>window.longTasks=[]);
  await page.locator('[data-pick="encounter"]').selectOption(String(timed));await ready();
  assert.deepEqual(await page.locator('.journeyOptionChance b').allTextContents(),expected.options.filter(o=>o.affordable).map(o=>chanceLabel(o.chance)));
  assert.equal(await page.locator('.journeyOption.recommended').getAttribute('data-pay'),expected.recommended);
  const before=await page.evaluate(()=>window.liveRequests);
  // A second click while computing cannot append a duplicate step.
  await page.locator('[data-pay="wait"]').evaluate(b=>{b.click();b.click();});await ready();
  assert.equal(await page.evaluate(()=>window.liveRequests),before+1);
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('kuzniaJourneyRun')).log.length),1);
  assert.match(await page.locator('.journeyStep h3').textContent(),/Węzeł 2/);
  const requests=await page.evaluate(()=>window.liveRequests);
  await page.locator('.journeyNode[data-stage="0"]').click();
  assert.match(await page.locator('.journeyPast').textContent(),/przeczekano/);
  await page.locator('.journeyNode[data-stage="1"]').click();
  assert.equal(await page.evaluate(()=>window.liveRequests),requests,'viewing history reuses existing advice');
  await page.locator('[data-action="undo"]').click();await ready();
  assert.match(await page.locator('.journeyStep h3').textContent(),/Węzeł 1/);
  const longTasks=await page.evaluate(()=>window.longTasks);
  assert.ok(longTasks.every(ms=>ms<500),`live UI blocked: ${JSON.stringify(longTasks)}`);
  // Failed worker can be retried without losing the run.
  await page.route('**/journey-worker.js',route=>route.abort());
  await page.locator('[data-pick="encounter"]').selectOption(String(timed));
  await page.locator('[data-action="retry"]').waitFor();
  assert.equal(await page.locator('[data-action="end"]').isEnabled(),true);
  await page.unroute('**/journey-worker.js');
  await page.locator('[data-action="retry"]').click();await ready();
  await page.locator('[data-pay="wait"]').click();await ready();
  await page.reload();await page.locator('#journeyTab').click();await ready();
  assert.match(await page.locator('.journeyStep h3').textContent(),/Węzeł 2/);
  assert.equal(await page.evaluate(()=>window.liveRequests),1);
  await page.locator('.journeyNode[data-stage="0"]').click();
  await page.locator('[data-action="rewind"]').click();await ready();
  assert.match(await page.locator('.journeyStep h3').textContent(),/Węzeł 1/);
  await page.locator('[data-pick="encounter"]').selectOption(String(timed));
  await page.locator('[data-action="end"]').click();
  await page.waitForFunction(()=>document.querySelectorAll('#journeyTable [data-start]').length===9);
  assert.equal(await page.locator('#journeyRun').isHidden(),true);
  assert.equal(await page.evaluate(()=>localStorage.getItem('kuzniaJourneyRun')),null);
  assert.deepEqual(errors,[]);
  console.log(`Live journey: CPU 4x, results, single calculation per step, history, retry, reload and cancellation OK at ${viewport.width}x${viewport.height}; long tasks: ${longTasks.map(Math.round)}`);
  await page.close();
 }
 // Full route through the mini boss and final boss, including repairing a broken saved log.
 if(!specialsOnly){
  const page=await browser.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin);
  const timed=data.encounters.findIndex(e=>e.type==='timed');
  const run={stats:Object.fromEntries(data.params.map(p=>[p.id,1000000])),blood:1000,level:9,waitTimed:true,locationId:'ochrona-karawany',simulations:5,
   log:[{type:'node',encounter:timed,pay:'wait'},{type:'node',encounter:-1,pay:'wait'}]};
  await page.evaluate(run=>localStorage.setItem('kuzniaJourneyRun',JSON.stringify(run)),run);
  await page.locator('#journeyTab').click();
  const ready=()=>page.waitForFunction(()=>document.querySelector('#journeyRun .journeyStep')&&!document.querySelector('#journeyRun').hasAttribute('aria-busy'),null,{timeout:60000});
  await ready();
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('kuzniaJourneyRun')).log.length),1);
  let mini=null;
  for(let step=0;step<30;step++){
   const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('kuzniaJourneyRun'))),expected=liveAdvice(data,saved);
   if(expected.phase==='done')break;
   if(expected.phase==='node'){
    await page.locator('[data-pick="encounter"]').selectOption(String(timed));await ready();
    await page.locator('[data-pay="wait"]').click();
   }else if(expected.phase==='miniPick'){
    mini=await page.locator('[data-mini]').first().getAttribute('data-mini');
    await page.locator('[data-mini]').first().click();
   }else{
    const boss=data.bosses.find(b=>b.id===(expected.phase==='mini'?mini:data.locations.find(l=>l.id===run.locationId).boss));
    if(expected.offer===undefined){
     await page.locator('[data-pick="offer"]').selectOption(expected.phase==='mini'?'ignore':'calm');await ready();
     await page.locator('[data-action="offer"]').click();await ready();continue;
    }
    if(expected.round<2&&!expected.shownLocked){await page.locator('[data-pick="shown"]').selectOption(boss.rounds[expected.round].random[0]);await ready();}
    if(!expected.specialUsed){
     if(expected.phase==='mini')await page.locator('[data-special-result]').selectOption('0');
     await page.locator('[data-action="use-special"]').click();await ready();continue;
    }
    await page.locator('.journeyOption.recommended').click();
   }
   await ready();
  }
  assert.match(await page.locator('.journeyStep h3').textContent(),/Podróż ukończona/);
  assert.equal(await page.locator('.journeyNode.done').count(),9);
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('kuzniaJourneyRun')).log.length),17);
  assert.deepEqual(errors,[]);
  console.log('Live journey: damaged log repaired; separate mini/final specials, successful skip, all stages completed');
  await page.close();
 }
 // A skip can rescue round three even when every regular payment is unavailable.
 for(const mini of [false,true])for(const success of [false,true]){
  const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin);
  await page.evaluate(async({data,mini})=>{
   const d=structuredClone(data);d.routes[1]={nodes:0,...(mini?{miniAfter:0}:{})};
   d.costs={acts:{1:{base:10,perLevel:0}},levels:{min:1,max:1},type:{monster:1,miniboss:1,boss:1},blood:5,combo:0.75};
   d.bosses=['main','mini'].map(id=>({id,name:id,rounds:[{fixed:'sila',random:['sila']},{fixed:'sila',random:['sila']},{combo:['sila','zwinnosc'],single:'sila'}],specials:[{id:'ignore',param:'odpornosc',effect:'20% szans na pominięcie rundy'}]}));
   d.locations=d.bosses.map(b=>({id:b.id,name:b.name,act:1,boss:b.id}));
   const root=document.createElement('div');root.id='qaRun';document.body.append(root);
   const {createJourneyRun}=await import('/journey-run.js');
   createJourneyRun({data:d,root,onEnd(){}}).start({stats:{sila:20,odpornosc:8},level:1,locationId:'main',simulations:1,
    log:[...(mini?[{type:'mini',boss:'mini'}]:[]),{type:'offer',special:'ignore'},{type:'round',shown:'sila',pay:'sila'},{type:'round',shown:'sila',pay:'sila'}]});
  },{data,mini});
  const ready=()=>page.waitForFunction(()=>document.querySelector('#qaRun .journeyStep')&&!document.querySelector('#qaRun').hasAttribute('aria-busy'));
  await ready();
  assert.equal(await page.locator('#qaRun [data-pay]:enabled').count(),0);
  assert.equal(await page.locator('#qaRun .journeyStuck').count(),0,'affordable special must prevent false stuck warning');
  assert.equal(await page.locator('#qaRun [data-action="use-special"]').isEnabled(),true);
  await page.locator('#qaRun [data-special-result]').selectOption(success?'0':'1');
  await page.locator('#qaRun [data-action="use-special"]').click();await ready();
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('kuzniaJourneyRun')));
  assert.deepEqual(saved.log.at(-1).result,{success});
  if(!success){
   assert.equal(await page.locator('#qaRun .journeyStuck').count(),1);
   assert.equal(await page.locator('#qaRun [data-action="use-special"]').count(),0);
  }else if(mini){
   assert.match(await page.locator('#qaRun .journeyStep h3').textContent(),/^Boss: main/);
   assert.equal(await page.locator('#qaRun [data-pick="offer"]').count(),1,'fresh final boss offer');
  }else assert.match(await page.locator('#qaRun .journeyStep h3').textContent(),/Podróż ukończona/);
  assert.deepEqual(errors,[]);await page.close();
 }
 console.log('Special rescue UI: mini/final, failed/successful last-round skip, fresh final offer and stuck warning OK');
 for(const viewport of [{width:1440,height:900},{width:390,height:844},{width:844,height:390}]){
  const page=await browser.newPage({viewport}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin);
  const timed=data.encounters.findIndex(e=>e.type==='timed');
  const run={stats:Object.fromEntries(data.params.map(p=>[p.id,100])),level:1,locationId:'ochrona-karawany',simulations:3,
   log:Array.from({length:3},()=>({type:'node',encounter:timed,pay:'wait'}))};
  await page.evaluate(run=>localStorage.setItem('kuzniaJourneyRun',JSON.stringify(run)),run);
  await page.locator('#journeyTab').click();
  const ready=()=>page.waitForFunction(()=>document.querySelector('#journeyRun .journeyStep')&&!document.querySelector('#journeyRun').hasAttribute('aria-busy'),null,{timeout:60000});
  await ready();await page.locator('[data-pick="offer"]').selectOption('calm');await ready();
  assert.equal(await page.locator('[data-special-cost]').inputValue(),'25');
  await page.locator('[data-special-cost]').fill('23');await page.locator('[data-action="offer"]').click();await ready();
  await page.locator('[data-pick="shown"]').selectOption('wyglad');await ready();
  await page.locator('[data-action="use-special"]').evaluate(b=>{b.click();b.click();});await ready();
  let saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('kuzniaJourneyRun')));
  assert.equal(saved.log.length,5,'one offer and one use despite double click');
  assert.equal(liveAdvice(data,saved).stats.wyglad,77);
  assert.equal(await page.locator('[data-pick="shown"]').isDisabled(),true);
  assert.equal(await page.locator('[data-action="use-special"]').count(),0);
  await page.reload();await page.locator('#journeyTab').click();await ready();
  assert.match(await page.locator('.journeyStep').textContent(),/wykorzystany/);
  await page.locator('[data-action="undo"]').click();await ready();
  await page.locator('[data-pick="shown"]').selectOption('wyglad');await ready();
  assert.equal(await page.locator('[data-action="use-special"]').isEnabled(),true);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'no horizontal page overflow');
  assert.deepEqual(errors,[]);
  await page.screenshot({path:path.join(tmpdir(),`journey-special-${viewport.width}.png`),fullPage:true});
  console.log(`Special UI: override cost, use once, reload, undo and layout OK at ${viewport.width}x${viewport.height}`);
  await page.close();
 }
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
