import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Transport, restoreAudio } from '../src/music';

// These tests exercise the real Transport with a fake browser output. They
// verify session selection before the output is opened, not physical audibility.
test('music output selects playback without requiring Audio Session support', async t => {
  let sessionAtCreation: string | undefined;
  let readSession = () => undefined as string | undefined;
  class FakeContext {
    state = 'suspended';
    currentTime = 0;
    destination = {};
    constructor() { sessionAtCreation = readSession(); }
    createGain() { return { gain: { value: 1 }, connect() {} }; }
    createAnalyser() { return { connect() {} }; }
    createBufferSource() { return { buffer: null, connect() {}, disconnect() {}, start() {}, stop() {}, onended: null }; }
    async resume() { this.state = 'running'; }
    async close() { this.state = 'closed'; }
  }
  const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const originalContext = Object.getOwnPropertyDescriptor(globalThis, 'AudioContext');
  t.after(() => {
    for (const [key, descriptor] of [['navigator', originalNavigator], ['AudioContext', originalContext]] as const) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  });
  Object.defineProperty(globalThis, 'AudioContext', { configurable: true, value: FakeContext });
  const setNavigator = (value: unknown) => Object.defineProperty(globalThis, 'navigator', { configurable: true, value });

  await t.test('selects playback before context creation and preserves transport controls', async () => {
    const session = { type: 'auto' };
    readSession = () => session.type;
    setNavigator({ audioSession: session });
    const transport = new Transport();
    assert.equal(sessionAtCreation, 'playback');
    transport.load({ duration: 60 } as AudioBuffer);
    await transport.play();
    (transport.context as unknown as FakeContext).currentTime = 8;
    transport.pause();
    assert.equal(transport.position, 8);
    transport.seek(23);
    await transport.play();
    assert.equal(transport.time, 23);
    assert.equal(transport.playing, true);
    assert.equal(transport.gain.gain.value, .7);

    // Recovery must configure the new output too and retain the current track.
    session.type = 'auto';
    const next = await restoreAudio(transport, .42);
    assert.equal(sessionAtCreation, 'playback');
    assert.equal(next.buffer, transport.buffer);
    assert.equal(next.time, 23);
    assert.equal(next.playing, true);
    assert.equal(next.gain.gain.value, .42);
    assert.equal(transport.context.state, 'closed');
  });
  readSession = () => undefined;
  for (const [label, navigator] of [
    ['unsupported API', {}],
    ['unavailable navigator', undefined],
    ['restricted getter', { get audioSession() { throw new Error('restricted'); } }],
    ['restricted setter', { audioSession: { set type(_value: string) { throw new Error('restricted'); } } }],
  ] as const) {
    await t.test(label, async () => {
      setNavigator(navigator);
      const transport = new Transport();
      transport.load({ duration: 60 } as AudioBuffer);
      await transport.play();
      assert.equal(transport.playing, true);
    });
  }
});
