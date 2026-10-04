import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
export function writeJson(file,value,indent=2){
 const target=file instanceof URL?fileURLToPath(file):file;
 const temporary=target+'.tmp';
 fs.writeFileSync(temporary,JSON.stringify(value,(key,item)=>key==='parsed'?undefined:item,indent)+'\n');
 fs.renameSync(temporary,target);
}
