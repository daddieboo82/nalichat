// Analyze the exact mono PCM16 WAV format emitted by NaliChat, in bounded slices.
// Other WAV layouts must use the normal Web Audio decoder.
export async function analyzeStudioPcmWav(blob, pointCount) {
  const points = Math.floor(pointCount);
  if (!Number.isInteger(points) || points < 1 || points > 16000 || blob.size < 46) throw new Error('Invalid PCM waveform input');
  const h = new DataView(await blob.slice(0,44).arrayBuffer());
  const tag = (o,s) => [...s].every((c,i)=>h.getUint8(o+i)===c.charCodeAt(0));
  const rate=h.getUint32(24,true), bytes=h.getUint32(40,true);
  if (!tag(0,'RIFF') || !tag(8,'WAVE') || !tag(12,'fmt ') || !tag(36,'data') ||
      h.getUint32(16,true)!==16 || h.getUint16(20,true)!==1 || h.getUint16(22,true)!==1 ||
      h.getUint16(34,true)!==16 || h.getUint16(32,true)!==2 || h.getUint32(28,true)!==rate*2 ||
      rate<8000 || rate>192000 || !bytes || bytes%2 || bytes+44!==blob.size || h.getUint32(4,true)!==bytes+36) throw new Error('Unsupported PCM WAV layout');
  const frames=bytes/2, waveform=Array(points).fill(0);
  let peak=0, energy=0, clipped=0, bin=0;
  for(let offset=0;offset<bytes;offset+=1024*1024){
    const data=new DataView(await blob.slice(44+offset,44+Math.min(bytes,offset+1024*1024)).arrayBuffer());
    for(let j=0;j<data.byteLength;j+=2){
      const frame=(offset+j)/2, value=data.getInt16(j,true)/32768, magnitude=Math.abs(value);
      peak=Math.max(peak,magnitude);energy+=value*value;if(magnitude>=0.995)clipped++;
      while(bin<points-1 && frame>=Math.max(Math.floor(bin*frames/points)+1,Math.floor((bin+1)*frames/points)))bin++;
      waveform[bin]=Math.max(waveform[bin],magnitude);
      // Short clips can share a sample across several waveform bins.
      while(bin<points-1 && Math.floor((bin+1)*frames/points)<=frame){
        bin++;waveform[bin]=Math.max(waveform[bin],magnitude);
      }
    }
  }
  const peakDb=peak?20*Math.log10(peak):-Infinity, rmsDb=energy?10*Math.log10(energy/frames):-Infinity, clippingRatio=clipped/frames;
  let status='good',note='Recording level looks healthy. Keep using headphones to avoid bleed.';
  if(peak<=0.0001 || rmsDb<-55){status='silent';note='Your microphone was extremely quiet. Check mic permission, distance and input gain.';}
  else if(clippingRatio>=0.001 || peakDb>-0.1){status='clipping';note='Your microphone may be clipping. Lower input gain or move back before recording again.';}
  else if(rmsDb<-35 && peakDb<-18){status='quiet';note='This take is very quiet. Move closer or raise microphone gain; do not boost background noise afterward.';}
  return {waveform,duration:frames/rate,captureQuality:{status,note,peakDb,rmsDb,clippingRatio,sampleRate:rate,channels:1}};
}


// Read only the requested source frames. The reader may be backed by a Blob
// or a validated HTTP byte-range source; offsets are absolute file bytes.
export function studioPcmRegionLayout(header, fileSize, startTime, endTime, requestedPoints = 2048) {
  if (!(header instanceof DataView) || header.byteLength < 44 ||
      !Number.isSafeInteger(fileSize) || !Number.isFinite(startTime) ||
      !Number.isFinite(endTime) || endTime <= startTime ||
      !Number.isFinite(requestedPoints) || requestedPoints < 1) return null;
  const tag = (offset, value) => [...value].every((c,i) => header.getUint8(offset+i) === c.charCodeAt(0));
  const rate = header.getUint32(24,true), bytes = header.getUint32(40,true);
  const channels = header.getUint16(22,true), align = channels * 2;
  if (!tag(0,'RIFF') || !tag(8,'WAVE') || !tag(12,'fmt ') || !tag(36,'data') ||
      header.getUint32(16,true) !== 16 || header.getUint16(20,true) !== 1 ||
      (channels !== 1 && channels !== 2) || header.getUint16(34,true) !== 16 ||
      header.getUint16(32,true) !== align || header.getUint32(28,true) !== rate * align ||
      rate < 8000 || rate > 192000 || !bytes || bytes % align ||
      bytes + 44 !== fileSize || header.getUint32(4,true) !== bytes + 36) return null;
  const frames = bytes / align;
  const firstFrame = Math.max(0, Math.min(frames, Math.floor(startTime * rate)));
  const endFrame = Math.max(firstFrame, Math.min(frames, Math.ceil(endTime * rate)));
  const count = endFrame - firstFrame;
  if (!count || count * channels > 2000000) return null;
  return {rate, channels, align, firstFrame, endFrame, sourceDuration: frames/rate,
    byteStart:44+firstFrame*align, byteEnd:44+endFrame*align,
    points:Math.min(8192, Math.floor(requestedPoints), count)};
}

export function studioPcmRegionPeaks(data, layout) {
  if (!layout || !(data instanceof DataView) || data.byteLength !== layout.byteEnd-layout.byteStart) return null;
  const {rate,channels,align,firstFrame,endFrame,points,sourceDuration} = layout;
  const count = endFrame-firstFrame;
  const waveform = new Array(points).fill(0);
  for (let i=0;i<points;i++) {
    const start = Math.floor(i*count/points), end = Math.floor((i+1)*count/points);
    let peak = 0;
    for(let frame=start;frame<end;frame++) {
      for(let channel=0;channel<channels;channel++) {
        peak=Math.max(peak,Math.abs(data.getInt16(frame*align+channel*2,true))/32768);
      }
    }
    waveform[i]=peak;
  }
  return {waveform,startTime:firstFrame/rate,duration:count/rate,firstFrame,endFrame,sourceDuration};
}

export async function analyzeStudioPcmRegion(blob, startTime, endTime, points) {
  if (!blob || blob.size < 44) return null;
  const header = new DataView(await blob.slice(0,44).arrayBuffer());
  const layout = studioPcmRegionLayout(header,blob.size,startTime,endTime,points);
  if (!layout) return null;
  return studioPcmRegionPeaks(new DataView(await blob.slice(layout.byteStart,layout.byteEnd).arrayBuffer()),layout);
}
