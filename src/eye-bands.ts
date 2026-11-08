import { eyeBand } from './eye-response';
export type EyeBand = { from: number; to: number; gain: number };
export type EyeBands = { lids: EyeBand; pupil: EyeBand };
export const defaultEyeBands: EyeBands = { lids: { from: 2500, to: 12000, gain: 2 }, pupil: { from: 30, to: 200, gain: 1 } };
export function cleanBand(value: Partial<EyeBand>, fallback: EyeBand): EyeBand {
  const from = Number.isFinite(value.from) ? Math.max(20, Math.min(15980, value.from!)) : fallback.from;
  const to = Number.isFinite(value.to) ? Math.max(from + 20, Math.min(16000, value.to!)) : Math.max(from + 20, fallback.to);
  const gain = Number.isFinite(value.gain) ? Math.max(.25, Math.min(8, value.gain!)) : fallback.gain;
  return { from, to, gain };
}
export function eyeSignals(db: Float32Array, sampleRate: number, fftSize: number, bands: EyeBands) {
  return {
    lids: eyeBand(db, sampleRate, fftSize, bands.lids.from, bands.lids.to) * 24 * bands.lids.gain,
    pupil: eyeBand(db, sampleRate, fftSize, bands.pupil.from, bands.pupil.to) * 12 * bands.pupil.gain,
  };
}
