import { defaultAtlasDesign, type AtlasDesign } from './atlas-design';
export function AtlasEditor({ design, onChange }: { design: AtlasDesign; onChange:(design:AtlasDesign)=>void }) {
  return <details className="bloom-editor" open><summary>Редактор Signal atlas</summary>
    {([['width','Ширина',55,100,1],['height','Высота',55,100,1],['radius','Скругление',0,120,1],['dots','Размер точек',.5,2.5,.1]] as const).map(([key,label,min,max,step]) => <div className="editor-range" key={key}><label htmlFor={`atlas-${key}`}>{label}<output>{design[key]}{key==='dots'?'×':key==='radius'?'':'%'}</output></label><input id={`atlas-${key}`} type="range" min={min} max={max} step={step} value={design[key]} onChange={e=>onChange({...design,[key]:Number(e.target.value)})}/></div>)}
    <div className="color-grid">{([['stage','Внешний фон'],['background','Фон рисунка'],['ink','Точки и сигнал'],['lines','Рамки'],['detail','Детали']] as const).map(([key,label])=><label key={key}>{label}<input aria-label={label} type="color" value={design[key]} onChange={e=>onChange({...design,[key]:e.target.value})}/></label>)}</div>
    <label className="simple-check"><input type="checkbox" checked={design.titles} onChange={e=>onChange({...design,titles:e.target.checked})}/>Надписи</label>
    <button className="reset-design" onClick={()=>onChange({...defaultAtlasDesign})}>Сбросить Signal atlas</button>
  </details>;
}
