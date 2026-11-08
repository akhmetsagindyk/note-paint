export type SceneKind = 'sky' | 'stairs' | 'liminal';
export type DreamScene = { id:string; url:string; name:string; kind:SceneKind; builtin?:boolean };
const assetBase = import.meta.env?.BASE_URL ?? '/';
export const builtinScenes: DreamScene[] = [
  {id:'sky',url:`${assetBase}scenes/sky.jpg`,name:'cloud archive',kind:'sky',builtin:true},
  {id:'stairs',url:`${assetBase}scenes/stairs.jpg`,name:'one more floor',kind:'stairs',builtin:true},
  {id:'corridor',url:`${assetBase}scenes/corridor.jpg`,name:'empty passage',kind:'liminal',builtin:true},
];
// Fixed seed: identical timeline + settings give identical frames after seeking.
export function random(seed:number) { let x=seed|0; return () => { x+=0x6d2b79f5; let t=Math.imul(x^(x>>>15),1|x); t^=t+Math.imul(t^(t>>>7),61|t); return ((t^(t>>>14))>>>0)/4294967296; }; }
export function orderScenes(count:number,seed:number) {
  const order=Array.from({length:count},(_,i)=>i), rng=random(seed);
  for(let i=count-1;i>0;i--){const j=Math.floor(rng()*(i+1)); [order[i],order[j]]=[order[j],order[i]];}
  return order;
}
const phrases = {
  en:{sky:['heaven?','remember this light','you were here before','the sky remembers','a little closer','somewhere softer'],stairs:['one more floor','is this the way home?','you never left','follow the quiet','the exit remembers you','almost there'],liminal:['you are here','does this feel familiar?','someone left the light on','please stay a little longer','a place between places','we meet here again']},
  ru:{sky:['небо помнит','мы уже были здесь','ближе к свету','здесь тихо','ты узнаёшь это место?','где-то мягче'],stairs:['ещё один этаж','это путь домой?','ты никуда не уходил','следуй за тишиной','почти пришли','выход помнит тебя'],liminal:['ты здесь','кажется, я это помню','кто-то оставил свет','побудь ещё немного','между двумя местами','увидимся здесь снова']},
};
export function dreamPhrase(kind:SceneKind, language:'en'|'ru', seed:number, frame:number, custom:string[]) {
  const pool=custom.length?custom:phrases[language][kind];
  return pool[(Math.abs(seed)+frame)%pool.length];
}
// Scan the decoded audio once. A 30–180 Hz envelope with a local baseline and
// refractory period approximates kick attacks; it is not stem separation.
export function detectKicks(channels:Float32Array[],sampleRate:number,sensitivity=1):number[] {
  if(!channels.length||!channels[0].length) return [];
  const hop=Math.max(32,Math.floor(sampleRate*.01)), lowA=1-Math.exp(-2*Math.PI*30/sampleRate), highA=1-Math.exp(-2*Math.PI*180/sampleRate);
  const envelope:number[]=[],full:number[]=[]; let low=0, band=0, band2=0, sum=0, total=0, count=0, peak=0, fullPeak=0;
  for(let i=0;i<channels[0].length;i++) {
    let x=0; for(const channel of channels)x+=channel[i]||0; x/=channels.length;
    low+=(x-low)*lowA; band+=(x-low-band)*highA; band2+=(band-band2)*highA; sum+=band2*band2;total+=x*x;count++;
    if(count===hop){const v=Math.sqrt(sum/count); const f=Math.sqrt(total/count);envelope.push(v);full.push(f);peak=Math.max(peak,v);fullPeak=Math.max(fullPeak,f);sum=0;total=0;count=0;}
  }
  if(peak<.00005||peak<fullPeak*.07)return [];
  const hits:number[]=[]; let baseline=0, previous=0, last=-1;
  for(let i=0;i<envelope.length;i++) {
    const v=envelope[i], time=i*hop/sampleRate;
    const threshold=baseline*(1.85-Math.min(3,Math.max(.4,sensitivity))*.24)+peak*.025/Math.max(.4,sensitivity);
    if(v>threshold&&v>full[i]*.08&&v>peak*.045&&v>previous*1.02&&time-last>.19){hits.push(time);last=time;}
    baseline+=(v-baseline)*.065;previous=v;
  }
  return hits;
}
export function makeCuts(hits:number[],every:number,gap:number) {
  const cuts:number[]=[];let last=0;
  for(let i=0;i<hits.length;i++)if((i+1)%every===0&&hits[i]>=gap&&hits[i]-last>=gap){cuts.push(hits[i]);last=hits[i];}
  return cuts;
}
export function frameAt(cuts:number[],time:number){let a=0,b=cuts.length;while(a<b){const m=(a+b)>>>1;if(cuts[m]<=time)a=m+1;else b=m;}return a;}
