// The VisualViewport reports the actually visible area of a mobile screen.
// If Android resized the layout viewport, innerHeight and visualHeight move
// together and this difference is zero. If the keyboard overlays the layout
// (including landscape iOS), the difference is the needed composer lift.
export function chatKeyboardOffset(layoutHeight, visualHeight, visualOffsetTop = 0) {
  if (![layoutHeight, visualHeight, visualOffsetTop].every(Number.isFinite)) return 0;
  const obscured = Math.max(0, layoutHeight - visualHeight - visualOffsetTop);
  // Browser chrome changes are typically small; ignore those rather than
  // making the composer jump as the URL bar collapses or expands.
  return obscured > 80 ? obscured : 0;
}
