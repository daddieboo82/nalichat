// Mixes stacked stems and applies AI mastering parameters (EQ, compression, limiting,
// loudness boost) in a single offline render, producing an industry-ready WAV blob.

const dbToGain = (db) => Math.pow(10, (db || 0) / 20);

export async function renderMasteredMix(tracks, params) {
  const validTracks = tracks.filter(t => t.file_url && !t.muted);
  if (validTracks.length === 0) throw new Error("No unmuted tracks with audio to bounce.");

  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const offline = new OfflineAudioContext(2, audioContext.sampleRate * 300, audioContext.sampleRate);

  // ---- Master processing chain (AI driven) ----
  const lowShelf = offline.createBiquadFilter();
  lowShelf.type = "lowshelf";
  lowShelf.frequency.value = params?.low_shelf?.freq_hz ?? 100;
  lowShelf.gain.value = params?.low_shelf?.gain_db ?? 0;

  const lowMid = offline.createBiquadFilter();
  lowMid.type = "peaking";
  lowMid.frequency.value = params?.low_mid?.freq_hz ?? 300;
  lowMid.gain.value = params?.low_mid?.gain_db ?? 0;
  lowMid.Q.value = params?.low_mid?.q ?? 1;

  const presence = offline.createBiquadFilter();
  presence.type = "peaking";
  presence.frequency.value = params?.presence?.freq_hz ?? 3000;
  presence.gain.value = params?.presence?.gain_db ?? 0;
  presence.Q.value = params?.presence?.q ?? 1;

  const highShelf = offline.createBiquadFilter();
  highShelf.type = "highshelf";
  highShelf.frequency.value = params?.high_shelf?.freq_hz ?? 10000;
  highShelf.gain.value = params?.high_shelf?.gain_db ?? 0;

  const comp = offline.createDynamicsCompressor();
  comp.threshold.value = params?.compressor?.threshold_db ?? -18;
  comp.ratio.value = params?.compressor?.ratio ?? 2.5;
  comp.attack.value = params?.compressor?.attack_s ?? 0.01;
  comp.release.value = params?.compressor?.release_s ?? 0.2;
  comp.knee.value = params?.compressor?.knee_db ?? 6;

  const makeup = offline.createGain();
  makeup.gain.value = dbToGain(params?.makeup_gain_db ?? 3);

  // Brickwall-style limiter using a fast hard compressor at the ceiling
  const limiter = offline.createDynamicsCompressor();
  limiter.threshold.value = params?.limiter_ceiling_db ?? -1;
  limiter.ratio.value = 20;
  limiter.attack.value = 0.001;
  limiter.release.value = 0.05;
  limiter.knee.value = 0;

  lowShelf.connect(lowMid);
  lowMid.connect(presence);
  presence.connect(highShelf);
  highShelf.connect(comp);
  comp.connect(makeup);
  makeup.connect(limiter);
  limiter.connect(offline.destination);

  // ---- Load + connect stems into the master chain ----
  for (const track of validTracks) {
    try {
      const response = await fetch(track.file_url);
      if (!response.ok) throw new Error(`Failed to load track: ${track.name}`);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await offline.decodeAudioData(arrayBuffer);

      const source = offline.createBufferSource();
      source.buffer = audioBuffer;

      const gainNode = offline.createGain();
      gainNode.gain.value = (track.volume ?? 75) / 100;

      const panNode = offline.createStereoPanner();
      panNode.pan.value = Math.max(-1, Math.min(1, (track.pan ?? 0) / 100));

      source.connect(gainNode);
      gainNode.connect(panNode);
      panNode.connect(lowShelf);
      source.start(0);
    } catch (trackErr) {
      console.warn(`Skipping track ${track.name}:`, trackErr);
    }
  }

  const rendered = await offline.startRendering();
  return bufferToWave(rendered);
}

export function bufferToWave(audioBuffer) {
  const numberOfChannels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const format = 1;
  const bitDepth = 16;
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numberOfChannels * bytesPerSample;

  const channelData = [];
  for (let i = 0; i < numberOfChannels; i++) channelData.push(audioBuffer.getChannelData(i));

  const dataLength = audioBuffer.length * numberOfChannels * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataLength);
  const view = new DataView(buffer);

  const writeString = (offset, string) => {
    for (let i = 0; i < string.length; i++) view.setUint8(offset + i, string.charCodeAt(i));
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataLength, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, format, true);
  view.setUint16(22, numberOfChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeString(36, 'data');
  view.setUint32(40, dataLength, true);

  let offset = 44;
  for (let i = 0; i < audioBuffer.length; i++) {
    for (let channel = 0; channel < numberOfChannels; channel++) {
      let s = Math.max(-1, Math.min(1, channelData[channel][i]));
      s = s < 0 ? s * 0x8000 : s * 0x7FFF;
      view.setInt16(offset, s, true);
      offset += 2;
    }
  }
  return buffer;
}