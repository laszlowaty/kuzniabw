// Missing-planner memory QA: node tests/missing-memory-browser.mjs /path/to/playwright/index.mjs
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
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(origin);
 await page.waitForFunction(()=>document.querySelector('#catalogStatus').textContent.includes('Dane R21 gotowe'));
 await page.locator('#editInventory').click();
 await page.locator('#inventoryText').fill(Array(25).fill('Bojowa Czapka Gladiatora (+1)').join('\n'));
 await page.locator('#inventoryForm button[type=submit]').click();
 const cdp=await page.context().newCDPSession(page);
 async function heap(){await cdp.send('HeapProfiler.collectGarbage');return (await cdp.send('Runtime.getHeapUsage')).usedSize/1048576;}
 const samples=[];
 for(let run=0;run<4;run++){
  await page.locator('#goalCategory').selectOption('head');
  await page.locator('#goalPrefix').selectOption('smiercionosny');
  await page.locator('#goalSuffix').selectOption('prekognicji');
  await page.locator('#goalSteps').selectOption('2');
  await page.locator('#goalTimeBudget').selectOption('60');
  await page.locator('#goalSearch').click();
  await page.locator('#goalMissingList').waitFor({timeout:30000});
  assert.match(await page.locator('.goalStatus').textContent(),/limit pamięci/);
  assert.equal(await page.locator('#goalPlanList>details').count(),100);
  const loaded=await heap();
  await page.locator('#goalSteps').selectOption('1');
  assert.equal(await page.locator('#goalPlanList').count(),0);
  const cleared=await heap();
  assert.equal(page.workers().length,0,'completed search worker must be terminated');
  samples.push({loadedMB:loaded,clearedMB:cleared});
 }
 assert.ok(samples.every(sample=>sample.loadedMB<150),JSON.stringify(samples));
 assert.ok(samples.at(-1).clearedMB-samples[0].clearedMB<5,JSON.stringify(samples));
 // Cancellation must release the worker as well as rendered results.
 const started=page.waitForEvent('worker');
 await page.locator('#goalSearch').click();
 const worker=await started,closed=worker.waitForEvent('close');
 await page.locator('#goalStop').click();
 await closed;
 await heap();
 assert.equal(page.workers().length,0);
 assert.deepEqual(errors,[]);
 console.log('Missing memory browser QA passed:',JSON.stringify(samples));
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
