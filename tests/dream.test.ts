import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectKicks, makeCuts, frameAt, orderScenes, dreamPhrase } from '../src/dream-engine';

function pulses(frequency:number){const rate=8000,signal=new Float32Array(rate*5);for(let beat=0;beat<8;beat++){const start=Math.floor((.3+beat*.55)*rate);for(let i=0;i<rate*.2;i++)signal[start+i]=.5*Math.sin(2*Math.PI*frequency*i/rate)*Math.exp(-i/rate*22);}return signal;}
test('low attacks are detected, silence and isolated treble do not cut scenes',()=>{
  const hits=detectKicks([pulses(70)],8000);
  assert.ok(hits.length>=7&&hits.length<=9,`hits: ${hits}`);
  assert.equal(detectKicks([new Float32Array(8000)],8000).length,0);
  assert.equal(detectKicks([pulses(2000)],8000).length,0);
  for(let i=1;i<hits.length;i++)assert.ok(hits[i]-hits[i-1]>.19);
});
test('cuts respect stride, minimum spacing and deterministic seeking',()=>{
  const cuts=makeCuts([0,.5,1,1.5,2,2.5,3],2,.6);
  assert.deepEqual(cuts,[1.5,2.5]);
  assert.equal(frameAt(cuts,0),0);assert.equal(frameAt(cuts,2.6),2);assert.equal(frameAt(cuts,1.6),1);
  assert.deepEqual(makeCuts([],1,.5),[]);
});
test('scene order and phrases are repeatable and use chosen semantic pool',()=>{
  const order=orderScenes(5,37);assert.deepEqual(order,orderScenes(5,37));assert.equal(new Set(order).size,5);
  assert.equal(dreamPhrase('sky','en',37,0,[]),dreamPhrase('sky','en',37,0,[]));
  assert.equal(dreamPhrase('stairs','en',0,0,[]),'one more floor');
  assert.equal(dreamPhrase('sky','ru',0,1,['hello','home']),'home');
});
