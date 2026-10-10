// Optional UI regression: node tests/journey-browser.mjs /path/to/playwright/index.mjs
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {fileURLToPath,pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
import {planJourneys,hardestCertain,chanceLabel,liveAdvice} from '../journey-sim.js';
const {chromium}=await import(pathToFileURL(process.argv[2]).href);
const root=fileURLToPath(new URL('../',import.meta.url));
const data=JSON.parse(fs.readFileSync(new URL('../journey-data.json',import.meta.url)));
const stats=Object.fromEntries(data.params.map(p=>[p.id,300]));
const input={stats,blood:1000,level:9,waitTimed:false};
const expected=planJourneys(data,input).map(r=>chanceLabel(r.completion));
const hardest=hardestCertain(data,{...input,waitTimed:true}).map(r=>r.level?`Poziom ${r.level}`:'Brak');
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
 for(const width of [1440,390]){
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
 for(const viewport of [{width:1440,height:900},{width:390,height:844},{width:844,height:390}]){
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
 {
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
    if(expected.round<2){await page.locator('[data-pick="shown"]').selectOption(boss.rounds[expected.round].random[0]);await ready();}
    await page.locator('.journeyOption.recommended').click();
   }
   await ready();
  }
  assert.match(await page.locator('.journeyStep h3').textContent(),/Podróż ukończona/);
  assert.equal(await page.locator('.journeyNode.done').count(),9);
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('kuzniaJourneyRun')).log.length),14);
  assert.deepEqual(errors,[]);
  console.log('Live journey: damaged saved log repaired; all route nodes, mini boss and final boss completed');
  await page.close();
 }
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
