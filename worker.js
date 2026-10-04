import {explore} from './engine.js';
self.onmessage=({data})=>{try{const result=explore(data.items,data.tables,data.depth,p=>self.postMessage({type:'progress',...p}),{timeMs:data.timeMs||5000,maxSteps:25,states:Infinity,attempts:Infinity});self.postMessage({type:'done',...result});}catch(e){self.postMessage({type:'error',message:e.message});}};
