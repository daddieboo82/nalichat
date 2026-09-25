const clamp01 = (value) => Math.max(0, Math.min(1, value));

export function transitionState(clip, at) {
  const length = Math.max(.1, (clip.out ?? clip.sourceDuration) - (clip.in ?? 0));
  const elapsed = at - clip.start;
  const remaining = clip.start + length - at;
  const fadeIn = clip.fadeIn ?? .3;
  const fadeOut = clip.fadeOut ?? .3;
  const entrance = fadeIn > 0 ? clamp01(elapsed / fadeIn) : 1;
  const exit = fadeOut > 0 ? clamp01(remaining / fadeOut) : 1;
  const type = ["cut", "wipeLeft", "wipeRight"].includes(clip.transitionIn) ? clip.transitionIn : "fade";
  return {
    type,
    opacity: (type === "fade" ? entrance : 1) * exit,
    reveal: type.startsWith("wipe") ? entrance : 1,
    audio: (type === "cut" ? 1 : entrance) * exit,
  };
}
