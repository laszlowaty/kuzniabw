// Optional UI QA: node tests/browser-smoke.mjs /path/to/playwright/index.mjs
// Uses an installed browser; Playwright is not a runtime/project dependency.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {fileURLToPath,pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
const {chromium}=await import(pathToFileURL(process.argv[2]).href);
const root=fileURLToPath(new URL('../',import.meta.url));
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
 const page=await browser.newPage({viewport:{width:1440,height:1000},hasTouch:true}),errors=[],external=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',route=>{if(!route.request().url().startsWith(origin)){external.push(route.request().url());return route.abort();}return route.continue();});
 await page.goto(origin);
 await page.waitForFunction(()=>document.querySelector('#catalogStatus').textContent.includes('Dane R21 gotowe'));
 assert.equal(await page.locator('#inventoryCount').textContent(),'0');
 await page.locator('#craftingTab').click();
 await page.locator('.profileDisclosure>summary').click();
 const originalText='  Czapka  \n\nKusza (+1)\nSPRZEDAJ\n';
 await page.locator('#editInventory').click();
 await page.locator('#inventoryText').fill(originalText);
 for(const [category,name]of [['head','Czapka'],['ranged','Kusza (+1)']]){
  await page.locator('#importCategory').selectOption(category);
  assert.equal(await page.locator('#inventoryText').inputValue(),originalText);
  await page.locator('#inventoryForm button[type=submit]').click();
  await page.waitForFunction(()=>!document.querySelector('#calculate').disabled);
  assert.equal(await page.locator('#inventoryCount').textContent(),'1');
  assert.equal(await page.locator('#inventoryList .itemInfoTrigger').textContent(),name);
  await page.locator('#editInventory').click();
  assert.equal(await page.locator('#inventoryText').inputValue(),originalText);
 }
 await page.locator('#importCategory').selectOption('all');
 await page.locator('#closeDialog').click();
 async function inventory(text){
  await page.locator('#editInventory').click();await page.locator('#inventoryText').fill(text);
  await page.locator('#inventoryForm button[type=submit]').click();
  await page.waitForFunction(()=>!document.querySelector('#calculate').disabled);
 }
 await page.evaluate(()=>{
  const post=Worker.prototype.postMessage;
  Worker.prototype.postMessage=function(message,...args){
   if(!message.mode){window.searchInput={categories:message.items.map(i=>i.category),filters:message.filters};this.addEventListener('message',({data})=>{if(data.type==='done')window.searchOutput={states:data.states,count:data.results.length,stopReason:data.stopReason};});}
   return post.call(this,message,...args);
  };
 });
 await inventory('Czapka (+1)\nCzapka (+1)\nKusza (+1)\nKusza (+1)');
 await page.locator('#category').selectOption('head');
 await page.waitForFunction(()=>!document.querySelector('#calculate').disabled);
 assert.deepEqual(await page.evaluate(()=>window.searchInput.categories),['head','head']);
 for(const width of [375,1440]){
  await page.setViewportSize({width,height:1000});
  await page.locator('#filterPrefix').selectOption('any');
  await page.waitForFunction(()=>!document.querySelector('#calculate').disabled);
  assert.equal(await page.evaluate(()=>window.searchInput.filters.prefix),'any');
  assert.deepEqual(await page.evaluate(()=>window.searchOutput),{states:0,count:0,stopReason:null});
  assert.match(await page.locator('#status').textContent(),/0 nazw pasujących do filtrów/);
  await page.locator('#filterPrefix').selectOption('none');
  await page.waitForFunction(()=>!document.querySelector('#calculate').disabled);
  assert.equal(await page.locator('#resultCount').textContent(),'1');
 }
 await page.locator('#clearFilters').click();
 await page.waitForFunction(()=>!document.querySelector('#calculate').disabled);
 assert.equal(await page.locator('#resultCount').textContent(),'2');
 await page.locator('#timeBudget').selectOption('30');
 await page.locator('#depth').fill('12');
 await inventory(Array.from({length:18},()=> 'Czapka (+1)').join('\n'));
 assert.match(await page.locator('#status').textContent(),/limit zapisanych wariantów.*Dłuższy czas nie zwiększy/);
 assert.match(await page.locator('#status').textContent(),/zakres nie został sprawdzony w całości/);
 await page.locator('#filterPrefix').selectOption('any');
 await page.waitForFunction(()=>!document.querySelector('#calculate').disabled);
 assert.deepEqual(await page.evaluate(()=>window.searchOutput),{states:0,count:0,stopReason:null});
 await page.locator('#depth').fill('3');
 await page.locator('#timeBudget').selectOption('5');
 await inventory('Dobra Tygrysia Czapka Adrenaliny (+5)\nDobry Tygrysi Hełm Adrenaliny (+5)\nDobra Szybka Pięść Niebios Samobójcy (+5)\nDobry Shuriken Reakcji (+5)');
 assert.ok(await page.locator('#inventoryList .pairBadge').count()>=2);
 await page.locator('#profileRace').selectOption('ssak');
 await page.locator('#profileTattoo').selectOption('mnich');
 assert.equal(await page.locator('#inventoryList .tattooBadge').count(),2);
 assert.equal(await page.locator('#inventoryList .raceBadge').count(),0);
 await page.locator('#profileTattoo').selectOption('lowca_skarbow');
 assert.ok(await page.locator('#inventoryList .tattooBadge').count()>=1);
 await page.locator('#profileTattoo').selectOption('');
 await page.locator('#profileRace').selectOption('');
 await page.locator('#inventoryContents > summary').click();
 await page.locator('#inventoryList .itemInfoTrigger').first().click();
 assert.match(await page.locator('#itemInfo').textContent(),/Dobra para/);
 assert.match(await page.locator('#itemInfo').textContent(),/Przyrost względem przedmiotu/);
 await page.keyboard.press('Escape');
 await page.setViewportSize({width:375,height:800});
 await page.locator('#inventoryList .itemInfoTrigger').first().tap();
 assert.match(await page.locator('#itemInfo').textContent(),/Dobra para/);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true);
 await page.keyboard.press('Escape');
 await page.setViewportSize({width:1440,height:1000});
 await inventory('Kusza Doskonałości (+1)\nKusza Doskonałości (+1)');
 assert.match(await page.locator('#resultsList .resultName').first().textContent(),/\(\+2\)/);
 await page.locator('#resultsList .result').first().click();
 assert.equal(await page.locator('#step-mana-0').inputValue(),'216');
 assert.equal(await page.locator('#step-nanites-0').inputValue(),'72');
 await page.locator('#inventoryList .itemInfoTrigger').first().scrollIntoViewIfNeeded();
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 await page.locator('#inventoryList .itemInfoTrigger').first().hover();
 await page.locator('#itemInfo').waitFor({state:'visible'});
 assert.match(await page.locator('#itemInfo').textContent(),/Nanity: 36/);
 await page.keyboard.press('Escape');
 await inventory('Epicka Bojowa Korona\nStarożytna Władcza Kurtka Narkomana');
 await page.locator('#inventoryList .itemInfoTrigger').first().scrollIntoViewIfNeeded();
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 await page.locator('#inventoryList .itemInfoTrigger').first().hover();
 assert.match(await page.locator('#itemInfo').textContent(),/POZIOM: 108, SIŁA: 104/);
 await page.keyboard.press('Escape');
 await page.locator('#inventoryList .itemInfoTrigger').last().hover();
 assert.match(await page.locator('#itemInfo').textContent(),/POZIOM: 159, SIŁA: 164/);
 await page.route('**/item-requirements.json',route=>route.abort());
 await page.reload();
 await page.waitForFunction(()=>document.querySelector('#catalogStatus').textContent.includes('Nie wczytano dokładnych wymagań'));
 await page.locator('#craftingTab').click();
 await page.locator('#inventoryContents > summary').click();
 await page.locator('#gunExample').click();
 await page.waitForFunction(()=>!document.querySelector('#calculate').disabled);
 assert.ok(Number(await page.locator('#resultCount').textContent())>1);
 await page.locator('#resultOrder [data-order="most"]').click();
 assert.equal(await page.locator('#resultOrder [data-order="most"]').getAttribute('aria-pressed'),'true');
 assert.match(await page.locator('#resultsList .result .pill.cost').first().textContent(),/^2 spawy$/);
 await page.locator('#resultOrder [data-order="fewest"]').click();
 assert.match(await page.locator('#resultsList .result .pill.cost').first().textContent(),/^1 spaw$/);
 await page.locator('#resultOrder [data-order="best"]').click();
 assert.equal(await page.locator('#resultOrder [data-order="best"]').getAttribute('aria-pressed'),'true');
 await page.setViewportSize({width:375,height:800});
 for(const order of ['best','fewest','most'])assert.ok(await page.locator(`#resultOrder [data-order="${order}"]`).isVisible());
 await page.locator('#resultOrder [data-order="most"]').click();
 assert.match(await page.locator('#resultsList .result .pill.cost').first().textContent(),/^2 spawy$/);
 assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
 console.log('Browser QA passed: empty start, import, worker, recipe costs, tooltips, sort buttons, missing-data warning; no external requests.');
}finally{await browser.close();server.close();}
