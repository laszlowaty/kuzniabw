// Missing-item sidebar UI QA: node tests/missing-list-browser.mjs /path/to/playwright/index.mjs
// Uses an installed browser; Playwright is not a runtime/project dependency.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {fileURLToPath,pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
import {parseInventory,label} from '../engine.js';
const data=JSON.parse(fs.readFileSync(new URL('../data.json',import.meta.url),'utf8'));
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
 await page.locator('#editInventoryFromGoal').click();
 await page.locator('#inventoryText').fill('Bojowa Czapka Gladiatora (+1)');
 await page.locator('#inventoryForm button[type=submit]').click();
 await page.locator('#missingTab').click();
 await page.locator('#goalCategory').selectOption('head');
 await page.locator('#goalPrefix').selectOption('smiercionosny');
 await page.locator('#goalSuffix').selectOption('prekognicji');
 await page.locator('#goalSteps').selectOption('1');
 await page.locator('#goalSearch').click();
 await page.locator('#goalMissingList').waitFor();
 const initial=await page.locator('#goalMissingList').inputValue();
 function expectedAffixes(text,axis){
  const parsed=parseInventory(text.replace(/^\d+ - /gm,''),data);
  assert.deepEqual(parsed.errors,[]);
  return [...new Set(parsed.items.map(item=>item[axis]).filter(Boolean).map(label))].sort((a,b)=>a.localeCompare(b,'pl')).join('\n');
 }
 async function checkAffixModes(fullText){
  for(const axis of ['prefix','suffix']){
   await page.locator('#goalMissingListMode').selectOption(axis);
   assert.equal(await page.locator('#goalMissingList').inputValue(),expectedAffixes(fullText,axis),`${axis}: exact set from all missing items`);
   assert.equal(await page.locator('#goalMissingList').getAttribute('aria-label'),axis==='prefix'?'Unikalne prefiksy':'Unikalne sufiksy');
   if(process.env.UI_SCREENSHOTS)await page.locator('.goalMissingSidebar').screenshot({path:path.join(process.env.UI_SCREENSHOTS,`missing-${axis}-desktop.png`)});
  }
 }
 assert.ok(initial.split('\n').length>100,'List includes more than one page of ingredients');
 assert.equal(await page.locator('#goalPlanList details').count(),100);
 assert.ok(initial.split('\n').every(line=>/^[12] - .+/.test(line)));
 assert.equal(new Set(initial.split('\n').map(line=>line.slice(4))).size,initial.split('\n').length);
 const sidebarBox=await page.locator('.goalMissingSidebar').boundingBox();
 const plansBox=await page.locator('#goalPlanList').boundingBox();
 assert.ok(sidebarBox.x>plansBox.x+plansBox.width,'Desktop sidebar is beside recipes');
 await page.locator('#goalShowMore').click();
 assert.equal(await page.locator('#goalMissingList').inputValue(),initial,'Pagination does not change the list');
 const displayed=await page.locator('#goalPlanList details').count();
 await page.locator('#goalPlanList details').nth(1).locator('summary').click();
 await checkAffixModes(initial);
 assert.equal(await page.locator('#goalPlanList details').count(),displayed,'Mode keeps pagination');
 assert.equal(await page.locator('#goalPlanList details').nth(1).evaluate(e=>e.open),true,'Mode keeps open recipes');
 await page.locator('#goalMissingListMode').selectOption('items');
 assert.equal(await page.locator('#goalMissingList').inputValue(),initial,'Full item quantities are preserved');
 await page.locator('#goalStepsFilter').selectOption('1');
 await page.locator('#goalMissingFilter').selectOption('2');
 assert.ok((await page.locator('#goalPlanList summary').allTextContents()).every(text=>text.startsWith('1 spaw · brakuje 2:')));
 await page.context().grantPermissions(['clipboard-read','clipboard-write']);
 for(const mode of ['items','prefix','suffix']){
  await page.locator('#goalMissingListMode').selectOption(mode);
  await page.locator('#goalCopyList').click();
  await page.waitForFunction(()=>document.querySelector('#goalCopyStatus').textContent==='Skopiowano listę.');
  assert.equal((await page.evaluate(()=>navigator.clipboard.readText())).replace(/\r\n/g,'\n'),await page.locator('#goalMissingList').inputValue(),`Copy ${mode}`);
 }
 const prefixValue=await page.locator('#goalPrefixFilter option').nth(1).getAttribute('value');
 await page.locator('#goalPrefixFilter').selectOption(prefixValue);
 assert.equal(await page.locator('#goalMissingListMode').inputValue(),'suffix','Filters preserve list mode');
 await page.locator('#goalMissingListMode').selectOption('items');
 const filtered=await page.locator('#goalMissingList').inputValue();
 assert.ok(filtered.length>0&&filtered.length<initial.length,'Affix filter narrows recipes');
 await checkAffixModes(filtered);
 await page.locator('#goalPrefixFilter').selectOption('');
 await page.locator('#goalTextFilter').fill('nieistniejacy item');
 assert.equal(await page.locator('#goalMissingList').inputValue(),'');
 assert.equal(await page.locator('#goalCopyList').isDisabled(),true);
 assert.equal(await page.locator('#goalMissingList').getAttribute('placeholder'),'Brak kombinacji pasujących do filtrów.');
 await page.locator('#goalTextFilter').fill('');
 await page.setViewportSize({width:375,height:800});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true);
 const mobileSidebar=await page.locator('.goalMissingSidebar').boundingBox();
 const mobilePlans=await page.locator('#goalPlanList').boundingBox();
 assert.ok(mobileSidebar.y+mobileSidebar.height<=mobilePlans.y,'Mobile list is above recipes');
 for(const width of [320,375,768]){
  await page.setViewportSize({width,height:800});
  for(const mode of ['items','prefix','suffix']){
   await page.locator('#goalMissingListMode').selectOption(mode);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`${mode} fits ${width}px`);
   if(process.env.UI_SCREENSHOTS&&width===375)await page.locator('.goalMissingSidebar').screenshot({path:path.join(process.env.UI_SCREENSHOTS,`missing-${mode}-mobile.png`)});
  }
 }
 await page.evaluate(()=>{navigator.clipboard.writeText=async()=>{throw new Error('Clipboard denied for QA');};});
 await page.locator('#goalCopyList').click();
 await page.waitForFunction(()=>document.querySelector('#goalCopyStatus').textContent.startsWith('Zaznaczono listę.'));
 assert.equal(await page.locator('#goalMissingList').evaluate(e=>document.activeElement===e&&e.selectionStart===0&&e.selectionEnd===e.value.length),true,'Clipboard failure selects the entire current list');
 await page.locator('#goalSteps').selectOption('2');
 assert.equal(await page.locator('#goalMissingList').count(),0,'New target clears the old list');
 await page.locator('#goalCategory').selectOption('gun1');
 await page.locator('#goalBase').selectOption('magnum');
 await page.locator('#goalSteps').selectOption('1');
 await page.locator('#goalSearch').click();
 await page.locator('#goalMissingList').waitFor();
 assert.equal(await page.locator('#goalMissingListMode').inputValue(),'suffix','New search keeps the display preference');
 for(const mode of ['prefix','suffix']){
  await page.locator('#goalMissingListMode').selectOption(mode);
  assert.equal(await page.locator('#goalMissingList').inputValue(),'');
  assert.equal(await page.locator('#goalCopyList').isDisabled(),true);
  assert.match(await page.locator('#goalMissingList').getAttribute('placeholder'),/nie mają/);
 }
 await page.locator('#goalMissingListMode').selectOption('items');
 assert.ok((await page.locator('#goalMissingList').inputValue()).length>0,'No affixes does not mean no missing items');
 assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
 console.log('Missing list browser QA passed: exact unique affixes, all results, quantities, filters, all copy modes and fallback, pagination/open recipe preservation, 320–1440px, empty affixes and new search.');
}finally{await browser.close();server.close();}
