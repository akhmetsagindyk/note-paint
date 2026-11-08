import { useEffect, useRef } from 'react';
import type { Transport } from './music';
import { cleanBand, defaultEyeBands, type EyeBands as Bands } from './eye-bands';

const hzToPosition = (hz: number) => Math.log(hz / 20) / Math.log(800) * 1000;
const positionToHz = (p: number) => Math.round(20 * 800 ** (p / 1000));
const frequency = (hz: number) => hz >= 1000 ? `${(hz / 1000).toFixed(hz % 1000 ? 1 : 0)} кГц` : `${hz} Гц`;
export function EyeBands({ bands, onChange, transport, reaction }: { bands: Bands; onChange: (bands: Bands) => void; transport: Transport | null; reaction: { lids: number; pupil: number } }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const current = useRef(bands); current.current = bands;
  useEffect(() => {
    const el = canvas.current!, ctx = el.getContext('2d')!;
    const db = new Float32Array(1024); db.fill(-Infinity);
    let frame = 0;
    const draw = () => {
      const w = el.clientWidth, h = 100, dpr = Math.min(devicePixelRatio || 1, 2);
      if (el.width !== Math.round(w * dpr) || el.height !== h * dpr) { el.width = Math.round(w * dpr); el.height = h * dpr; }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.fillStyle = '#23291e'; ctx.fillRect(0, 0, w, h);
      if (transport?.playing) transport.analyser.getFloatFrequencyData(db);
      else if (!transport || transport.time === 0) db.fill(-Infinity);
      for (const [key, color, y] of [['lids','#e0c28c',0], ['pupil','#91bbad',8]] as const) {
        const band = current.current[key], a = hzToPosition(band.from) / 1000 * w, b = hzToPosition(band.to) / 1000 * w;
        ctx.fillStyle = color; ctx.globalAlpha = .12; ctx.fillRect(a, 0, b - a, 82); ctx.globalAlpha = 1; ctx.fillRect(a, y, b - a, 3);
      }
      ctx.strokeStyle = '#d7ddca'; ctx.lineWidth = 1; ctx.beginPath();
      for (let x = 0; x < w; x++) {
        const hz = positionToHz(x / w * 1000), bin = Math.floor(hz / ((transport?.context.sampleRate ?? 48000) / 2048));
        const value = db[Math.min(db.length - 1, bin)];
        const y = 80 - Math.max(0, Math.min(1, (value + 90) / 70)) * 62;
        x ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      } ctx.stroke();
      ctx.fillStyle = '#9ca78d'; ctx.font = '8px monospace';
      for (const hz of [50, 200, 1000, 5000, 16000]) ctx.fillText(hz >= 1000 ? `${hz / 1000}k` : `${hz}`, Math.min(w - 23, hzToPosition(hz) / 1000 * w), 95);
      frame = requestAnimationFrame(draw);
    }; draw(); return () => cancelAnimationFrame(frame);
  }, [transport]);
  return <details className="frequency-panel" open><summary>Частоты движения</summary><canvas ref={canvas} className="frequency-canvas" aria-label="Спектр: золотой диапазон — веки, зелёный — зрачок"/>
    {(['lids','pupil'] as const).map(key => {
      const band = bands[key], label = key === 'lids' ? 'Веки' : 'Зрачок';
      const change = (part: 'from' | 'to' | 'gain', value: number) => {
        const updated = { ...band, [part]: value };
        if (part === 'from') updated.from = Math.min(value, band.to - 20);
        if (part === 'to') updated.to = Math.max(value, band.from + 20);
        onChange({ ...bands, [key]: cleanBand(updated, defaultEyeBands[key]) });
      };
      return <fieldset key={key} className={`frequency-band ${key}`}><legend>{label} <span>{frequency(band.from)}–{frequency(band.to)}</span></legend>
        <div className="reaction-meter"><meter aria-label={`Реакция: ${label.toLowerCase()}`} min="0" max="1" value={reaction[key]}/><output>{Math.round(reaction[key] * 100)}%</output></div>
        <div className="band-presets">{[{name:'Низ',from:30,to:200},{name:'Середина',from:300,to:2500},{name:'Верх',from:2500,to:12000}].map(p => <button key={p.name} onClick={() => onChange({ ...bands, [key]: { from:p.from, to:p.to, gain:band.gain } })}>{p.name}</button>)}</div>
        {(['from','to'] as const).map(part => <div className="band-bound" key={part}><label htmlFor={`${key}-${part}`}>{part === 'from' ? 'От' : 'До'}<input aria-label={`${label}: ${part === 'from' ? 'от' : 'до'}, Гц`} type="number" min={part === 'from' ? 20 : band.from + 20} max={part === 'from' ? band.to - 20 : 16000} step="10" value={band[part]} onChange={e => { if (Number.isFinite(e.target.valueAsNumber)) change(part, e.target.valueAsNumber); }}/><span>Гц</span></label><input id={`${key}-${part}`} aria-label={`${label}: ${part === 'from' ? 'нижняя' : 'верхняя'} частота`} aria-valuetext={frequency(band[part])} type="range" min="0" max="1000" step="1" value={hzToPosition(band[part])} onChange={e => change(part, positionToHz(Number(e.target.value)))}/></div>)}
        <label className="band-gain" htmlFor={`${key}-gain`}>Усиление <output>{band.gain.toFixed(2)}×</output></label><input id={`${key}-gain`} type="range" min="0.25" max="8" step="0.05" value={band.gain} onChange={e => change('gain',Number(e.target.value))}/>
      </fieldset>;
    })}<button className="reset-design" onClick={() => onChange({lids:{...defaultEyeBands.lids},pupil:{...defaultEyeBands.pupil}})}>Вернуть верх / низ</button><p className="frequency-note">Выбирает звук для движения. Звучание трека не меняется.</p></details>;
}
