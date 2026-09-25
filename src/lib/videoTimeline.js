import { transformAt } from "./videoKeyframes";

export const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value) || 0));
export const clipLength = (clip) => Math.max(0.1, (clip.out ?? clip.sourceDuration) - (clip.in ?? 0));
export const projectLength = (clips) => Math.max(0, ...clips.map((clip) => clip.start + clipLength(clip)));

export function splitClip(clips, id, time) {
  const clip = clips.find((item) => item.id === id);
  if (!clip || time <= clip.start + 0.1 || time >= clip.start + clipLength(clip) - 0.1) return clips;
  const offset = time - clip.start;
  const boundary = { ...transformAt(clip, time), time: offset };
  return clips.flatMap((item) => item.id === id ? [
    { ...item, out: item.in + offset, keyframes: item.keyframes?.length ? [...item.keyframes.filter((frame) => frame.time < offset), boundary] : [] },
    { ...item, id: crypto.randomUUID(), start: time, in: item.in + offset, keyframes: item.keyframes?.length ? [{ ...boundary, time: 0 }, ...item.keyframes.filter((frame) => frame.time > offset).map((frame) => ({ ...frame, time: frame.time - offset }))] : [] },
  ] : [item]);
}

export function trimClip(clips, id, edge, value) {
  return clips.map((item) => {
    if (item.id !== id) return item;
    if (edge === "left") {
      const nextStart = clamp(value, Math.max(0, item.start - item.in), item.start + clipLength(item) - 0.1);
      const shift = nextStart - item.start;
      const keyframes = item.keyframes?.length ? [{ ...transformAt(item, nextStart), time: 0 }, ...item.keyframes.filter((frame) => frame.time > shift).map((frame) => ({ ...frame, time: frame.time - shift }))] : [];
      return { ...item, in: item.in + shift, start: nextStart, keyframes };
    }
    const out = clamp(value, item.in + 0.1, item.sourceDuration);
    const duration = out - item.in;
    const keyframes = item.keyframes?.length ? [...item.keyframes.filter((frame) => frame.time < duration), { ...transformAt(item, item.start + duration), time: duration }] : [];
    return { ...item, out, keyframes };
  });
}

export const formatTime = (seconds) => {
  const value = Math.max(0, Number(seconds) || 0);
  const minutes = Math.floor(value / 60);
  return `${String(minutes).padStart(2, "0")}:${String(Math.floor(value % 60)).padStart(2, "0")}.${String(Math.floor((value % 1) * 10))}`;
};
