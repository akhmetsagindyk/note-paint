import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Drift } from '../src/drift';

test('mid and treble react without bass; sensitivity amplifies both smoothly', () => {
  const normal = new Drift(), sensitive = new Drift();
  for (let i = 0; i < 60; i++) {
    normal.update(0, .3, .2, 1 / 60, 1);
    sensitive.update(0, .3, .2, 1 / 60, 3);
  }
  assert.equal(normal.low, 0);
  assert.ok(normal.mid > .3 && normal.high > .2);
  assert.ok(sensitive.mid > normal.mid && sensitive.high > normal.high);
});
test('a transient fades smoothly and response is independent of frame rate', () => {
  const slow = new Drift(), fast = new Drift();
  for (let i = 0; i < 30; i++) slow.update(.6, .3, .2, 1 / 30, 1);
  for (let i = 0; i < 120; i++) fast.update(.6, .3, .2, 1 / 120, 1);
  assert.ok(Math.abs(slow.low - fast.low) < .00001);
  const before = slow.low;
  slow.update(0, 0, 0, 1 / 60, 1);
  assert.ok(slow.low < before && slow.low > before * .9);
  for (let i = 0; i < 180; i++) slow.update(0, 0, 0, 1 / 60, 1);
  assert.ok(slow.low < .001);
});
