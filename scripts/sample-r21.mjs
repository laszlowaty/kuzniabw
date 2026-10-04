// Deliberate, bounded QA samples. Never enumerate the remote catalogue.
// Existing records are reused; no requests are made by the offline test suite.
import fs from 'node:fs';
import {setTimeout as delay} from 'node:timers/promises';
import {parseInventory} from '../engine.js';
import {officialUrl,itemClass} from '../item-details.js';
import {writeJson} from './write-json.mjs';

const data=JSON.parse(fs.readFileSync(new URL('../data.json',import.meta.url)));
const catalog=JSON.parse(fs.readFileSync(new URL('../item-catalog.json',import.meta.url)));
const args=process.argv.slice(2),validation=args[0]==='--validation';
if(validation)args.shift();
const file=new URL(validation?'../tests/fixtures/validation-r21.json':'../tests/fixtures/official-r21.json',import.meta.url);
const records=fs.existsSync(file)?JSON.parse(fs.readFileSync(file)):[];
const names=args;
if(!names.length||names.length>50)throw new Error('Provide 1–50 explicit item names. Cached names will not be downloaded again.');
const text=html=>html.replace(/<[^>]*>/g,'').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/\s+/g,' ').trim();
for(const name of names){
 const {items,errors}=parseInventory(name,data);
 if(errors.length||items.length!==1)throw new Error(`Unknown item: ${name}`);
 const node=items[0],url=officialUrl(node,catalog);
 if(records.some(r=>r.url===url))continue;
 await delay(1500);
 const response=await fetch(url,{signal:AbortSignal.timeout(20000)});
 // Stop immediately on errors, throttling or an unexpected page; no retry loop.
 if(!response.ok)throw new Error(`HTTP ${response.status}: ${url}`);
 const html=await response.text();
 const officialName=text(html.match(/Przedmiot:\s*<span[^>]*>(.*?)<\/span>/s)?.[1]||'');
 const body=html.match(/<div style="float: left; width: 70%; margin-left: 10px;">([\s\S]*?)<b>STREFA/ )?.[1];
 if(!officialName||!body)throw new Error(`Unexpected catalogue response: ${url}`);
 const lines=body.split(/<br\s*\/?\s*>/i).map(text).filter(Boolean);
 const last=lines.find(s=>s.startsWith('Cena:'));
 const mana=Number(last?.match(/Mana:\s*(\d+)/)?.[1]),nanites=Number(last?.match(/Nanity:\s*(\d+)/)?.[1]);
 if(!Number.isSafeInteger(mana)||!Number.isSafeInteger(nanites))throw new Error(`Invalid costs: ${url}`);
 const official=parseInventory(officialName,data);
 if(official.errors.length||official.items.length!==1||itemClass(official.items[0])!==Number(new URL(url).searchParams.get('class')))throw new Error(`Returned item has a different quality: ${officialName}`);
 for(const field of ['category','base','prefix','suffix','rarity'])if(official.items[0][field]!==node[field])throw new Error(`Returned item differs in ${field}: ${officialName}`);
 records.push({node:official.items[0],name:officialName,lines,mana,nanites,url,checkedAt:new Date().toISOString().slice(0,10)});
 fs.mkdirSync(new URL('../tests/fixtures/',import.meta.url),{recursive:true});
 writeJson(file,records);
 console.log(officialName,`mana=${mana} nanites=${nanites}`,lines.find(s=>s.startsWith('Wymagania:')));
}
