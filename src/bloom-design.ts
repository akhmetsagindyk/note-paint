export type BloomDesign = {
  stage: string; card: string; ink: string; eye: string; grain: string;
  width: number; height: number; radius: number;
};
export const defaultBloomDesign: BloomDesign = {
  stage: '#e5e3da', card: '#efeee5', ink: '#182014', eye: '#c8ccbd', grain: '#222b1e',
  width: 100, height: 90, radius: 32,
};
export function blend(a: string, b: string, amount: number) {
  const rgb = (hex: string) => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
  const x = rgb(a), y = rgb(b);
  return `rgb(${x.map((v, i) => Math.round(v + (y[i] - v) * amount)).join(',')})`;
}
