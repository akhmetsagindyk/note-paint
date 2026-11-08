import { useEffect, useRef } from 'react';
import type { Transport } from './music';
import type { AtlasDesign } from './atlas-design';
import { Drift } from './drift';

// A continuous drift is deformed by smooth energy from all three bands.
// The paused frame is retained instead of advancing an unrelated animation clock.
export function Atlas({ transport, intensity, design, onTime }: { transport: Transport | null; intensity: number; design: AtlasDesign; onTime: (time: number) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const themeRef = useRef(design); themeRef.current = design;
  const sensitivity = useRef(intensity);
  sensitivity.current = intensity;
  useEffect(() => {
    const el = canvas.current!, ctx = el.getContext('2d')!;
    const freq = new Uint8Array(1024), wave = new Uint8Array(2048);
    let frame = 0, bass = 0, mid = 0, air = 0;
    const drift = new Drift();
    let lastTime = transport?.time ?? 0;
    const previousSmoothing = transport?.analyser.smoothingTimeConstant;
    if (transport) transport.analyser.smoothingTimeConstant = .7;
    const draw = () => {
      const intensity = sensitivity.current;
      const w = el.clientWidth, h = el.clientHeight, dpr = Math.min(devicePixelRatio || 1, 2);
      if (el.width !== Math.round(w * dpr) || el.height !== Math.round(h * dpr)) { el.width = Math.round(w * dpr); el.height = Math.round(h * dpr); }
      const time = transport?.time ?? 0;
      const delta = time - lastTime;
      if (delta < 0 || delta > .25 || time === 0) drift.reset();
      lastTime = time;
      onTime(time);
      if (transport?.playing) {
        transport.analyser.getByteFrequencyData(freq);
        transport.analyser.getByteTimeDomainData(wave);
        const band = (lo: number, hi: number) => {
          const hz = transport.context.sampleRate / transport.analyser.fftSize;
          const a = Math.max(1, Math.floor(lo / hz)), b = Math.min(freq.length, Math.ceil(hi / hz));
          let value = 0; for (let i = a; i < b; i++) value += freq[i] / 255;
          return value / Math.max(1, b - a);
        };
        const lowBand = band(30, 200), midBand = band(200, 3000), highBand = band(3000, 10000);
        drift.update(lowBand, midBand, highBand, delta > 0 && delta < .25 ? delta : 1 / 60, intensity);
        bass = drift.low; mid = drift.mid; air = drift.high;
      } else if (time === 0) { bass = mid = air = 0; freq.fill(0); wave.fill(128); }
      const clock = time;
      const movement = bass * .55 + mid * .9 + air * .65;
      ctx.setTransform(dpr * w / 800, 0, 0, dpr * h / 800, 0, 0);
      const theme = themeRef.current;
      ctx.fillStyle = theme.stage; ctx.fillRect(0, 0, 800, 800);
      ctx.save();
      const dw = 800 * theme.width / 100, dh = 800 * theme.height / 100;
      ctx.translate((800-dw)/2,(800-dh)/2); ctx.scale(dw/800,dh/800);
      ctx.beginPath(); ctx.roundRect(0,0,800,800,theme.radius); ctx.fillStyle=theme.background; ctx.fill(); ctx.clip();
      const line = theme.lines, ink = theme.ink;
      ctx.strokeStyle = line; ctx.lineWidth = .8;
      const box = (x: number, y: number, width: number, height: number) => ctx.strokeRect(x, y, width, height);
      ctx.fillStyle = ink; ctx.font = 'bold 37px Arial'; if (theme.titles) ctx.fillText('SIGNAL ATLAS', 38, 66);
      ctx.font = '9px monospace'; ctx.fillStyle = theme.detail; if (theme.titles) ctx.fillText('AUDIO / FIELD STUDIES', 40, 91);
      if (theme.titles) ctx.fillText('001', 729, 91);
      box(40, 118, 466, 220); box(522, 118, 238, 640); box(40, 354, 466, 404);
      ctx.beginPath(); ctx.moveTo(310, 118); ctx.lineTo(310, 338); ctx.moveTo(40, 188); ctx.lineTo(310, 188); ctx.moveTo(310, 258); ctx.lineTo(506, 258); ctx.stroke();
      ctx.fillStyle = ink; ctx.font = '9px monospace'; if (theme.titles) ctx.fillText('SIGNAL / ATLAS', 54, 143);
      ctx.fillStyle = theme.detail; ctx.font = '7px monospace'; if (theme.titles) ctx.fillText('01 / LOW FREQUENCIES', 54, 165); if (theme.titles) ctx.fillText('02 / WAVEFORM', 54, 210);
      // Oscilloscope: actual audio samples, rather than a decorative sine wave.
      ctx.strokeStyle = ink; ctx.beginPath();
      for (let i = 0; i < 240; i++) { const x = 54 + i, y = 267 + ((wave[Math.floor(i / 240 * wave.length)] ?? 128) - 128) / 128 * 45 * intensity; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
      ctx.stroke();
      ctx.fillStyle = theme.detail; if (theme.titles) ctx.fillText(`LOW ${bass.toFixed(2)} / MID ${mid.toFixed(2)}`, 54, 317);
      // Rotating phase compass, expanded by low-frequency energy.
      const cx = 408, cy = 188;
      for (let i = 0; i < 18; i++) {
        const a = i / 18 * Math.PI * 2 + clock * .15, radius = 31 + movement * 20 + Math.sin(i * 2 + clock) * mid * 10;
        ctx.strokeStyle = i % 3 ? theme.detail : ink; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * radius, cy + Math.sin(a) * radius); ctx.stroke();
      }
      // Logarithmic spectrum.
      for (let i = 0; i < 42; i++) { const bin = Math.min(1023, Math.floor(2 ** (i / 41 * 9))); const value = Math.min(1.5, freq[bin] / 255 * intensity); ctx.fillStyle = i % 3 ? theme.detail : ink; ctx.fillRect(324 + i * 4, 322 - 8 - value * 44, 2, 8 + value * 44); }
      // Warped point field, with bass displacement and mid/high detail.
      ctx.save(); ctx.beginPath(); ctx.rect(41, 355, 464, 402); ctx.clip();
      for (let row = 0; row < 50; row++) for (let col = 0; col < 48; col++) {
        const u = col / 47, v = row / 49;
        const phase = u * 8 + v * 6 + clock * .65;
        const depth = Math.sin(phase) * Math.cos(v * 5 - clock * .3);
        const x = 72 + u * 395 + Math.sin(v * 10 + clock * .6) * (9 + movement * 26) * Math.sin(u * Math.PI);
        const y = 394 + v * 310 + Math.sin(phase) * (18 + movement * 22) + Math.sin(u * 20 - clock) * mid * 20 + Math.cos(v * 12 + clock * .4) * air * 12;
        const r = Math.max(.3, (1.1 + depth * .85 + movement * .5) * (.6 + Math.sin(u * Math.PI) * .65));
        ctx.globalAlpha = Math.min(1, Math.max(.12, .55 + depth * .4 + air * .25)); ctx.fillStyle = ink;
        ctx.beginPath(); ctx.arc(x, y, r * theme.dots, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore(); ctx.globalAlpha = 1;
      // Deterministic threshold field, like a strip of damaged film or data printout.
      for (let y = 132; y < 742; y += 4) for (let x = 534; x < 748; x += 4) {
        const u = (x - 534) / 214, v = (y - 132) / 610;
        const field = Math.sin(u * 17 + Math.sin(v * 13 + clock * .25) * (2.2 + movement * 2.4)) + Math.cos(v * 23 - clock * .4 + u * 4 + mid * 1.3 + air * .9) * .65;
        const grain = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453 % 1;
        if (Math.abs(field) < .27 + mid * .24 + grain * .16) { ctx.fillStyle = grain > .3 ? theme.detail : ink; ctx.fillRect(x, y, 2.6 + air * .4, 2.4); }
      }
      ctx.fillStyle = theme.detail; ctx.font = '7px monospace'; if (theme.titles) ctx.fillText('PHASE / SOUND IN SPACE', 53, 743);
      ctx.restore();
      frame = requestAnimationFrame(draw);
    };
    draw(); return () => { cancelAnimationFrame(frame); if (transport && previousSmoothing !== undefined) transport.analyser.smoothingTimeConstant = previousSmoothing; };
  }, [transport, onTime]);
  return <canvas className="atlas-canvas" ref={canvas} aria-label="Signal atlas: аудиореактивное поле точек, осциллограмма и спектр"/>;
}
