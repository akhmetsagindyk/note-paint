import { useEffect, useMemo, useRef, useState } from 'react';
import type { Transport } from './music';
import { builtinScenes, detectKicks, dreamPhrase, frameAt, makeCuts, orderScenes, random, type DreamScene, type SceneKind } from './dream-engine';

export function useDreamRoom(buffer:AudioBuffer|null) {
  const [scenes,setScenes]=useState<DreamScene[]>(builtinScenes);
  const [config,setConfig]=useState({seed:37,sensitivity:1,every:2,gap:.65,language:'en' as 'en'|'ru',accent:'#1800ce',grain:.08,custom:'',theme:'auto' as 'auto'|SceneKind});
  const [hits,setHits]=useState<number[]>([]),[analyzing,setAnalyzing]=useState(false),[error,setError]=useState('');
  const [includeBuiltin,setIncludeBuiltin]=useState(true);
  const [frame,setFrame]=useState(0),[manual,setManual]=useState(0);
  const [ready,setReady]=useState(false);
  const urls=useRef(new Set<string>());
  const canvas=useRef<HTMLCanvasElement>(null);
  useEffect(()=>{setManual(0);setHits([]);if(!buffer){setAnalyzing(false);return;}setAnalyzing(true);const task=setTimeout(()=>{
    try { const channels=Array.from({length:buffer.numberOfChannels},(_,i)=>buffer.getChannelData(i));setHits(detectKicks(channels,buffer.sampleRate,config.sensitivity)); }
    catch {setError('Не удалось разобрать атаки. Можно листать кадры вручную.');}
    finally {setAnalyzing(false);}
  },30);return()=>clearTimeout(task);},[buffer,config.sensitivity]);
  useEffect(()=>()=>{for(const url of urls.current)URL.revokeObjectURL(url);},[]);
  const cuts=useMemo(()=>makeCuts(hits,config.every,config.gap),[hits,config.every,config.gap]);
  const active=useMemo(()=>{const selected=scenes.filter(s=>includeBuiltin||!s.builtin);return selected.length?selected:builtinScenes;},[scenes,includeBuiltin]);
  async function upload(files:FileList|null){if(!files)return;setError('');const available=Math.max(0,15-scenes.length);if(!available){setError('В библиотеке максимум 12 своих фото. Удали лишнее, чтобы добавить новые.');return;}const loaded:DreamScene[]=[];
    for(const file of Array.from(files).slice(0,available)){
      if(file.size>15*1024*1024||!/^image\/(jpeg|png|webp)$/.test(file.type)){setError('Выбирай JPG, PNG или WebP до 15 МБ.');continue;}
      const url=URL.createObjectURL(file);urls.current.add(url);
      try{const image=new Image();image.src=url;await image.decode();loaded.push({id:crypto.randomUUID(),url,name:file.name,kind:'liminal'});}
      catch{URL.revokeObjectURL(url);urls.current.delete(url);setError('Одно из изображений не удалось открыть.');}
    }
    setScenes(prev=>[...prev,...loaded].slice(0,15));
  }
  function remove(id:string){if(!scenes.some(s=>!s.builtin&&s.id!==id))setIncludeBuiltin(true);setScenes(prev=>{const item=prev.find(s=>s.id===id);if(item&&!item.builtin){URL.revokeObjectURL(item.url);urls.current.delete(item.url);}return prev.filter(s=>s.id!==id);});}
  function save(){if(!ready)return;canvas.current?.toBlob(blob=>{if(!blob){setError('Не удалось сохранить кадр.');return;}const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`dream-room-${config.seed}-${frame+1}.png`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);},'image/png');}
  return {scenes,setScenes,config,setConfig,hits,cuts,analyzing,error,includeBuiltin,setIncludeBuiltin,frame,setFrame,manual,setManual,canvas,active,upload,remove,save,ready,setReady};
}
export type DreamModel=ReturnType<typeof useDreamRoom>;
export function DreamRoom({model,transport,onTime}:{model:DreamModel;transport:Transport|null;onTime:(t:number)=>void}) {
  const {config,active,cuts,manual,canvas,setFrame,setReady}=model;
  const [loading,setLoading]=useState(false),[imageError,setImageError]=useState(false);
  useEffect(()=>{
    const el=canvas.current!,ctx=el.getContext('2d')!;
    const order=orderScenes(active.length,config.seed),images=new Map<string,HTMLImageElement>();
    let raf=0,reported=-1,alive=true;setLoading(true);setReady(false);setImageError(false);
    Promise.all(active.map(async scene=>{const image=new Image();image.src=scene.url;try{await image.decode();images.set(scene.id,image);}catch{if(alive)setImageError(true);}})).then(()=>{if(alive){setLoading(false);setReady(images.size>0);}});
    const custom=config.custom.split('\n').map(s=>s.trim()).filter(Boolean).slice(0,100);
    const draw=()=>{
      const time=transport?.time??0,slot=frameAt(cuts,time)+manual;
      onTime(time);if(slot!==reported){setFrame(slot);reported=slot;}
      const scene=active[order[slot%order.length]],image=images.get(scene.id)??images.values().next().value;
      const w=900,h=1200;if(el.width!==w||el.height!==h){el.width=w;el.height=h;}
      ctx.fillStyle='#c8d3d5';ctx.fillRect(0,0,w,h);
      if(image){const scale=Math.max(w/image.naturalWidth,h/image.naturalHeight);ctx.drawImage(image,(w-image.naturalWidth*scale)/2,(h-image.naturalHeight*scale)/2,image.naturalWidth*scale,image.naturalHeight*scale);}
      const rng=random(config.seed*313+slot*7919),kind=config.theme==='auto'?scene.kind:config.theme;
      const phrase=dreamPhrase(kind,config.language,config.seed,slot,custom);
      // A bounded vocabulary + stable layout seed, rather than random word salad.
      const boxX=80+rng()*120,boxY=250+rng()*310,boxW=260+rng()*140,boxH=170+rng()*140;
      const tx=Math.min(810,boxX+boxW+65),ty=boxY+boxH*.55;
      ctx.strokeStyle=config.accent;ctx.fillStyle=config.accent;ctx.lineWidth=4;
      ctx.strokeRect(boxX,boxY,boxW,boxH);
      ctx.beginPath();ctx.moveTo(tx-15,ty);ctx.lineTo(boxX+boxW+15,boxY+boxH*.5);ctx.stroke();
      const ax=boxX+boxW+15,ay=boxY+boxH*.5;
      ctx.beginPath();ctx.moveTo(ax+18,ay-10);ctx.lineTo(ax,ay);ctx.lineTo(ax+18,ay+10);ctx.stroke();
      ctx.font='42px Georgia, serif';ctx.textBaseline='top';
      const words=phrase.split(/\s+/);let line='',lines:string[]=[];
      for(const word of words){const next=line?`${line} ${word}`:word;if(ctx.measureText(next).width>310&&line){lines.push(line);line=word;}else line=next;}if(line)lines.push(line);
      // Text sits below the annotation so all phrase lengths remain on-canvas.
      const textX=Math.min(520,boxX+boxW*.4),textY=Math.min(1030,boxY+boxH+50);
      lines.slice(0,4).forEach((line,i)=>ctx.fillText(line,textX,textY+i*48,310));
      if(config.grain>0){const gr=random(config.seed+slot*71);ctx.globalAlpha=config.grain;for(let i=0;i<9000;i++){ctx.fillStyle=gr()>.5?'#fff':'#15203b';ctx.fillRect(gr()*w,gr()*h,2,2);}ctx.globalAlpha=1;}
      raf=requestAnimationFrame(draw);
    };draw();return()=>{alive=false;cancelAnimationFrame(raf);};
  },[active,cuts,config,manual,transport,onTime,canvas,setFrame,setReady]);
  return <div className="dream-stage"><canvas ref={canvas} className="dream-canvas" aria-label="Dream room: фото, рамка, стрелка и фраза меняются на атаках музыки"/>{loading&&<span className="dream-status">Открываю сцены…</span>}{imageError&&<span className="dream-status">Часть фото недоступна — загрузи свои.</span>}</div>;
}
export function DreamControls({model}:{model:DreamModel}) {
  const {config,setConfig,scenes,setScenes}=model;
  const upload=useRef<HTMLInputElement>(null);
  return <div className="dream-controls">
    <div className="dream-actions"><button onClick={()=>model.setManual(n=>n+1)}>Следующий кадр →</button><button onClick={()=>setConfig({...config,seed:config.seed+1})}>Новая серия ↻</button><button disabled={!model.ready} onClick={model.save}>Сохранить PNG ↓</button></div>
    <div className="scene-counter" role="status">Кадр {model.frame+1} · {model.analyzing?'Разбираю низкие атаки…':`${model.hits.length} атак / ${model.cuts.length} смен`}</div>
    <details open className="bloom-editor"><summary>Смена под звук</summary>
      <label htmlFor="dream-every">Менять на каждый</label><select id="dream-every" value={config.every} onChange={e=>setConfig({...config,every:Number(e.target.value)})}>{[1,2,4,8].map(n=><option key={n} value={n}>{n===1?'Каждый удар':`${n}-й удар`}</option>)}</select>
      <label htmlFor="dream-detection">Чувствительность к атакам <output>{config.sensitivity.toFixed(1)}×</output></label><input id="dream-detection" type="range" min="0.4" max="3" step="0.1" value={config.sensitivity} onChange={e=>setConfig({...config,sensitivity:Number(e.target.value)})}/>
      <label htmlFor="dream-gap">Минимум между кадрами <output>{config.gap.toFixed(2)} с</output></label><input id="dream-gap" type="range" min="0.25" max="3" step="0.05" value={config.gap} onChange={e=>setConfig({...config,gap:Number(e.target.value)})}/>
      <p className="frequency-note">Слушает атаки 30–180 Гц. Бас тоже может сработать. Без найденных атак кадр остаётся на месте.</p>
    </details>
    <details open className="bloom-editor"><summary>Фото</summary><input hidden ref={upload} type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={e=>{void model.upload(e.target.files);e.target.value='';}}/><button className="reset-design" onClick={()=>upload.current?.click()}>Добавить свои фото ＋</button>
      <label className="simple-check"><input type="checkbox" checked={model.includeBuiltin} disabled={!scenes.some(s=>!s.builtin)} onChange={e=>model.setIncludeBuiltin(e.target.checked)}/>Встроенные сцены</label>
      <div className="scene-library">{scenes.map(s=><div className="scene-row" key={s.id}><img src={s.url} alt={s.name}/><select aria-label={`Тип сцены: ${s.name}`} value={s.kind} onChange={e=>setScenes(prev=>prev.map(item=>item.id===s.id?{...item,kind:e.target.value as SceneKind}:item))}><option value="sky">Небо</option><option value="stairs">Лестницы</option><option value="liminal">Переходы</option></select>{!s.builtin&&<button aria-label={`Убрать фото ${s.name}`} onClick={()=>model.remove(s.id)}>×</button>}</div>)}</div><p className="frequency-note">Встроенные сцены созданы для проекта. Свои фото остаются в браузере до перезагрузки.</p>
    </details>
    <details className="bloom-editor" open><summary>Фразы и графика</summary>
      <label htmlFor="dream-language">Язык</label><select id="dream-language" value={config.language} onChange={e=>setConfig({...config,language:e.target.value as 'en'|'ru'})}><option value="en">English</option><option value="ru">Русский</option></select>
      <label htmlFor="dream-theme">Тема фраз</label><select id="dream-theme" value={config.theme} onChange={e=>setConfig({...config,theme:e.target.value as typeof config.theme})}><option value="auto">По типу фото</option><option value="sky">Небо / свет</option><option value="stairs">Путь / возвращение</option><option value="liminal">Память / знакомые места</option></select>
      <label htmlFor="dream-custom">Свои фразы — по одной на строку</label><textarea id="dream-custom" rows={4} maxLength={4000} value={config.custom} onChange={e=>setConfig({...config,custom:e.target.value})}/>
      <label className="dream-color">Рамка, стрелка, текст<input type="color" aria-label="Цвет Dream room" value={config.accent} onChange={e=>setConfig({...config,accent:e.target.value})}/></label>
      <label htmlFor="dream-grain">Зерно</label><input id="dream-grain" type="range" min="0" max="0.3" step="0.01" value={config.grain} onChange={e=>setConfig({...config,grain:Number(e.target.value)})}/>
    </details>{model.error&&<p className="frequency-note" role="status">{model.error}</p>}
  </div>;
}
