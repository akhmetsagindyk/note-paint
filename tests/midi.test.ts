import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as MidiPackage from '@tonejs/midi';
const Midi = MidiPackage.Midi ?? (MidiPackage as unknown as { default: typeof MidiPackage }).default.Midi;
import { parseMidi } from '../src/music';

test('MIDI note start and duration follow tempo changes across tracks', () => {
  const midi = new Midi();
  midi.header.tempos = [{ ticks: 0, bpm: 120 }, { ticks: 480, bpm: 60 }];
  midi.header.update();
  midi.addTrack().addNote({ midi: 60, ticks: 0, durationTicks: 960, velocity: .8 });
  midi.addTrack().addNote({ midi: 36, ticks: 960, durationTicks: 480, velocity: .7 });
  const parsed = parseMidi(midi.toArray().buffer as ArrayBuffer);
  assert.equal(parsed.tracks.length, 2);
  assert.equal(parsed.variableTempo, true);
  assert.ok(Math.abs(parsed.notes[0].duration - 1.5) < .001);
  assert.ok(Math.abs(parsed.notes[1].time - 1.5) < .001);
  assert.ok(Math.abs(parsed.duration - 2.5) < .001);
});
test('Empty MIDI and malformed files produce an error', () => {
  assert.throws(() => parseMidi(new Midi().toArray().buffer as ArrayBuffer), /нет нот/);
  assert.throws(() => parseMidi(new Uint8Array([1, 2, 3]).buffer));
});
