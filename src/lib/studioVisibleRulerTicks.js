// Compute only ruler ticks near the viewport, keeping absolute beat numbering.
export function studioVisibleRulerTicks(beatCount, stride, pixelsPerBeat, viewport) {
  if (![beatCount,stride,pixelsPerBeat].every(Number.isFinite) || beatCount <= 0 || stride < 1 || pixelsPerBeat <= 0) return [];
  const total = Math.ceil(beatCount / stride);
  if (!viewport || !Number.isFinite(viewport.left) || !Number.isFinite(viewport.width) || viewport.width <= 0) {
    return Array.from({length: Math.min(total,2000)}, (_,i)=>i*stride);
  }
  const spacing = pixelsPerBeat * stride;
  const first = Math.max(0, Math.floor((viewport.left-256)/spacing));
  const last = Math.min(total, Math.ceil((viewport.left+viewport.width+256)/spacing)+1);
  return Array.from({length: Math.max(0,last-first)},(_,i)=>(first+i)*stride);
}
