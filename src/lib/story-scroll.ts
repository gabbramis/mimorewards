export const SCENE_STOPS = [0, .245, .59, .735, .94] as const;
export const STORY_END = SCENE_STOPS[SCENE_STOPS.length - 1];

// Large wheel/touch deltas advance one beat, just like a small gesture.
export function nextStoryStop(progress: number, direction: number): number | null {
  if (!Number.isFinite(progress) || !Number.isFinite(direction) || direction === 0) return null;
  return (direction > 0
    ? SCENE_STOPS.find(stop => stop > progress + .012)
    : [...SCENE_STOPS].reverse().find(stop => stop < progress - .012)) ?? null;
}

export function storyTransitionDuration(from: number, to: number): number {
  // Keep the tap and stamp reveal legible even with a fast wheel or swipe.
  return (from < .5 && to >= .5) || (from > .5 && to <= .5) ? 1100 : 600;
}
