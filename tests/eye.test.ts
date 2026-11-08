import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EyeResponse, eyeBand } from '../src/eye-response';

test('silence closes eye; an opening transient leaves pupil unchanged', () => {
  const eye = new EyeResponse();
  const db = new Float32Array(1024).fill(-Infinity);
  assert.equal(eyeBand(db, 48000, 2048, 2500, 12000), 0);
  eye.update(0, 0, 1 / 60, 1); assert.equal(eye.open, 0);
  db[256] = -20;
  const high = eyeBand(db, 48000, 2048, 2500, 12000) * 24;
  const low = eyeBand(db, 48000, 2048, 30, 200) * 12;
  for (let i = 0; i < 12; i++) eye.update(high, low, 1 / 60, 1);
  assert.ok(eye.open > .4); assert.equal(eye.pupilScale, 1);
  for (let i = 0; i < 180; i++) eye.update(0, 0, 1 / 60, 1);
  assert.ok(eye.open < .001);
});
test('bass constricts pupil independently; pause preserves response', () => {
  const eye = new EyeResponse();
  for (let i = 0; i < 12; i++) eye.update(0, .8, 1 / 60, 1);
  assert.equal(eye.open, 0); assert.ok(eye.pupilScale < .5);
  const before = JSON.stringify(eye); eye.update(1, 0, 0, 1);
  assert.equal(JSON.stringify(eye), before);
  for (let i = 0; i < 180; i++) eye.update(0, 0, 1 / 60, 1);
  assert.ok(eye.pupilScale > .999);
});

test('dense sustained mix stops holding the eye wide open, a new rise reopens it', () => {
  const eye = new EyeResponse();
  for (let i = 0; i < 12; i++) eye.update(2, 1, 1 / 60, 1);
  assert.ok(eye.open > .7);
  for (let i = 0; i < 600; i++) eye.update(2, 1, 1 / 60, 1);
  assert.ok(eye.open < .01);
  eye.update(4, 2, .1, 1);
  assert.ok(eye.open > .4);
});
test('return knob controls both eyelids and pupil release', () => {
  const fast = new EyeResponse(), slow = new EyeResponse();
  for (let i = 0; i < 12; i++) {
    fast.update(1, 1, 1 / 60, 1, .2);
    slow.update(1, 1, 1 / 60, 1, 2);
  }
  for (let i = 0; i < 24; i++) {
    fast.update(0, 0, 1 / 60, 1, .2);
    slow.update(0, 0, 1 / 60, 1, 2);
  }
  assert.ok(fast.open < .01 && fast.bass < .01);
  assert.ok(slow.open > .3 && slow.bass > .3);
});
