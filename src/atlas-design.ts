export type AtlasDesign = { stage: string; background: string; ink: string; lines: string; detail: string; width: number; height: number; radius: number; dots: number; titles: boolean };
export const defaultAtlasDesign: AtlasDesign = { stage:'#131412', background:'#131412', ink:'#e3e4d8', lines:'#62635b', detail:'#8b8d82', width:100, height:100, radius:0, dots:1, titles:true };
export function loadAtlasDesign(): AtlasDesign {
  const next = { ...defaultAtlasDesign };
  try {
    const saved = JSON.parse(localStorage.getItem('note-paint-atlas-design') || 'null');
    if (!saved) return next;
    for (const key of ['stage','background','ink','lines','detail'] as const) if (/^#[0-9a-f]{6}$/i.test(saved[key])) next[key] = saved[key];
    for (const [key,min,max] of [['width',55,100],['height',55,100],['radius',0,120],['dots',.5,2.5]] as const) if (Number.isFinite(saved[key])) next[key] = Math.max(min,Math.min(max,saved[key]));
    if (typeof saved.titles === 'boolean') next.titles = saved.titles;
  } catch {}
  return next;
}
