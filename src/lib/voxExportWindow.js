// Bound the per-clip pre-render to the audible region and a conservative tail.
// Automation and compressor history use the original timeline unless the clip
// has no pre-insert automation or Auto Polish. Align shifted starts to the
// Web Audio render quantum so native processing retains its block phase.
export function voxExportWindow(track,range,length,sampleRate){
 const first=Math.min(length,Math.ceil(range.when*sampleRate));
 const stateful=track.autoPolish===true || !!track.automationPoints?.length || !!track.muteAutomationPoints?.length;
 const origin=stateful?0:Math.floor(first/128)*128;
 // Bare fader has no tail; allow two rendering FFT windows for overlap.
 // Stateful pre-inserts keep the original tail until separately characterized.
 const end=stateful?length:Math.min(length,Math.ceil(range.endsAt*sampleRate)+4096);
 return {origin,first,end,length:end-origin,offset:(first-origin)/sampleRate,start:first/sampleRate};
}
