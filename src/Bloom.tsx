import { useEffect, useRef } from 'react';
import type { Transport } from './music';
import { blend, type BloomDesign } from './bloom-design';
import { eyeSignals, type EyeBands } from './eye-bands';
import { EyeResponse, eyeBand } from './eye-response';

export function Bloom({ transport, intensity, returnSeconds, design, bands, onReaction, onTime }: { transport: Transport | null; intensity: number; returnSeconds: number; design: BloomDesign; bands: EyeBands; onReaction: (lids: number, pupil: number) => void; onTime: (time: number) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const settings = useRef({ intensity, returnSeconds, design, bands, onReaction }); settings.current = { intensity, returnSeconds, design, bands, onReaction };
  useEffect(() => {
    const el = canvas.current!, ctx = el.getContext('2d')!;
    const db = new Float32Array(1024);
    let bandKey = '', lastMeter = -Infinity;
    const eye = new EyeResponse();
    let frame = 0, previous = transport?.time ?? 0;
    const bars = new Array<number>(7).fill(0);
    const oldSmoothing = transport?.analyser.smoothingTimeConstant;
    if (transport) transport.analyser.smoothingTimeConstant = .55;
    const noise = (x: number, y: number) => { const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return n - Math.floor(n); };
    const draw = () => {
      const w = el.clientWidth, h = el.clientHeight, dpr = Math.min(devicePixelRatio || 1, 2);
      if (el.width !== Math.round(w * dpr) || el.height !== Math.round(h * dpr)) { el.width = Math.round(w * dpr); el.height = Math.round(h * dpr); }
      const time = transport?.time ?? 0, delta = time - previous; previous = time;
      if (delta < 0 || delta > .25 || time === 0) { eye.reset(); bars.fill(0); }
      const selected = settings.current.bands;
      const key = `${selected.lids.from}:${selected.lids.to}:${selected.pupil.from}:${selected.pupil.to}`;
      if (key !== bandKey) { eye.reset(); bandKey = key; }
      onTime(time);
      if (transport?.playing) {
        transport.analyser.getFloatFrequencyData(db);
        const edges = [30, 120, 300, 800, 2000, 4000, 8000, 14000];
        const dt = delta > 0 && delta < .25 ? delta : 1 / 60;
        for (let i = 0; i < 7; i++) {
          const value = Math.min(1, eyeBand(db, transport.context.sampleRate, 2048, edges[i], edges[i + 1]) * 12 * settings.current.intensity);
          bars[i] += (value - bars[i]) * (1 - Math.exp(-dt / .16));
        }
        const signal = eyeSignals(db, transport.context.sampleRate, transport.analyser.fftSize, selected);
        eye.update(signal.lids, signal.pupil, dt, settings.current.intensity, settings.current.returnSeconds);
      }
      const now = performance.now();
      if (now - lastMeter >= 80) { settings.current.onReaction(eye.open, eye.bass); lastMeter = now; }
      ctx.setTransform(dpr * w / 800, 0, 0, dpr * h / 1080, 0, 0);
      const theme = settings.current.design;
      ctx.fillStyle = theme.stage; ctx.fillRect(0, 0, 800, 1080);
      ctx.save();
      const cw = 580 * theme.width / 100, ch = 996 * theme.height / 100;
      ctx.translate((800 - cw) / 2, (1080 - ch) / 2);
      ctx.scale(cw / 580, ch / 996); ctx.translate(-110, -42);
      ctx.fillStyle = theme.card; ctx.beginPath(); ctx.roundRect(110, 42, 580, 996, theme.radius); ctx.fill(); ctx.clip();
      // Fixed dithering seed avoids random per-frame flicker. Lids clip a radial iris.
      const ox = 128, oy = 110, ew = 544, eh = 560, mx = 400, my = 390;
      ctx.fillStyle = theme.eye; ctx.fillRect(ox, oy, ew, eh);
      const opening = eye.open, irisRadius = 108, pupil = 43 * eye.pupilScale;
      for (let yy = 0; yy < eh; yy += 3) for (let xx = 0; xx < ew; xx += 3) {
        const x = ox + xx, y = oy + yy, dx = x - mx, dy = y - my, u = dx / 252;
        const arch = Math.pow(Math.max(0, 1 - u * u), .65);
        const top = -opening * 127 * arch, bottom = opening * 103 * arch;
        const inside = Math.abs(u) < 1 && dy > top && dy < bottom;
        let shade = .035 + .06 * Math.max(0, Math.abs(dy) / 280);
        const edgeDistance = Math.min(Math.abs(dy - top), Math.abs(dy - bottom));
        if (Math.abs(u) < 1.02) shade += Math.exp(-edgeDistance / 8) * .48;
        if (inside) {
          const r = Math.hypot(dx, dy), angle = Math.atan2(dy, dx);
          shade = .035 + Math.pow(Math.abs(u), 3) * .13;
          if (r < irisRadius) {
            shade = .28 + .22 * (1 - r / irisRadius) + .25 * (Math.sin(angle * 89 + r * .12) * .5 + .5);
            if (r > irisRadius - 6) shade = .75;
            if ((dx / pupil) ** 2 + (dy / (77 * (1 - eye.bass * .35))) ** 2 < 1) shade = .98;
            if (((dx + 25) / 11) ** 2 + ((dy + 35) / 19) ** 2 < 1) shade = .02;
          }
        }
        if (noise(xx, yy) < shade) { ctx.fillStyle = theme.grain; ctx.fillRect(x, y, 2.1, 1.8); }
      }
      // Upper lash line and spaced lashes remain legible even with a closed eye.
      ctx.strokeStyle = theme.grain; ctx.lineWidth = 2.2; ctx.beginPath();
      for (let i = 0; i <= 120; i++) { const u = -1 + i / 60; const y = my - opening * 127 * Math.pow(Math.max(0, 1 - u * u), .65); i ? ctx.lineTo(mx + u * 252, y) : ctx.moveTo(mx + u * 252, y); } ctx.stroke();
      ctx.lineWidth = 1.2;
      for (let i = -18; i <= 18; i++) {
        const u = i / 19, x = mx + u * 252, y = my - opening * 127 * Math.pow(1 - u * u, .65);
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + u * 10, y - 9 - opening * 16); ctx.stroke();
      }
      // The only secondary elements: horizontal spectrum strips and a barcode.
      for (let i = 0; i < 7; i++) {
        ctx.fillStyle = blend(theme.card, theme.ink, .12); ctx.fillRect(170, 735 + i * 25, 460, 12);
        ctx.fillStyle = theme.ink; ctx.fillRect(170, 735 + i * 25, bars[i] * 460, 12);
      }
      for (let i = 0; i < 170; i++) {
        const value = bars[Math.floor(i / 25) % 7]; ctx.fillStyle = theme.ink;
        ctx.fillRect(170 + i * 2.7, 991 - 13 - value * 16, noise(i, 2) > .5 ? 1.6 : .9, 13 + value * 16);
      }
      ctx.restore();
      frame = requestAnimationFrame(draw);
    };
    draw(); return () => { cancelAnimationFrame(frame); if (transport && oldSmoothing !== undefined) transport.analyser.smoothingTimeConstant = oldSmoothing; };
  }, [transport, onTime]);
  return <canvas className="bloom-canvas" style={{ background: design.stage }} ref={canvas} aria-label="Memory bloom: глаз открывается от звука, зрачок сужается от баса"/>;
}
