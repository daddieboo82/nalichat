export const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value) || 0));
export const clipLength = (clip) => Math.max(0.1, (clip.out ?? clip.sourceDuration) - (clip.in ?? 0));
export const projectLength = (clips) => Math.max(0, ...clips.map((clip) => clip.start + clipLength(clip)));

export function splitClip(clips, id, time) {
  const clip = clips.find((item) => item.id === id);
  if (!clip || time <= clip.start + 0.1 || time >= clip.start + clipLength(clip) - 0.1) return clips;
  const offset = time - clip.start;
  return clips.flatMap((item) => item.id === id ? [
    { ...item, out: item.in + offset },
    { ...item, id: crypto.randomUUID(), start: time, in: item.in + offset },
  ] : [item]);
}

export function trimClip(clips, id, edge, value) {
  return clips.map((item) => {
    if (item.id !== id) return item;
    if (edge === "left") {
      const nextStart = clamp(value, Math.max(0, item.start - item.in), item.start + clipLength(item) - 0.1);
      return { ...item, in: item.in + nextStart - item.start, start: nextStart };
    }
    return { ...item, out: clamp(value, item.in + 0.1, item.sourceDuration) };
  });
}

export const formatTime = (seconds) => {
  const value = Math.max(0, Number(seconds) || 0);
  const minutes = Math.floor(value / 60);
  return `${String(minutes).padStart(2, "0")}:${String(Math.floor(value % 60)).padStart(2, "0")}.${String(Math.floor((value % 1) * 10))}`;
};
