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
 async function inventory(text){
  await page.locator('#editInventory').click();await page.locator('#inventoryText').fill(text);
  await page.locator('#inventoryForm button[type=submit]').click();
  await page.waitForFunction(()=>!document.querySelector('#calculate').disabled);
 }
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
 await page.locator('#inventoryList .itemInfoTrigger').first().hover();
 await page.locator('#itemInfo').waitFor({state:'visible'});
 assert.match(await page.locator('#itemInfo').textContent(),/Nanity: 36/);
 await page.keyboard.press('Escape');
 await inventory('Epicka Bojowa Korona\nStarożytna Władcza Kurtka Narkomana');
 await page.locator('#inventoryList .itemInfoTrigger').first().hover();
 assert.match(await page.locator('#itemInfo').textContent(),/POZIOM: 108, SIŁA: 104/);
 await page.keyboard.press('Escape');
 await page.locator('#inventoryList .itemInfoTrigger').last().hover();
 assert.match(await page.locator('#itemInfo').textContent(),/POZIOM: 159, SIŁA: 164/);
 await page.route('**/item-requirements.json',route=>route.abort());
 await page.reload();
 await page.waitForFunction(()=>document.querySelector('#catalogStatus').textContent.includes('Nie wczytano dokładnych wymagań'));
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
