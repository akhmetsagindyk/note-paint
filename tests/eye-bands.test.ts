import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanBand, defaultEyeBands, eyeSignals } from '../src/eye-bands';
import { EyeResponse } from '../src/eye-response';

test('default routing isolates bass to pupil and treble to lids', () => {
  const db = new Float32Array(1024).fill(-Infinity);
  db[3] = -20; // 70.3 Hz, bass only.
  const bass = eyeSignals(db, 48000, 2048, defaultEyeBands);
  assert.equal(bass.lids, 0); assert.ok(bass.pupil > .1);
  const eye = new EyeResponse();
  for (let i = 0; i < 12; i++) eye.update(bass.lids, bass.pupil, 1 / 60, 1);
  assert.equal(eye.open, 0); assert.ok(eye.pupilScale < .8);
  db.fill(-Infinity); db[256] = -20; // 6 kHz, treble only.
  const treble = eyeSignals(db, 48000, 2048, defaultEyeBands);
  assert.ok(treble.lids > .1); assert.equal(treble.pupil, 0);
  const other = new EyeResponse();
  for (let i = 0; i < 12; i++) other.update(treble.lids, treble.pupil, 1 / 60, 1);
  assert.ok(other.open > .5); assert.equal(other.pupilScale, 1);
});
test('custom ranges can swap routing, gain affects only its own detector', () => {
  const db = new Float32Array(1024).fill(-Infinity); db[3] = -20;
  const swapped = { lids: { ...defaultEyeBands.pupil }, pupil: { ...defaultEyeBands.lids } };
  const result = eyeSignals(db, 48000, 2048, swapped);
  assert.ok(result.lids > 0); assert.equal(result.pupil, 0);
  const louder = eyeSignals(db, 48000, 2048, { ...swapped, lids: { ...swapped.lids, gain: 3 } });
  assert.ok(Math.abs(louder.lids - result.lids * 3) < .000001);
  assert.equal(louder.pupil, result.pupil);
});
test('invalid saved ranges remain finite and ordered', () => {
  assert.deepEqual(cleanBand({ from: NaN, to: Infinity, gain: NaN }, defaultEyeBands.lids), defaultEyeBands.lids);
  const range = cleanBand({ from: 50000, to: -5, gain: -3 }, defaultEyeBands.lids);
  assert.ok(range.from >= 20 && range.to <= 16000 && range.to > range.from);
  assert.equal(range.gain, .25);
});
