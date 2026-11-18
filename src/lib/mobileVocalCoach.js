// On-device advisory heuristics for mobile vocal takes. No signal changes,
// speech recognition, microphone-distance measurement, upload, or AI training.
// Quiet-frame noise estimates can mistake a fan for a soft voice; advise rather
// than assert. Require several frames to avoid flickering recommendations.
export function createMobileVocalCoach({maxFrames=80}={}) {
  let frames=[];
  return {
    push(level) {
      if (!Number.isFinite(level?.rmsDb) || !Number.isFinite(level?.peakDb)) return;
      frames.push({rmsDb:level.rmsDb,peakDb:level.peakDb,clip:Boolean(level.clip)});
      if(frames.length>maxFrames) frames=frames.slice(-maxFrames);
    },
    analyze() {
      const recent=frames.slice(-40);
      const sampleCount=recent.length;
      if(sampleCount<8) return {kind:'learning',severity:'neutral',title:'Checking your recording environment',
        help:'Speak or sing at your normal level. Studio will watch for clipping and persistent room noise.'};
      const clips=recent.filter(f=>f.clip || f.peakDb>=-1).length;
      if(clips>=3) return {kind:'clipping',severity:'danger',title:'Repeated clipping detected',
        help:'Back away slightly or reduce external mic gain. Try another take if the audio sounds distorted.'};
      const quiet=recent.filter(f=>f.rmsDb < -30 && f.rmsDb > -75);
      const active=recent.filter(f=>f.rmsDb >= -26);
      if (quiet.length>=8 && active.length>=6) {
        const sorted=quiet.map(f=>f.rmsDb).sort((a,b)=>a-b);
        const floor=sorted[Math.floor(sorted.length/2)];
        const voice=active.map(f=>f.rmsDb).sort((a,b)=>a-b)[Math.floor(active.length/2)];
        const contrast=voice-floor;
        if (floor>-43 && contrast<15) return {
          kind:'noise',severity:'warning',title:'Possible background noise',
          help:'Try a quieter room, close fans or windows, and use headphones. This is an estimate based on quieter moments, not noise identification.',
          noiseEstimateDb:floor, contrastDb:contrast,
        };
      }
      const nearSilent=recent.filter(f=>f.rmsDb < -42).length;
      if(nearSilent>=Math.ceil(sampleCount*.8)) return {kind:'quiet',severity:'warning',title:'Voice may be too quiet',
        help:'Check microphone placement and speak at performance volume. Studio cannot measure your exact distance.'};
      return {kind:'ready',severity:'good',title:'Recording signal looks consistent',
        help:'Keep a similar mic position and leave headroom for louder phrases. Detailed processing is best done on PC.'};
    },
    reset(){frames=[];},
  };
}
