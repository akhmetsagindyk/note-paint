const clamp = (v: number) => Math.max(0, Math.min(1, v));
export function eyeBand(db: Float32Array, sampleRate: number, fftSize: number, low: number, high: number) {
  const step = sampleRate / fftSize;
  let power = 0, peak = 0;
  const a = Math.max(1, Math.ceil(low / step)), b = Math.min(db.length, Math.ceil(high / step));
  for (let i = a; i < b; i++) {
    const amplitude = Number.isFinite(db[i]) && db[i] > -72 ? 10 ** (db[i] / 20) : 0;
    power += amplitude * amplitude; peak = Math.max(peak, amplitude);
  }
  return Math.sqrt(power / Math.max(1, b - a)) + peak * .12;
}
export class EyeResponse {
  open = 0;
  bass = 0;
  private openBase = 0;
  private bassBase = 0;
  reset() { this.open = this.bass = this.openBase = this.bassBase = 0; }
  update(openingLevel: number, bassLevel: number, dt: number, sensitivity: number, returnSeconds = .8) {
    dt = Math.max(0, Math.min(.1, dt));
    const target = (value: number) => clamp(1 - Math.exp(-Math.max(0, value * sensitivity - .025) * 2));
    const smooth = (current: number, next: number, attack: number, release: number) => current + (next - current) * (1 - Math.exp(-dt / (next > current ? attack : release)));
    // React to rises above the recent local level, rather than holding open on
    // a loud, compressed mix. Sustained energy becomes the background level.
    const relative = (value: number, base: number) => Math.max(0, value - base) / (.18 + base * .6);
    const release = Math.max(.04, returnSeconds / 3);
    this.open = smooth(this.open, target(relative(openingLevel, this.openBase)), .065, release);
    this.bass = smooth(this.bass, target(relative(bassLevel, this.bassBase)), .055, release);
    const adapt = 1 - Math.exp(-dt / .65);
    this.openBase += (openingLevel - this.openBase) * adapt;
    this.bassBase += (bassLevel - this.bassBase) * adapt;
  }
  get pupilScale() { return 1 - this.bass * .7; }
}
