import { useCallback, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { AtlasEditor } from './AtlasEditor';
import { loadAtlasDesign } from './atlas-design';
import { DreamRoom, DreamControls, useDreamRoom } from './DreamRoom';
import { EyeBands } from './EyeBands';
import { cleanBand, defaultEyeBands } from './eye-bands';
import { BloomEditor } from './BloomEditor';
import { ReturnKnob } from './ReturnKnob';
import { defaultBloomDesign } from './bloom-design';
import { Bloom } from './Bloom';
import { Atlas } from './Atlas';
import { Roll } from './Roll';
import { colors, demoAudio, demoSong, parseMidi, restoreAudio, Transport, type Song } from './music';
import './style.css';

const initial = demoSong();
const stamp = (t: number) => `${Math.floor(t / 60).toString().padStart(2, '0')}:${Math.floor(t % 60).toString().padStart(2, '0')}.${Math.floor(t % 1 * 10)}`;
function App() {
  const [mode, setMode] = useState<'piano' | 'atlas' | 'bloom' | 'dream'>('piano');
  const [atlasDesign, setAtlasDesign] = useState(loadAtlasDesign);
  useEffect(() => { try { localStorage.setItem('note-paint-atlas-design',JSON.stringify(atlasDesign)); } catch {} }, [atlasDesign]);
  const [eyeBands, setEyeBands] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('note-paint-eye-bands') || 'null');
      return { lids: cleanBand(saved?.lids || {}, defaultEyeBands.lids), pupil: cleanBand(saved?.pupil || {}, defaultEyeBands.pupil) };
    } catch { return { lids: { ...defaultEyeBands.lids }, pupil: { ...defaultEyeBands.pupil } }; }
  });
  useEffect(() => { try { localStorage.setItem('note-paint-eye-bands', JSON.stringify(eyeBands)); } catch {} }, [eyeBands]);
  const [eyeReaction, setEyeReaction] = useState({ lids: 0, pupil: 0 });
  const updateEyeReaction = useCallback((lids: number, pupil: number) => setEyeReaction({ lids, pupil }), []);
  const [returnSeconds, setReturnSeconds] = useState(.8);
  const [bloomDesign, setBloomDesign] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('note-paint-bloom-design') || 'null');
      if (!saved || typeof saved !== 'object') return { ...defaultBloomDesign };
      const next = { ...defaultBloomDesign };
      for (const key of ['stage', 'card', 'ink', 'eye', 'grain'] as const) if (typeof saved[key] === 'string' && /^#[0-9a-f]{6}$/i.test(saved[key])) next[key] = saved[key];
      for (const [key, min, max] of [['width',55,125], ['height',55,100], ['radius',0,140]] as const) if (Number.isFinite(saved[key])) next[key] = Math.max(min, Math.min(max, saved[key]));
      return next;
    } catch { return { ...defaultBloomDesign }; }
  });
  useEffect(() => { try { localStorage.setItem('note-paint-bloom-design', JSON.stringify(bloomDesign)); } catch { /* Storage can be unavailable in private browsers. */ } }, [bloomDesign]);
  const [intensity, setIntensity] = useState(1);
  const [song, setSong] = useState<Song>(initial);
  const engine = useRef<Transport | null>(null);
  const [transport, setTransport] = useState<Transport | null>(null);
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const dream = useDreamRoom(audioBuffer);
  const [audioName, setAudioName] = useState('');
  const [midiName, setMidiName] = useState('midnight-demo.mid');
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [offset, setOffset] = useState(0);
  const [zoom, setZoom] = useState(8);
  const [hidden, setHidden] = useState(new Set<number>());
  const [volume, setVolume] = useState(.7);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [help, setHelp] = useState(false);
  const audioInput = useRef<HTMLInputElement>(null), midiInput = useRef<HTMLInputElement>(null);
  const getEngine = () => { if (!engine.current) { engine.current = new Transport(); engine.current.gain.gain.value = volume; setTransport(engine.current); } return engine.current; };
  const updateTime = useCallback((t: number) => { setTime(t); setPlaying(engine.current?.playing ?? false); }, []);
  const seek = (t: number) => { engine.current?.seek(t); setTime(engine.current?.time ?? 0); };
  async function load(file: File, kind: 'audio' | 'midi') {
    setError(''); setBusy(true);
    try {
      if (file.size > (kind === 'audio' ? 150 : 5) * 1024 * 1024) throw new Error(kind === 'audio' ? 'Для MVP выбери аудио меньше 150 МБ.' : 'Выбери MIDI меньше 5 МБ.');
      const data = await file.arrayBuffer();
      if (kind === 'midi') { const parsed = parseMidi(data); if (parsed.notes.length > 30000) throw new Error('Для MVP максимум 30 000 нот. Экспортируй меньше дорожек.'); getEngine().pause(); setSong(parsed); setMidiName(file.name); setHidden(new Set()); seek(0); }
      else { const e = getEngine(); const decoded = await e.context.decodeAudioData(data); e.load(decoded); setAudioBuffer(decoded); setAudioName(file.name); setTime(0); }
    } catch (err) { setError(err instanceof Error ? err.message : 'Не удалось открыть файл.'); }
    finally { setBusy(false); }
  }
  async function play() {
    setError('');
    try { const e = getEngine(); if (!e.buffer) { setError('Загрузи WAV/MP3 или нажми «Демо». MIDI содержит ноты, но не звук.'); return; } if (e.playing) e.pause(); else await e.play(); setTime(e.time); }
    catch { setError('Браузер не смог включить аудио. Попробуй Chrome или Safari.'); }
  }
  async function repairAudio() {
    if (busy) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const next = await restoreAudio(getEngine(), volume);
      engine.current = next; setTransport(next); setTime(next.time); setPlaying(next.playing);
      setNotice(next.buffer ? 'Аудиовыход пересоздан. Если была пауза, нажми «Играть».' : 'Аудиовыход пересоздан. Загрузи WAV/MP3 или запусти демо.');
    } catch (error) { setError(error instanceof Error ? error.message : 'Не удалось восстановить аудиовыход.'); }
    finally { setBusy(false); }
  }
  async function demo() { const e = getEngine(); e.pause(); const s = demoSong(); e.load(demoAudio(e.context, s)); setAudioBuffer(e.buffer); setSong(s); setMidiName('midnight-demo.mid'); setAudioName('midnight-demo • встроенный синтезатор'); setOffset(0); setHidden(new Set()); setError(''); await e.play(); }
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (event.code !== 'Space' || event.repeat || event.altKey || event.ctrlKey || event.metaKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;
      event.preventDefault();
      if (!busy) void play();
    };
    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  });
  const duration = transport?.buffer?.duration ?? song.duration;
  return <main>
    <header className="app-header"><span className="brand">NOTE PAINT</span><div className="view-tabs" role="tablist" aria-label="Визуализация"><button id="piano-tab" role="tab" aria-selected={mode === 'piano'} aria-controls="visual-panel" onClick={() => setMode('piano')}>Piano roll</button><button id="atlas-tab" role="tab" aria-selected={mode === 'atlas'} aria-controls="visual-panel" onClick={() => setMode('atlas')}>Signal atlas</button><button id="bloom-tab" role="tab" aria-selected={mode === 'bloom'} aria-controls="visual-panel" onClick={() => setMode('bloom')}>Memory bloom</button><button id="dream-tab" role="tab" aria-selected={mode === 'dream'} aria-controls="visual-panel" onClick={() => setMode('dream')}>Dream room</button></div><button className="help-toggle" onClick={() => setHelp(!help)} aria-label="Помощь">?</button></header>
    <div className="workspace">
      <section id="visual-panel" role="tabpanel" aria-labelledby={`${mode}-tab`} style={{ background: mode === 'bloom' ? bloomDesign.stage : mode === 'atlas' ? atlasDesign.stage : undefined }} className={`window player ${mode !== 'piano' ? `atlas-player ${mode === 'bloom' ? 'bloom-player' : mode === 'dream' ? 'dream-player' : ''}` : ''}`}>
        {mode === 'piano' ? <>
        <div className="titlebar"><span>▥ &nbsp; NOTEPAINT.MID — {midiName}</span><div className="chrome" aria-hidden="true">_ ▢ ×</div></div>
        <nav><button disabled={busy} onClick={() => audioInput.current?.click()}>Открыть аудио</button><button disabled={busy} onClick={() => midiInput.current?.click()}>Открыть MIDI</button><button onClick={() => setHelp(!help)}>Помощь</button><span>WIN98 EDITION</span></nav>
        <div className="trackbar">{song.tracks.map((name, i) => <label key={i}><input type="checkbox" checked={!hidden.has(i)} onChange={() => setHidden(prev => { const n = new Set(prev); n.has(i) ? n.delete(i) : n.add(i); return n; })}/><i style={{ background: colors[i % colors.length] }}/>{name}</label>)}</div>
        <div className="rollframe"><aside aria-hidden="true"><b>↖</b><b>✎</b><b>□</b><b>＋</b><b>↥</b><div className="ticks"/></aside><Roll song={song} transport={transport} offset={offset} zoom={zoom} hidden={hidden} onTime={updateTime} onSeek={seek}/></div>
        <div className="palette" aria-hidden="true">{[...colors, '#343533', '#b66779', '#a5b77b', '#6697b3', '#cbbbd3', '#efe3b5', '#b7d5cf', '#dfc1ba', '#888d89'].map((c, i) => <i key={i} style={{ background: c }}/>)}</div>
        </> : mode === 'atlas' ? <Atlas transport={transport} intensity={intensity} design={atlasDesign} onTime={updateTime}/> : mode === 'dream' ? <DreamRoom model={dream} transport={transport} onTime={updateTime}/> : <Bloom transport={transport} intensity={intensity} returnSeconds={returnSeconds} design={bloomDesign} bands={eyeBands} onReaction={updateEyeReaction} onTime={updateTime}/>}
        <div className="transport"><button className="play" disabled={busy} onClick={() => void play()}>{playing ? 'Ⅱ Пауза' : '▶ Играть'}</button><button aria-label="Стоп" onClick={() => { engine.current?.pause(); seek(0); }}>■</button><output>{stamp(time)}</output><input aria-label="Позиция воспроизведения" type="range" min="0" max={duration} step="0.01" value={Math.min(time, duration)} onChange={e => seek(Number(e.target.value))}/><span>{stamp(duration)}</span></div>
        <footer><span>{song.notes.length} NOTES · {song.tracks.length} TRACKS</span><span>{song.bpm.toFixed(0)} BPM{song.variableTempo ? ' · TEMPO MAP' : ''} <b className={transport?.playing ? 'led on' : 'led'}/></span></footer>
      </section>
      <aside className="settings">
        
        <input ref={audioInput} hidden type="file" accept=".wav,.mp3,audio/wav,audio/mpeg" onChange={e => { const f = e.target.files?.[0]; if (f) void load(f, 'audio'); e.target.value = ''; }}/>
        <input ref={midiInput} hidden type="file" accept=".mid,.midi" onChange={e => { const f = e.target.files?.[0]; if (f) void load(f, 'midi'); e.target.value = ''; }}/>
        <button className="file-card" disabled={busy} onClick={() => audioInput.current?.click()}><span className="file-icon">♫</span><span><small>01 / АУДИО</small><strong>{audioName || 'Загрузить WAV / MP3'}</strong></span><b>＋</b></button>
        {mode === 'piano' && <button className="file-card" disabled={busy} onClick={() => midiInput.current?.click()}><span className="file-icon">▥</span><span><small>02 / НОТЫ</small><strong>{midiName}</strong></span><b>＋</b></button>}
        <div className="adjust">{mode === 'piano' ? <><label>Сдвиг MIDI <output>{offset.toFixed(2)} с</output></label><input aria-label="Сдвиг MIDI в секундах" type="number" min="-60" max="60" step="0.05" value={offset} onChange={e => { const v = e.target.valueAsNumber; setOffset(Number.isFinite(v) ? Math.max(-60, Math.min(60, v)) : 0); }}/><p>Плюс — ноты появляются позже аудио.</p><label htmlFor="zoom">На экране <output>{zoom} с</output></label><input id="zoom" type="range" min="2" max="24" value={zoom} onChange={e => setZoom(Number(e.target.value))}/></> : mode !== 'dream' ? <>{mode === 'bloom' && <ReturnKnob value={returnSeconds} onChange={setReturnSeconds}/>}<label htmlFor="intensity">Чувствительность <output>{intensity.toFixed(1)}×</output></label><input id="intensity" type="range" min="0.2" max="4" step="0.1" value={intensity} onChange={e => setIntensity(Number(e.target.value))}/></> : null}<label htmlFor="volume">Громкость <output>{Math.round(volume * 100)}%</output></label><input id="volume" type="range" min="0" max="1" step="0.01" value={volume} onChange={e => { const v = Number(e.target.value); setVolume(v); if (engine.current) engine.current.gain.gain.value = v; }}/></div>
        <button className="demo" disabled={busy} onClick={() => void demo().catch(() => setError('Не удалось включить демо.'))}>♫ &nbsp; Запустить демо <span>↗</span></button>
        <button className="repair-audio" disabled={busy} onClick={() => void repairAudio()}>Восстановить звук</button>
        {mode === 'dream' && <DreamControls model={dream}/>}
        {mode === 'atlas' && <AtlasEditor design={atlasDesign} onChange={setAtlasDesign}/>}
        {mode === 'bloom' && <EyeBands bands={eyeBands} onChange={setEyeBands} transport={transport} reaction={eyeReaction}/>}
        {mode === 'bloom' && <BloomEditor design={bloomDesign} onChange={setBloomDesign}/>}
        <p className="shortcut">Пробел — играть / пауза</p>
        
      </aside>
    </div>
    {(busy || error || notice) && <div className={error ? 'message error' : 'message'} role="status">{error || (busy ? 'Подготовка аудио…' : notice)}</div>}
    {help && <section className="help"><h2>Управление</h2><p>Dream room: фото, рамка и фраза меняются на низких атаках. Это приближение к кикам, а не выделение инструмента. Загрузи свои фото или используй встроенные; выбери частоту смены и тему текста. PNG сохраняет текущую открытку. Signal atlas теперь имеет свой редактор оформления.</p><p>Memory bloom: по умолчанию высокие частоты открывают веки, низкие сужают зрачок. В «Частотах движения» можно независимо выбрать диапазоны и усиление. Индикаторы показывают силу движения, спектр — звук в выбранных диапазонах. «Возврат» управляет скоростью закрытия и восстановления зрачка. На плотном треке реакция подстраивается под фон. Оформление меняется в редакторе справа.</p><p>Пробел — играть / пауза (когда не редактируешь поле). Signal atlas реагирует на частоты и форму аудиосигнала; MIDI ему не нужен. Переключение вкладок сохраняет звук и позицию. «Чувствительность» усиливает плавную реакцию на низ, середину и верх.</p><p>Загрузи WAV/MP3 и MIDI из одного проекта, нажми «Играть». Нажатие на piano roll или ползунок перематывает аудио. Галочки скрывают дорожки только на картинке. MIDI не заменяет звук твоих плагинов.</p><p>Сетка показывает секунды. Ноты учитывают MIDI tempo map; BPM внизу — начальный. Для экспорта из FL и запуска на Mac смотри README.md в папке проекта.</p></section>}

  </main>;
}
createRoot(document.getElementById('root')!).render(<App/>);
