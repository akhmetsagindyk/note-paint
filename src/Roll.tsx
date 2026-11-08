import { useEffect, useRef } from 'react';
import { colors, type Song, type Transport } from './music';

export function Roll({ song, transport, offset, zoom, hidden, onTime, onSeek }: { song: Song; transport: Transport | null; offset: number; zoom: number; hidden: Set<number>; onTime: (t: number) => void; onSeek: (t: number) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const view = useRef({ start: 0, width: 1 });
  useEffect(() => {
    const el = canvas.current!, ctx = el.getContext('2d')!;
    const low = Math.max(0, song.notes.reduce((v, n) => Math.min(v, n.midi), 127) - 3);
    const high = Math.min(127, song.notes.reduce((v, n) => Math.max(v, n.midi), 0) + 3);
    let frame = 0;
    const draw = () => {
      const w = el.clientWidth, h = el.clientHeight, dpr = devicePixelRatio || 1;
      if (el.width !== Math.round(w * dpr) || el.height !== Math.round(h * dpr)) { el.width = Math.round(w * dpr); el.height = Math.round(h * dpr); }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const audioTime = transport?.time ?? 0, time = audioTime - offset;
      onTime(audioTime);
      const span = zoom, left = 58, top = 28, width = w - left, height = h - top;
      const start = Math.max(0, time - span * .28); view.current = { start, width };
      const rows = high - low + 1, rh = height / rows;
      const activePitches = new Set(song.notes.filter(n => !hidden.has(n.track) && n.time <= time && n.time + n.duration > time).map(n => n.midi));
      ctx.fillStyle = '#fffff8'; ctx.fillRect(0, 0, w, h); ctx.font = '11px monospace';
      const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
      for (let p = high; p >= low; p--) {
        const y = top + (high - p) * rh, black = [1, 3, 6, 8, 10].includes(p % 12);
        const active = activePitches.has(p);
        ctx.fillStyle = black ? '#f1f2eb' : '#fffffa'; ctx.fillRect(left, y, width, rh);
        ctx.fillStyle = active ? '#24275d' : black ? '#424443' : '#f5f5ed'; ctx.fillRect(0, y, left - 6, rh - .5);
        ctx.fillStyle = active || black ? '#fff' : '#666';
        if (rh > 9 || p % 12 === 0) ctx.fillText(`${names[p % 12]}${Math.floor(p / 12) - 1}`, 8, y + rh * .75);
      }
      const beat = 60 / song.bpm;
      for (let b = Math.floor(start / beat); b * beat < start + span; b++) {
        const x = left + (b * beat - start) / span * width;
        if (x < left) continue;
        ctx.strokeStyle = b % 4 === 0 ? '#d2d5cd' : '#e5e7df'; ctx.setLineDash(b % 4 === 0 ? [] : [2, 3]);
        ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, h); ctx.stroke();
      }
      ctx.setLineDash([]);
      for (const n of song.notes) {
        if (hidden.has(n.track) || n.time + n.duration < start || n.time > start + span) continue;
        const x = left + (n.time - start) / span * width, y = top + (high - n.midi) * rh + 1;
        const x1 = Math.max(left, x), nw = Math.max(1, Math.min(w, x + n.duration / span * width) - x1);
        const active = time >= n.time && time < n.time + n.duration;
        ctx.fillStyle = active ? colors[n.track % colors.length] : '#ffffff'; ctx.fillRect(x1, y, nw, Math.max(2, rh - 2));
        ctx.globalAlpha = active ? 1 : .38; ctx.fillStyle = colors[n.track % colors.length]; ctx.fillRect(x1, y, nw, Math.max(2, rh - 2)); ctx.globalAlpha = 1;
        ctx.strokeStyle = active ? '#33334f' : '#7e827d'; ctx.strokeRect(x1 + .5, y + .5, Math.max(1, nw - 1), Math.max(2, rh - 3));
      }
      ctx.fillStyle = '#e6e7de'; ctx.fillRect(0, 0, w, top); ctx.fillStyle = '#74776c';
      for (let s = Math.ceil(start); s < start + span; s++) { const x = left + (s - start) / span * width; ctx.fillText(`${s}s`, x + 3, 17); }
      const px = left + (time - start) / span * width;
      if (px >= left && px <= w) {
        ctx.strokeStyle = '#bb655f'; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(px, top); ctx.lineTo(px, h); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = '#bb655f'; ctx.beginPath(); ctx.moveTo(px - 4, 20); ctx.lineTo(px + 4, 20); ctx.lineTo(px, 27); ctx.fill();
      }
      frame = requestAnimationFrame(draw);
    };
    draw(); return () => cancelAnimationFrame(frame);
  }, [song, transport, offset, zoom, hidden, onTime]);
  return <canvas ref={canvas} aria-label="Piano roll: нажми для перемотки" onClick={e => { const x = e.clientX - e.currentTarget.getBoundingClientRect().left - 58; if (x >= 0) onSeek(Math.max(0, view.current.start + x / view.current.width * zoom + offset)); }} />;
}
