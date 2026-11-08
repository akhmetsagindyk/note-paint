import { defaultBloomDesign, type BloomDesign } from './bloom-design';

export function BloomEditor({ design, onChange }: { design: BloomDesign; onChange: (design: BloomDesign) => void }) {
  const range = (key: 'width' | 'height' | 'radius', label: string, min: number, max: number, suffix: string) => <div className="editor-range"><label htmlFor={`design-${key}`}>{label}<output>{design[key]}{suffix}</output></label><input id={`design-${key}`} type="range" min={min} max={max} value={design[key]} onChange={e => onChange({ ...design, [key]: Number(e.target.value) })}/></div>;
  return <details className="bloom-editor" open><summary>Редактор</summary>
    {range('width', 'Ширина карточки', 55, 125, '%')}
    {range('height', 'Высота карточки', 55, 100, '%')}
    {range('radius', 'Скругление', 0, 140, '')}
    <div className="color-grid">{([['stage','Фон'], ['card','Карточка'], ['ink','Полосы'], ['eye','Подложка глаза'], ['grain','Глаз и зерно']] as const).map(([key, label]) => <label key={key}>{label}<input type="color" aria-label={label} value={design[key]} onChange={e => onChange({ ...design, [key]: e.target.value })}/></label>)}</div>
    <button className="reset-design" onClick={() => onChange({ ...defaultBloomDesign })}>Сбросить оформление</button>
  </details>;
}
