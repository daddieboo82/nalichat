import { describe, expect, it } from "vitest";
import { transitionState } from "./videoTransitions";

const clip = { start: 2, in: 0, out: 4, fadeIn: 1, fadeOut: 1 };
describe("clip entrance transitions", () => {
  it("fades picture and audio together", () => {
    expect(transitionState(clip, 2.5)).toMatchObject({ opacity: .5, audio: .5, reveal: 1 });
  });
  it("wipes the picture while ramping audio", () => {
    expect(transitionState({ ...clip, transitionIn: "wipeLeft" }, 2.5)).toMatchObject({ opacity: 1, audio: .5, reveal: .5 });
  });
  it("cuts in immediately", () => {
    expect(transitionState({ ...clip, transitionIn: "cut" }, 2)).toMatchObject({ opacity: 1, audio: 1, reveal: 1 });
  });
});
