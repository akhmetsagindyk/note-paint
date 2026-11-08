import { test } from 'node:test';
import assert from 'node:assert/strict';
import { restoreAudio, type Transport } from '../src/music';

function fake(state = 'running') {
  const t = {
    context: { state, closed: false, async resume() {}, async close() { this.closed = true; } },
    buffer: { duration: 60 }, position: 12, get time() { return this.position; }, playing: false,
    gain: { gain: { value: .7 } }, load(buffer: unknown) { this.buffer = buffer as typeof this.buffer; this.position = 0; },
    pause() { this.playing = false; }, async play() { this.playing = true; },
  };
  return t;
}
test('repair keeps decoded audio, position, volume and playback state', async () => {
  const previous = fake(), next = fake(); previous.playing = true;
  const result = await restoreAudio(previous as unknown as Transport, .42, () => next as unknown as Transport);
  assert.equal(result, next); assert.equal(next.buffer, previous.buffer);
  assert.equal(next.position, 12); assert.equal(next.gain.gain.value, .42);
  assert.equal(next.playing, true); assert.equal(previous.playing, false);
  assert.equal(previous.context.closed, true);
});
test('repair leaves paused track paused', async () => {
  const previous = fake(), next = fake();
  await restoreAudio(previous as unknown as Transport, .7, () => next as unknown as Transport);
  assert.equal(next.playing, false); assert.equal(next.position, 12);
});
test('blocked replacement does not discard the current player', async () => {
  const previous = fake(), next = fake('suspended'); previous.playing = true;
  await assert.rejects(restoreAudio(previous as unknown as Transport, .7, () => next as unknown as Transport), /не включил/);
  assert.equal(previous.playing, true); assert.equal(previous.context.closed, false);
  assert.equal(next.context.closed, true);
});
