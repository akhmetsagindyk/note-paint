// Smooth, bounded deformation: sensitivity changes strength, never detects hits.
export class Drift {
  low = 0;
  mid = 0;
  high = 0;
  reset() { this.low = this.mid = this.high = 0; }
  update(low: number, mid: number, high: number, dt: number, sensitivity: number) {
    dt = Math.max(0, Math.min(.1, dt));
    const target = (value: number) => 1.7 * (1 - Math.exp(-Math.max(0, value - .035) * sensitivity * 1.6));
    const smooth = (current: number, next: number) => current + (next - current) * (1 - Math.exp(-dt / (next > current ? .13 : .32)));
    this.low = smooth(this.low, target(low));
    this.mid = smooth(this.mid, target(mid));
    this.high = smooth(this.high, target(high));
  }
}
