import { clamp } from "./videoTimeline";

const DEFAULT = { x: 0, y: 0, scale: 1 };

export function transformAt(clip, timelineTime) {
  const at = clamp(timelineTime - clip.start, 0, Math.max(0, clip.out - clip.in));
  const frames = [...(clip.keyframes || [])].sort((a, b) => a.time - b.time);
  if (!frames.length) return DEFAULT;
  if (at <= frames[0].time) return { x: frames[0].x, y: frames[0].y, scale: frames[0].scale };
  if (at >= frames.at(-1).time) {
    const last = frames.at(-1);
    return { x: last.x, y: last.y, scale: last.scale };
  }
  const nextIndex = frames.findIndex((frame) => frame.time >= at);
  const left = frames[nextIndex - 1];
  const right = frames[nextIndex];
  const progress = (at - left.time) / (right.time - left.time);
  return {
    x: left.x + (right.x - left.x) * progress,
    y: left.y + (right.y - left.y) * progress,
    scale: left.scale + (right.scale - left.scale) * progress,
  };
}

export function setTransformKeyframe(clip, timelineTime, patch = {}) {
  const at = Math.round(clamp(timelineTime - clip.start, 0, Math.max(0, clip.out - clip.in)) * 100) / 100;
  const value = { ...transformAt(clip, clip.start + at), ...patch, time: at };
  const frames = (clip.keyframes || []).filter((frame) => Math.abs(frame.time - at) > .005);
  return { ...clip, keyframes: [...frames, value].sort((a, b) => a.time - b.time) };
}

export function removeTransformKeyframe(clip, timelineTime) {
  const at = clamp(timelineTime - clip.start, 0, Math.max(0, clip.out - clip.in));
  return { ...clip, keyframes: (clip.keyframes || []).filter((frame) => Math.abs(frame.time - at) > .01) };
}
