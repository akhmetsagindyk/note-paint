import * as MidiPackage from '@tonejs/midi';
const Midi = MidiPackage.Midi ?? (MidiPackage as unknown as { default: typeof MidiPackage }).default.Midi;

export type Note = { midi: number; time: number; duration: number; velocity: number; track: number };
export type Song = { notes: Note[]; tracks: string[]; duration: number; bpm: number; variableTempo: boolean };
export const colors = ['#9da8e0', '#e9af95', '#8cc9b3', '#d4a0c8', '#d4c574', '#8ebfd8'];
export function parseMidi(data: ArrayBuffer): Song {
  const midi = new Midi(data);
  const tracks = midi.tracks.filter(t => t.notes.length);
  const notes = tracks.flatMap((t, track) => t.notes.map(n => ({ midi: n.midi, time: n.time, duration: n.duration, velocity: n.velocity, track })));
  if (!notes.length) throw new Error('В MIDI нет нот. Попробуй экспорт из Piano roll.');
  return { notes, tracks: tracks.map((t, i) => t.name || `Дорожка ${i + 1}`), duration: midi.duration, bpm: midi.header.tempos[0]?.bpm ?? 120, variableTempo: midi.header.tempos.length > 1 };
}
export function demoSong(): Song {
  const notes: Note[] = [];
  const add = (midi: number, beat: number, length: number, track: number, velocity = .7) => notes.push({ midi, time: beat * .5, duration: length * .5, track, velocity });
  for (let bar = 0; bar < 8; bar++) {
    const root = [48, 44, 51, 46][bar % 4];
    [0, 4, 7].forEach(n => add(root + n + 12, bar * 4, 3.6, 1, .45));
    [0, 1.5, 2.5, 3].forEach((b, i) => add(root - 12 + (i === 3 ? 12 : 0), bar * 4 + b, .65, 2));
    [0, .75, 1.5, 2, 2.75, 3.5].forEach((b, i) => add(root + [24, 31, 27, 26, 24, 19][i], bar * 4 + b, .4, 0));
  }
  return { notes, tracks: ['MELODY', 'CHORDS', 'BASS'], duration: 16, bpm: 120, variableTempo: false };
}
function createPlaybackContext(): AudioContext {
  // iOS otherwise treats Web Audio as ambient: the silent switch mutes the
  // speakers even while the context clock and analyser keep running.
  // Select the session before creating the output, including during recovery.
  try {
    const session = (globalThis.navigator as Navigator & { audioSession?: { type: string } } | undefined)?.audioSession;
    if (session) session.type = 'playback';
  } catch {
    // Audio Session is optional; a missing or restricted API must not block audio.
  }
  return new AudioContext();
}
// A single AudioContext clock drives both the buffer and the canvas playhead.
export class Transport {
  context = createPlaybackContext();
  buffer: AudioBuffer | null = null;
  source: AudioBufferSourceNode | null = null;
  gain = this.context.createGain();
  analyser = this.context.createAnalyser();
  position = 0;
  started = 0;
  playing = false;
  constructor() {
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = .8;
    this.analyser.connect(this.gain);
    this.gain.connect(this.context.destination);
    this.gain.gain.value = .7;
  }
  get time() { return this.playing ? Math.min(this.buffer?.duration ?? 0, this.position + this.context.currentTime - this.started) : this.position; }
  pause() { this.position = this.time; this.playing = false; if (this.source) { this.source.onended = null; this.source.stop(); this.source.disconnect(); this.source = null; } }
  seek(time: number) { const active = this.playing; this.pause(); this.position = Math.max(0, Math.min(time, this.buffer?.duration ?? 0)); if (active) void this.play(); }
  async play() {
    await this.context.resume();
    if (this.context.state !== 'running') throw new Error('Аудиовыход браузера недоступен. Нажми «Восстановить звук».');
    if (!this.buffer || this.playing) return;
    if (this.position >= this.buffer.duration) this.position = 0;
    const source = this.context.createBufferSource(); source.buffer = this.buffer; source.connect(this.analyser);
    this.source = source; this.started = this.context.currentTime; this.playing = true;
    source.onended = () => { if (this.source === source) { this.position = this.buffer!.duration; this.playing = false; source.disconnect(); this.source = null; } };
    source.start(this.started, this.position);
  }
  load(buffer: AudioBuffer) { this.pause(); this.buffer = buffer; this.position = 0; }
}
// Recreate the whole output graph after a browser/device interruption. Keep the
// existing transport intact until the replacement context can actually run.
export async function restoreAudio(previous: Transport, volume: number, create = () => new Transport()): Promise<Transport> {
  const next = create();
  try {
    next.gain.gain.value = volume;
    if (previous.buffer) next.load(previous.buffer);
    await next.context.resume();
    if (next.context.state !== 'running') throw new Error('Safari не включил аудиовыход. Попробуй открыть страницу в другой вкладке.');
    const active = previous.playing;
    next.position = previous.time;
    if (active && next.buffer) await next.play();
    previous.pause();
    void previous.context.close().catch(() => {});
    return next;
  } catch (error) {
    next.pause();
    void next.context.close().catch(() => {});
    throw error;
  }
}
export function demoAudio(context: AudioContext, song: Song) {
  const rate = context.sampleRate;
  const buffer = context.createBuffer(1, Math.ceil(song.duration * rate), rate);
  const out = buffer.getChannelData(0);
  for (const n of song.notes) {
    const start = Math.floor(n.time * rate), length = Math.floor(n.duration * rate), freq = 440 * 2 ** ((n.midi - 69) / 12);
    for (let i = 0; i < length && start + i < out.length; i++) {
      const t = i / rate, env = Math.min(1, t / .008) * Math.exp(-t * (n.track === 2 ? 5 : 3)) * Math.min(1, (length - i) / (rate * .03));
      out[start + i] += Math.sin(2 * Math.PI * freq * t) * env * n.velocity * .17;
    }
  }
  for (let beat = 0; beat < 32; beat++) {
    const start = Math.floor(beat * .5 * rate);
    for (let i = 0; i < rate * .22 && start + i < out.length; i++) { const t = i / rate; out[start + i] += Math.sin(2 * Math.PI * (45 * t + 6 * (1 - Math.exp(-t * 30)))) * Math.exp(-t * 22) * .35; }
  }
  return buffer;
}
