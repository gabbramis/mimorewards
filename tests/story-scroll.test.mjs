import test from 'node:test';
import assert from 'node:assert/strict';
import { nextStoryStop, storyTransitionDuration } from '../src/lib/story-scroll.ts';

test('fast and small gestures visit every scene in the same order', () => {
  for (const wheelDelta of [1, 120, 10000]) {
    let position = 0;
    const visited = [];
    for (let i = 0; i < 8; i++) {
      const next = nextStoryStop(position, wheelDelta);
      if (next === null) break;
      visited.push(next);
      position = next;
    }
    assert.deepEqual(visited, [.245, .59, .735, .94]);
    assert.equal(nextStoryStop(position, wheelDelta), null, 'release the page after the outro');
  }
});

test('reverse gestures can revisit every scene and leave at the start', () => {
  let position = .94;
  const visited = [];
  while (true) {
    const next = nextStoryStop(position, -10000);
    if (next === null) break;
    visited.push(next);
    position = next;
  }
  assert.deepEqual(visited, [.735, .59, .245, 0]);
});

test('tap and stamp reveal keep their duration regardless of scroll distance', () => {
  assert.equal(storyTransitionDuration(.245, .59), 1100);
  assert.equal(storyTransitionDuration(.59, .245), 1100);
  assert.equal(storyTransitionDuration(0, .245), 600);
  assert.equal(storyTransitionDuration(.59, .735), 600);
});

test('noise near a scene boundary does not snap back to the same scene', () => {
  assert.equal(nextStoryStop(.244, 1), .59);
  assert.equal(nextStoryStop(.246, -1), 0);
});

test('invalid input cannot start a scroll animation', () => {
  for (const [position, direction] of [[NaN, 1], [Infinity, 1], [0, NaN], [0, Infinity], [0, 0]]) {
    assert.equal(nextStoryStop(position, direction), null);
  }
});
