import {planJourneys,hardestCertain,liveAdvice} from './journey-sim.js';

self.onmessage=({data:{data,input,hardest,run,pending}})=>{
 try{
  if(run){self.postMessage({advice:liveAdvice(data,run,pending)});return;}
  const rows=(hardest?hardestCertain:planJourneys)(data,input);
  self.postMessage({rows});
 }catch(error){self.postMessage({error:error.message});}
};
