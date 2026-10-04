import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const budget=Number(process.argv[2]||0);
if(!Number.isSafeInteger(budget)||budget<1||budget>2000)throw new Error('Provide a total remote-request budget (1–2000).');
const file=new URL('../tests/fixtures/official-r21.json',import.meta.url);
const count=()=>JSON.parse(fs.readFileSync(file)).length;
const initial=count();
for(const category of ['head','chest','legs','rings','neck','melee1','melee2'])for(let quality=18;quality<30;quality++){
 const remaining=budget-(count()-initial);
 if(remaining<=0){console.log('Global request budget exhausted. Results are checkpointed.');process.exit(2);}
 const run=spawnSync(process.execPath,[fileURLToPath(new URL('./calibrate-requirements.mjs',import.meta.url)),category,String(quality),String(Math.min(60,remaining))],{stdio:'inherit'});
 if(run.status!==0)process.exit(run.status||1);
 console.log('GLOBAL newly fetched',count()-initial,'of',budget);
}
